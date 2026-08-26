import { pool } from '@/lib/db';
import { getCurrentBusinessDate } from '@/lib/format';
import { getWeather } from './services/weather.service';

export interface DateFilter {
  date_from?: string;
  date_to?: string;
}

/**
 * Helper to fetch restaurant info & current business date
 */
async function getRestaurantContext(restaurantId: string) {
  const res = await pool.query(
    `SELECT * FROM restaurants WHERE id = $1 LIMIT 1`,
    [restaurantId]
  );
  if (res.rows.length === 0) {
    throw new Error('Restaurant not found');
  }
  const rest = res.rows[0];
  const currentBusinessDate = getCurrentBusinessDate(rest.timezone || 'Asia/Kolkata', rest.rollover_time || '00:00:00');
  return { rest, currentBusinessDate };
}

/**
 * 1. getSalesSummary
 */
export async function getSalesSummary(restaurantId: string, params: DateFilter = {}) {
  const { rest, currentBusinessDate } = await getRestaurantContext(restaurantId);
  const dateFrom = params.date_from || currentBusinessDate;
  const dateTo = params.date_to || currentBusinessDate;

  const res = await pool.query(
    `SELECT 
       COUNT(*)::int as total_orders,
       COUNT(*) FILTER (WHERE status = 'PAID')::int as paid_orders,
       COUNT(*) FILTER (WHERE status = 'CANCELLED')::int as cancelled_orders,
       COALESCE(SUM(total_price) FILTER (WHERE status != 'CANCELLED'), 0)::numeric as gross_revenue,
       COALESCE(SUM(total_price) FILTER (WHERE status = 'PAID'), 0)::numeric as total_paid_revenue,
       COALESCE(SUM(subtotal) FILTER (WHERE status = 'PAID' AND gst_type = 'REGULAR'), 0)::numeric as net_subtotal,
       COALESCE(SUM(gst_amount) FILTER (WHERE status = 'PAID' AND gst_type = 'REGULAR'), 0)::numeric as regular_gst,
       COALESCE(SUM(total_price * gst_rate / 100) FILTER (WHERE status = 'PAID' AND gst_type = 'COMPOSITION'), 0)::numeric as composition_gst,
       COALESCE(AVG(total_price) FILTER (WHERE status = 'PAID'), 0)::numeric as average_order_value
     FROM orders
     WHERE restaurant_id = $1
       AND business_date >= $2::date
       AND business_date <= $3::date`,
    [restaurantId, dateFrom, dateTo]
  );

  const row = res.rows[0];
  const totalOrders = Number(row.total_orders || 0);
  const cancelledOrders = Number(row.cancelled_orders || 0);
  const cancellationRatePercent = totalOrders > 0 ? Math.round((cancelledOrders / totalOrders) * 10000) / 100 : 0;

  // Compute GST based on restaurant GST type
  let gstCollected = 0;
  if (rest.gst_type === 'REGULAR') {
    gstCollected = Number(row.regular_gst || 0);
  } else if (rest.gst_type === 'COMPOSITION') {
    gstCollected = Number(row.composition_gst || 0);
  }

  // Payment methods breakdown for paid orders
  const paymentRes = await pool.query(
    `SELECT 
       COALESCE(payment_method, 'UNKNOWN') as method,
       COUNT(*)::int as count,
       COALESCE(SUM(total_price), 0)::numeric as total_amount
     FROM orders
     WHERE restaurant_id = $1
       AND business_date >= $2::date
       AND business_date <= $3::date
       AND status = 'PAID'
     GROUP BY COALESCE(payment_method, 'UNKNOWN')
     ORDER BY total_amount DESC`,
    [restaurantId, dateFrom, dateTo]
  );

  const paymentBreakdown = paymentRes.rows.map(r => ({
    method: r.method,
    count: Number(r.count || 0),
    total_amount: Math.round(Number(r.total_amount) * 100) / 100
  }));

  return {
    date_from: dateFrom,
    date_to: dateTo,
    gst_type: rest.gst_type,
    total_orders: totalOrders,
    paid_orders: Number(row.paid_orders || 0),
    cancelled_orders: cancelledOrders,
    cancellation_rate_percent: cancellationRatePercent,
    gross_revenue: Math.round(Number(row.gross_revenue) * 100) / 100,
    paid_revenue: Math.round(Number(row.total_paid_revenue) * 100) / 100,
    net_subtotal: Math.round(Number(row.net_subtotal) * 100) / 100,
    gst_collected: Math.round(gstCollected * 100) / 100,
    average_order_value: Math.round(Number(row.average_order_value) * 100) / 100,
    payment_breakdown: paymentBreakdown
  };
}

/**
 * 2. getSalesTrend
 */
export async function getSalesTrend(restaurantId: string, params: { period?: 'daily' | 'weekly' | 'monthly'; date_from?: string; date_to?: string } = {}) {
  const { currentBusinessDate } = await getRestaurantContext(restaurantId);

  // Default to last 30 days if no date provided
  const dateTo = params.date_to || currentBusinessDate;
  let dateFrom = params.date_from;
  if (!dateFrom) {
    const d = new Date(dateTo);
    d.setDate(d.getDate() - 30);
    dateFrom = d.toISOString().split('T')[0];
  }

  const res = await pool.query(
    `SELECT 
       business_date::text,
       COUNT(*)::int as total_orders,
       COUNT(*) FILTER (WHERE status = 'PAID')::int as paid_orders,
       COUNT(*) FILTER (WHERE status = 'CANCELLED')::int as cancelled_orders,
       COALESCE(SUM(total_price) FILTER (WHERE status = 'PAID'), 0)::numeric as total_revenue,
       COALESCE(AVG(total_price) FILTER (WHERE status = 'PAID'), 0)::numeric as aov
     FROM orders
     WHERE restaurant_id = $1
       AND business_date >= $2::date
       AND business_date <= $3::date
     GROUP BY business_date
     ORDER BY business_date ASC`,
    [restaurantId, dateFrom, dateTo]
  );

  return {
    period: params.period || 'daily',
    date_from: dateFrom,
    date_to: dateTo,
    data_points: res.rows.map(r => ({
      business_date: r.business_date,
      total_orders: Number(r.total_orders),
      paid_orders: Number(r.paid_orders),
      cancelled_orders: Number(r.cancelled_orders),
      total_revenue: Math.round(Number(r.total_revenue) * 100) / 100,
      aov: Math.round(Number(r.aov) * 100) / 100
    }))
  };
}

/**
 * 3. getHourlySales
 */
export async function getHourlySales(restaurantId: string, params: DateFilter = {}) {
  const { currentBusinessDate } = await getRestaurantContext(restaurantId);
  const dateFrom = params.date_from || currentBusinessDate;
  const dateTo = params.date_to || currentBusinessDate;

  const res = await pool.query(
    `SELECT 
       EXTRACT(HOUR FROM created_at)::int as hour,
       COUNT(*)::int as order_count,
       COALESCE(SUM(total_price) FILTER (WHERE status = 'PAID'), 0)::numeric as revenue
     FROM orders
     WHERE restaurant_id = $1
       AND business_date >= $2::date
       AND business_date <= $3::date
     GROUP BY EXTRACT(HOUR FROM created_at)
     ORDER BY hour ASC`,
    [restaurantId, dateFrom, dateTo]
  );

  return {
    date_from: dateFrom,
    date_to: dateTo,
    hourly_breakdown: res.rows.map(r => ({
      hour_24h: r.hour,
      hour_label: `${r.hour}:00 - ${r.hour + 1}:00`,
      order_count: Number(r.order_count),
      revenue: Math.round(Number(r.revenue) * 100) / 100
    }))
  };
}

/**
 * 4. getTopProducts
 */
export async function getTopProducts(restaurantId: string, params: DateFilter & { limit?: number } = {}) {
  const { currentBusinessDate } = await getRestaurantContext(restaurantId);
  const dateFrom = params.date_from || currentBusinessDate;
  const dateTo = params.date_to || currentBusinessDate;
  const limit = Math.min(params.limit || 10, 50);

  const res = await pool.query(
    `SELECT 
       p.id as product_id,
       p.name as product_name,
       p.category,
       p.price::numeric,
       SUM(oi.quantity)::int as total_quantity_sold,
       SUM(oi.quantity * oi.price_at_purchase)::numeric as total_revenue
     FROM order_items oi
     JOIN products p ON p.id = oi.product_id
     JOIN orders o ON o.id = oi.order_id
     WHERE o.restaurant_id = $1
       AND o.business_date >= $2::date
       AND o.business_date <= $3::date
       AND o.status = 'PAID'
     GROUP BY p.id, p.name, p.category, p.price
     ORDER BY total_quantity_sold DESC, total_revenue DESC
     LIMIT $4`,
    [restaurantId, dateFrom, dateTo, limit]
  );

  return {
    date_from: dateFrom,
    date_to: dateTo,
    limit,
    top_products: res.rows.map(r => ({
      product_name: r.product_name,
      category: r.category,
      unit_price: Number(r.price),
      total_quantity_sold: Number(r.total_quantity_sold),
      total_revenue: Math.round(Number(r.total_revenue) * 100) / 100
    }))
  };
}

/**
 * 5. getBottomProducts
 */
export async function getBottomProducts(restaurantId: string, params: DateFilter & { limit?: number } = {}) {
  const { currentBusinessDate } = await getRestaurantContext(restaurantId);
  const dateFrom = params.date_from || currentBusinessDate;
  const dateTo = params.date_to || currentBusinessDate;
  const limit = Math.min(params.limit || 10, 50);

  // Active products with sales sorted ascending, including active products with 0 sales
  const res = await pool.query(
    `SELECT 
       p.id as product_id,
       p.name as product_name,
       p.category,
       p.price::numeric,
       COALESCE(SUM(oi.quantity), 0)::int as total_quantity_sold,
       COALESCE(SUM(oi.quantity * oi.price_at_purchase), 0)::numeric as total_revenue
     FROM products p
     LEFT JOIN order_items oi ON oi.product_id = p.id
     LEFT JOIN orders o ON o.id = oi.order_id 
       AND o.restaurant_id = $1 
       AND o.business_date >= $2::date 
       AND o.business_date <= $3::date
       AND o.status = 'PAID'
     WHERE p.restaurant_id = $1
       AND p.is_active = true
     GROUP BY p.id, p.name, p.category, p.price
     ORDER BY total_quantity_sold ASC, total_revenue ASC
     LIMIT $4`,
    [restaurantId, dateFrom, dateTo, limit]
  );

  return {
    date_from: dateFrom,
    date_to: dateTo,
    limit,
    bottom_products: res.rows.map(r => ({
      product_name: r.product_name,
      category: r.category,
      unit_price: Number(r.price),
      total_quantity_sold: Number(r.total_quantity_sold),
      total_revenue: Math.round(Number(r.total_revenue) * 100) / 100
    }))
  };
}

/**
 * 6. getCategoryPerformance
 */
export async function getCategoryPerformance(restaurantId: string, params: DateFilter = {}) {
  const { currentBusinessDate } = await getRestaurantContext(restaurantId);
  const dateFrom = params.date_from || currentBusinessDate;
  const dateTo = params.date_to || currentBusinessDate;

  const res = await pool.query(
    `SELECT 
       COALESCE(p.category, 'Uncategorized') as category,
       COUNT(DISTINCT p.id)::int as total_items_in_category,
       SUM(oi.quantity)::int as total_items_sold,
       SUM(oi.quantity * oi.price_at_purchase)::numeric as category_revenue
     FROM order_items oi
     JOIN products p ON p.id = oi.product_id
     JOIN orders o ON o.id = oi.order_id
     WHERE o.restaurant_id = $1
       AND o.business_date >= $2::date
       AND o.business_date <= $3::date
       AND o.status = 'PAID'
     GROUP BY p.category
     ORDER BY category_revenue DESC`,
    [restaurantId, dateFrom, dateTo]
  );

  return {
    date_from: dateFrom,
    date_to: dateTo,
    categories: res.rows.map(r => ({
      category: r.category,
      total_items_in_category: Number(r.total_items_in_category),
      total_items_sold: Number(r.total_items_sold),
      category_revenue: Math.round(Number(r.category_revenue) * 100) / 100
    }))
  };
}

/**
 * 7. getAverageOrderValue
 */
export async function getAverageOrderValue(restaurantId: string, params: DateFilter = {}) {
  const summary = await getSalesSummary(restaurantId, params);
  return {
    date_from: summary.date_from,
    date_to: summary.date_to,
    paid_orders: summary.paid_orders,
    paid_revenue: summary.paid_revenue,
    average_order_value: summary.average_order_value
  };
}

/**
 * 8. getCancellationRate
 */
export async function getCancellationRate(restaurantId: string, params: DateFilter = {}) {
  const { currentBusinessDate } = await getRestaurantContext(restaurantId);
  const dateFrom = params.date_from || currentBusinessDate;
  const dateTo = params.date_to || currentBusinessDate;

  const res = await pool.query(
    `SELECT 
       COUNT(*)::int as total_orders,
       COUNT(*) FILTER (WHERE status = 'CANCELLED')::int as cancelled_orders,
       COALESCE(SUM(total_price) FILTER (WHERE status = 'CANCELLED'), 0)::numeric as lost_revenue
     FROM orders
     WHERE restaurant_id = $1
       AND business_date >= $2::date
       AND business_date <= $3::date`,
    [restaurantId, dateFrom, dateTo]
  );

  const row = res.rows[0];
  const totalOrders = Number(row.total_orders || 0);
  const cancelledOrders = Number(row.cancelled_orders || 0);
  const cancellationRatePercent = totalOrders > 0 ? Math.round((cancelledOrders / totalOrders) * 10000) / 100 : 0;

  return {
    date_from: dateFrom,
    date_to: dateTo,
    total_orders: totalOrders,
    cancelled_orders: cancelledOrders,
    cancellation_rate_percent: cancellationRatePercent,
    lost_revenue: Math.round(Number(row.lost_revenue) * 100) / 100
  };
}

/**
 * 9. comparePeriods
 */
export async function comparePeriods(
  restaurantId: string,
  params: { period1_from: string; period1_to: string; period2_from: string; period2_to: string }
) {
  const p1 = await getSalesSummary(restaurantId, { date_from: params.period1_from, date_to: params.period1_to });
  const p2 = await getSalesSummary(restaurantId, { date_from: params.period2_from, date_to: params.period2_to });

  const calculateChange = (val1: number, val2: number) => {
    if (val2 === 0) return val1 > 0 ? 100 : 0;
    return Math.round(((val1 - val2) / val2) * 10000) / 100;
  };

  return {
    period_1: {
      date_from: params.period1_from,
      date_to: params.period1_to,
      revenue: p1.paid_revenue,
      orders: p1.paid_orders,
      aov: p1.average_order_value,
      cancellations: p1.cancelled_orders
    },
    period_2: {
      date_from: params.period2_from,
      date_to: params.period2_to,
      revenue: p2.paid_revenue,
      orders: p2.paid_orders,
      aov: p2.average_order_value,
      cancellations: p2.cancelled_orders
    },
    comparison_percentage_change: {
      revenue_change_percent: calculateChange(p1.paid_revenue, p2.paid_revenue),
      orders_change_percent: calculateChange(p1.paid_orders, p2.paid_orders),
      aov_change_percent: calculateChange(p1.average_order_value, p2.average_order_value)
    }
  };
}

/**
 * 10. getInventorySummary
 */
export async function getInventorySummary(restaurantId: string) {
  const res = await pool.query(
    `SELECT 
       COUNT(*)::int as total_active_products,
       COUNT(*) FILTER (WHERE status = 'AVAILABLE')::int as available_count,
       COUNT(*) FILTER (WHERE status = 'LOW_STOCK')::int as low_stock_count,
       COUNT(*) FILTER (WHERE status = 'OUT_OF_STOCK')::int as out_of_stock_count
     FROM products
     WHERE restaurant_id = $1 AND is_active = true`,
    [restaurantId]
  );

  const lowStockItemsRes = await pool.query(
    `SELECT id, name, category, price::numeric, stock_quantity, buffer_quantity, status
     FROM products
     WHERE restaurant_id = $1 AND is_active = true AND status IN ('LOW_STOCK', 'OUT_OF_STOCK')
     ORDER BY stock_quantity ASC
     LIMIT 20`,
    [restaurantId]
  );

  const summary = res.rows[0];
  return {
    total_active_products: Number(summary.total_active_products),
    available_count: Number(summary.available_count),
    low_stock_count: Number(summary.low_stock_count),
    out_of_stock_count: Number(summary.out_of_stock_count),
    low_or_out_of_stock_items: lowStockItemsRes.rows.map(r => ({
      name: r.name,
      category: r.category,
      price: Number(r.price),
      stock_quantity: Number(r.stock_quantity),
      buffer_quantity: Number(r.buffer_quantity),
      status: r.status
    }))
  };
}

/**
 * 11. searchRestaurantKnowledge
 */
export async function searchRestaurantKnowledge(restaurantId: string, params: { query?: string } = {}) {
  const { rest, currentBusinessDate } = await getRestaurantContext(restaurantId);

  const catRes = await pool.query(
    `SELECT DISTINCT category FROM products WHERE restaurant_id = $1 AND is_active = true`,
    [restaurantId]
  );

  const prodCountRes = await pool.query(
    `SELECT COUNT(*)::int as total_active_products FROM products WHERE restaurant_id = $1 AND is_active = true`,
    [restaurantId]
  );

  const staffRes = await pool.query(
    `SELECT id, name, role, email, is_active FROM staffs WHERE restaurant_id = $1`,
    [restaurantId]
  );

  return {
    restaurant_details: rest,
    restaurant_name: rest.name,
    slug: rest.slug,
    timezone: rest.timezone || 'Asia/Kolkata',
    rollover_time: rest.rollover_time || '00:00:00',
    current_business_date: currentBusinessDate,
    gst_configuration: {
      type: rest.gst_type,
      rate: Number(rest.gst_rate)
    },
    billing_tier: rest.billing_tier,
    billing_status: rest.billing_status,
    primary_color: rest.primary_color,
    secondary_color: rest.secondary_color,
    logo_url: rest.logo_url,
    total_active_products: Number(prodCountRes.rows[0]?.total_active_products || 0),
    menu_categories: catRes.rows.map(r => r.category),
    active_staff_count: staffRes.rows.length,
    staff_members: staffRes.rows.map(s => ({ id: s.id, name: s.name, role: s.role, email: s.email, is_active: s.is_active }))
  };
}

/**
 * 12. getHolidays
 */
export async function getHolidays(restaurantId: string, args: { startDate?: string; endDate?: string } = {}) {
  const { currentBusinessDate } = await getRestaurantContext(restaurantId);
  const nowStr = currentBusinessDate || new Date().toISOString().split('T')[0];
  const parts = nowStr.split('-');
  const yearStr = parts[0] || '2026';
  const monthStr = parts[1] || '08';
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);

  const defaultStart = `${yearStr}-${monthStr}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const defaultEnd = `${yearStr}-${monthStr}-${String(lastDay).padStart(2, '0')}`;

  const startDate = args?.startDate || defaultStart;
  const endDate = args?.endDate || defaultEnd;

  const restRes = await pool.query(
    `SELECT country_code, state_code, district, city FROM restaurants WHERE id = $1 LIMIT 1`,
    [restaurantId]
  );

  const countryCode = restRes.rows[0]?.country_code || 'IN';
  const stateCode = restRes.rows[0]?.state_code || 'KL';

  const holidayRes = await pool.query(
    `SELECT name, holiday_date, holiday_type, is_public_holiday, source
     FROM holidays
     WHERE holiday_date >= $1::date AND holiday_date <= $2::date
       AND (country_code = $3 OR country_code IS NULL)
       AND (state_code IS NULL OR state_code = $4)
     ORDER BY holiday_date ASC`,
    [startDate, endDate, countryCode, stateCode]
  );

  return {
    restaurant_location: {
      country_code: countryCode,
      state_code: stateCode
    },
    period: {
      start: startDate,
      end: endDate
    },
    total_holidays: holidayRes.rows.length,
    holidays: holidayRes.rows.map(h => {
      let formattedDate = h.holiday_date;
      if (h.holiday_date instanceof Date) {
        formattedDate = h.holiday_date.toISOString().split('T')[0];
      } else if (typeof h.holiday_date === 'string') {
        formattedDate = h.holiday_date.split('T')[0];
      }
      return {
        name: h.name,
        date: formattedDate,
        type: h.holiday_type,
        is_public_holiday: h.is_public_holiday,
        source: h.source
      };
    })
  };
}

/**
 * 13. getWeather
 */
export async function getWeatherTool(restaurantId: string, args: { startDate?: string; endDate?: string; includeHourly?: boolean } = {}) {
  const { currentBusinessDate } = await getRestaurantContext(restaurantId);
  const nowStr = currentBusinessDate || new Date().toISOString().split('T')[0];
  const startDate = args?.startDate || nowStr;
  const endDate = args?.endDate || nowStr;

  return await getWeather({
    restaurantId,
    startDate,
    endDate,
    includeHourly: args?.includeHourly
  });
}

/**
 * ============================================================================
 * TABLE MANAGEMENT & ANALYTICS TOOLS
 * ============================================================================
 */

export async function getTableOccupancy(restaurantId: string, params: DateFilter = {}) {
  const { currentBusinessDate } = await getRestaurantContext(restaurantId);
  const dateFrom = params.date_from || currentBusinessDate;
  const dateTo = params.date_to || currentBusinessDate;

  const totalRes = await pool.query(
    `SELECT COUNT(*)::int as total_tables FROM restaurant_tables WHERE restaurant_id = $1`,
    [restaurantId]
  );
  const totalTables = Number(totalRes.rows[0]?.total_tables || 0);

  const occupiedRes = await pool.query(
    `SELECT COUNT(DISTINCT t.id)::int as occupied_tables
     FROM restaurant_tables t
     WHERE t.restaurant_id = $1
       AND (
         t.status = 'OCCUPIED'
         OR EXISTS (
           SELECT 1 FROM orders o
           WHERE o.restaurant_id = $1
             AND (o.table_id = t.id OR o.table_number = t.table_number)
             AND o.status NOT IN ('PAID', 'CANCELLED', 'EXPIRED')
             AND o.business_date >= $2::date
             AND o.business_date <= $3::date
         )
         OR EXISTS (
           SELECT 1 FROM table_sessions ts
           WHERE ts.restaurant_id = $1
             AND ts.table_id = t.id
             AND ts.started_at::date <= $3::date
             AND (ts.ended_at IS NULL OR ts.ended_at::date >= $2::date)
         )
       )`,
    [restaurantId, dateFrom, dateTo]
  );

  const occupiedTables = Math.min(totalTables, Number(occupiedRes.rows[0]?.occupied_tables || 0));
  const availableTables = Math.max(0, totalTables - occupiedTables);
  const occupancyRate = totalTables > 0 ? Math.round((occupiedTables / totalTables) * 100 * 100) / 100 : 0;

  return {
    date_from: dateFrom,
    date_to: dateTo,
    total_tables: totalTables,
    occupied_tables: occupiedTables,
    available_tables: availableTables,
    occupancy_rate: occupancyRate
  };
}

export async function getTableTurnover(restaurantId: string, params: DateFilter = {}) {
  const { currentBusinessDate } = await getRestaurantContext(restaurantId);
  const dateFrom = params.date_from || currentBusinessDate;
  const dateTo = params.date_to || currentBusinessDate;

  const totalRes = await pool.query(
    `SELECT COUNT(*)::int as total_tables FROM restaurant_tables WHERE restaurant_id = $1`,
    [restaurantId]
  );
  const totalTables = Number(totalRes.rows[0]?.total_tables || 0);

  const sessionRes = await pool.query(
    `SELECT 
       COUNT(*)::int as completed_sessions,
       COALESCE(AVG(EXTRACT(EPOCH FROM (ended_at - started_at))/60), 0)::numeric as avg_minutes
     FROM table_sessions
     WHERE restaurant_id = $1
       AND status = 'CLOSED'
       AND ended_at IS NOT NULL
       AND started_at >= $2::date AND started_at < ($3::date + INTERVAL '1 day')`,
    [restaurantId, dateFrom, dateTo]
  );

  const completedSessions = Number(sessionRes.rows[0]?.completed_sessions || 0);
  const avgTurnTimeMinutes = Math.round(Number(sessionRes.rows[0]?.avg_minutes || 0) * 10) / 10;
  const turnoverRate = totalTables > 0 ? Math.round((completedSessions / totalTables) * 100) / 100 : 0;

  return {
    date_from: dateFrom,
    date_to: dateTo,
    total_tables: totalTables,
    completed_sessions: completedSessions,
    turnover_rate: turnoverRate,
    average_turn_time_minutes: avgTurnTimeMinutes
  };
}

export async function getAverageTableTurnTime(restaurantId: string, params: DateFilter = {}) {
  const { currentBusinessDate } = await getRestaurantContext(restaurantId);
  const dateFrom = params.date_from || currentBusinessDate;
  const dateTo = params.date_to || currentBusinessDate;

  const res = await pool.query(
    `SELECT 
       COALESCE(AVG(EXTRACT(EPOCH FROM (ended_at - started_at))/60), 0)::numeric as average_minutes,
       COALESCE(MIN(EXTRACT(EPOCH FROM (ended_at - started_at))/60), 0)::numeric as fastest_table_minutes,
       COALESCE(MAX(EXTRACT(EPOCH FROM (ended_at - started_at))/60), 0)::numeric as slowest_table_minutes,
       COUNT(*)::int as completed_sessions
     FROM table_sessions
     WHERE restaurant_id = $1
       AND status = 'CLOSED'
       AND ended_at IS NOT NULL
       AND started_at >= $2::date AND started_at < ($3::date + INTERVAL '1 day')`,
    [restaurantId, dateFrom, dateTo]
  );

  const row = res.rows[0];
  const count = Number(row?.completed_sessions || 0);

  return {
    date_from: dateFrom,
    date_to: dateTo,
    average_minutes: count > 0 ? Math.round(Number(row.average_minutes) * 10) / 10 : 0,
    fastest_table_minutes: count > 0 ? Math.round(Number(row.fastest_table_minutes) * 10) / 10 : 0,
    slowest_table_minutes: count > 0 ? Math.round(Number(row.slowest_table_minutes) * 10) / 10 : 0
  };
}

export async function getTableUtilization(restaurantId: string, params: DateFilter = {}) {
  const { currentBusinessDate } = await getRestaurantContext(restaurantId);
  const dateFrom = params.date_from || currentBusinessDate;
  const dateTo = params.date_to || currentBusinessDate;

  const totalRes = await pool.query(
    `SELECT COUNT(*)::int as total_tables FROM restaurant_tables WHERE restaurant_id = $1`,
    [restaurantId]
  );
  const totalTables = Number(totalRes.rows[0]?.total_tables || 0);

  const daysRes = await pool.query(
    `SELECT ($2::date - $1::date + 1)::int as num_days`,
    [dateFrom, dateTo]
  );
  const numDays = Math.max(1, Number(daysRes.rows[0]?.num_days || 1));
  const totalAvailableTableHours = Math.round(totalTables * numDays * 24 * 10) / 10;

  const occupiedRes = await pool.query(
    `SELECT 
       COALESCE(SUM(
         EXTRACT(EPOCH FROM (
           LEAST(COALESCE(ended_at, CURRENT_TIMESTAMP), ($3::date + INTERVAL '1 day')) - 
           GREATEST(started_at, $2::date)
         ))/3600
       ), 0)::numeric as occupied_hours
     FROM table_sessions
     WHERE restaurant_id = $1
       AND started_at < ($3::date + INTERVAL '1 day')
       AND (ended_at IS NULL OR ended_at >= $2::date)`,
    [restaurantId, dateFrom, dateTo]
  );

  const occupiedTableHours = Math.round(Number(occupiedRes.rows[0]?.occupied_hours || 0) * 10) / 10;
  const utilizationRate = totalAvailableTableHours > 0 
    ? Math.min(100, Math.round((occupiedTableHours / totalAvailableTableHours) * 100 * 100) / 100) 
    : 0;

  return {
    date_from: dateFrom,
    date_to: dateTo,
    total_available_table_hours: totalAvailableTableHours,
    occupied_table_hours: occupiedTableHours,
    utilization_rate: utilizationRate
  };
}

export async function getTableUsageByHour(restaurantId: string, params: DateFilter = {}) {
  const { currentBusinessDate } = await getRestaurantContext(restaurantId);
  const dateFrom = params.date_from || currentBusinessDate;
  const dateTo = params.date_to || currentBusinessDate;

  const totalRes = await pool.query(
    `SELECT COUNT(*)::int as total_tables FROM restaurant_tables WHERE restaurant_id = $1`,
    [restaurantId]
  );
  const totalTables = Number(totalRes.rows[0]?.total_tables || 0);

  const daysRes = await pool.query(
    `SELECT ($2::date - $1::date + 1)::int as num_days`,
    [dateFrom, dateTo]
  );
  const numDays = Math.max(1, Number(daysRes.rows[0]?.num_days || 1));

  const res = await pool.query(
    `SELECT 
       EXTRACT(HOUR FROM started_at)::int as hour,
       COUNT(*)::int as sessions
     FROM table_sessions
     WHERE restaurant_id = $1
       AND started_at >= $2::date AND started_at < ($3::date + INTERVAL '1 day')
     GROUP BY EXTRACT(HOUR FROM started_at)
     ORDER BY hour ASC`,
    [restaurantId, dateFrom, dateTo]
  );

  const hourMap = new Map<number, number>();
  res.rows.forEach(r => hourMap.set(r.hour, Number(r.sessions)));

  const usageList = [];
  for (let h = 0; h < 24; h++) {
    const sessions = hourMap.get(h) || 0;
    const occupancyRate = (totalTables * numDays) > 0 
      ? Math.min(100, Math.round((sessions / (totalTables * numDays)) * 100 * 100) / 100)
      : 0;
    usageList.push({
      hour: h,
      sessions,
      occupancy_rate: occupancyRate
    });
  }

  return usageList;
}

export async function getTablePerformance(restaurantId: string, params: DateFilter = {}) {
  const { currentBusinessDate } = await getRestaurantContext(restaurantId);
  const dateFrom = params.date_from || currentBusinessDate;
  const dateTo = params.date_to || currentBusinessDate;

  const res = await pool.query(
    `SELECT 
       t.id as table_id,
       t.table_number,
       t.capacity,
       COUNT(DISTINCT ts.id)::int as sessions,
       COALESCE(SUM(o.total_price) FILTER (WHERE o.status = 'PAID'), 0)::numeric as revenue,
       COALESCE(AVG(ts.party_size), 0)::numeric as average_party_size,
       COALESCE(AVG(EXTRACT(EPOCH FROM (ts.ended_at - ts.started_at))/60) FILTER (WHERE ts.status = 'CLOSED' AND ts.ended_at IS NOT NULL), 0)::numeric as avg_turn_time
     FROM restaurant_tables t
     LEFT JOIN table_sessions ts ON ts.table_id = t.id
       AND ts.started_at >= $2::date AND ts.started_at < ($3::date + INTERVAL '1 day')
     LEFT JOIN orders o ON (o.table_session_id = ts.id OR (o.table_id = t.id AND o.table_session_id IS NULL) OR (o.table_number = t.table_number AND o.table_session_id IS NULL))
       AND o.business_date >= $2::date AND o.business_date <= $3::date
     WHERE t.restaurant_id = $1
     GROUP BY t.id, t.table_number, t.capacity
     ORDER BY 
       CASE 
         WHEN t.table_number ~ '^[0-9]+$' THEN t.table_number::integer 
         ELSE 999999 
       END ASC, 
       t.table_number ASC`,
    [restaurantId, dateFrom, dateTo]
  );

  return res.rows.map(r => ({
    table_id: r.table_id,
    table_number: r.table_number,
    capacity: Number(r.capacity),
    sessions: Number(r.sessions),
    revenue: Math.round(Number(r.revenue) * 100) / 100,
    average_party_size: Math.round(Number(r.average_party_size) * 10) / 10,
    average_turn_time_minutes: Math.round(Number(r.avg_turn_time) * 10) / 10
  }));
}

export async function getTopTablesByRevenue(restaurantId: string, params: DateFilter & { limit?: number } = {}) {
  const { currentBusinessDate } = await getRestaurantContext(restaurantId);
  const dateFrom = params.date_from || currentBusinessDate;
  const dateTo = params.date_to || currentBusinessDate;
  const limit = Math.min(params.limit || 10, 50);

  const res = await pool.query(
    `SELECT 
       t.table_number,
       COALESCE(SUM(o.total_price) FILTER (WHERE o.status = 'PAID'), 0)::numeric as revenue
     FROM restaurant_tables t
     LEFT JOIN table_sessions ts ON ts.table_id = t.id
       AND ts.started_at >= $2::date AND ts.started_at < ($3::date + INTERVAL '1 day')
     LEFT JOIN orders o ON (o.table_session_id = ts.id OR (o.table_id = t.id AND o.table_session_id IS NULL))
       AND o.business_date >= $2::date AND o.business_date <= $3::date
     WHERE t.restaurant_id = $1
     GROUP BY t.id, t.table_number
     ORDER BY revenue DESC
     LIMIT $4`,
    [restaurantId, dateFrom, dateTo, limit]
  );

  return res.rows.map(r => ({
    table_number: r.table_number,
    revenue: Math.round(Number(r.revenue) * 100) / 100
  }));
}

export async function getBottomTablesByRevenue(restaurantId: string, params: DateFilter & { limit?: number } = {}) {
  const { currentBusinessDate } = await getRestaurantContext(restaurantId);
  const dateFrom = params.date_from || currentBusinessDate;
  const dateTo = params.date_to || currentBusinessDate;
  const limit = Math.min(params.limit || 10, 50);

  const res = await pool.query(
    `SELECT 
       t.table_number,
       COALESCE(SUM(o.total_price) FILTER (WHERE o.status = 'PAID'), 0)::numeric as revenue
     FROM restaurant_tables t
     LEFT JOIN table_sessions ts ON ts.table_id = t.id
       AND ts.started_at >= $2::date AND ts.started_at < ($3::date + INTERVAL '1 day')
     LEFT JOIN orders o ON (o.table_session_id = ts.id OR (o.table_id = t.id AND o.table_session_id IS NULL))
       AND o.business_date >= $2::date AND o.business_date <= $3::date
     WHERE t.restaurant_id = $1
     GROUP BY t.id, t.table_number
     ORDER BY revenue ASC
     LIMIT $4`,
    [restaurantId, dateFrom, dateTo, limit]
  );

  return res.rows.map(r => ({
    table_number: r.table_number,
    revenue: Math.round(Number(r.revenue) * 100) / 100
  }));
}

export async function getTableCapacityPerformance(restaurantId: string, params: DateFilter = {}) {
  const { currentBusinessDate } = await getRestaurantContext(restaurantId);
  const dateFrom = params.date_from || currentBusinessDate;
  const dateTo = params.date_to || currentBusinessDate;

  const res = await pool.query(
    `SELECT 
       t.table_number,
       t.capacity,
       COALESCE(AVG(ts.party_size), 0)::numeric as average_party_size
     FROM restaurant_tables t
     LEFT JOIN table_sessions ts ON ts.table_id = t.id
       AND ts.started_at >= $2::date AND ts.started_at < ($3::date + INTERVAL '1 day')
     WHERE t.restaurant_id = $1
     GROUP BY t.id, t.table_number, t.capacity
     ORDER BY 
       CASE 
         WHEN t.table_number ~ '^[0-9]+$' THEN t.table_number::integer 
         ELSE 999999 
       END ASC, 
       t.table_number ASC`,
    [restaurantId, dateFrom, dateTo]
  );

  return res.rows.map(r => {
    const capacity = Number(r.capacity || 4);
    const avgPartySize = Math.round(Number(r.average_party_size) * 10) / 10;
    const seatUtil = capacity > 0 ? Math.min(100, Math.round((avgPartySize / capacity) * 100 * 10) / 10) : 0;
    return {
      table_number: r.table_number,
      capacity,
      average_party_size: avgPartySize,
      seat_utilization: seatUtil
    };
  });
}

export async function getRevenuePerTableHour(restaurantId: string, params: DateFilter = {}) {
  const { currentBusinessDate } = await getRestaurantContext(restaurantId);
  const dateFrom = params.date_from || currentBusinessDate;
  const dateTo = params.date_to || currentBusinessDate;

  const revRes = await pool.query(
    `SELECT COALESCE(SUM(total_price) FILTER (WHERE status = 'PAID'), 0)::numeric as total_revenue
     FROM orders
     WHERE restaurant_id = $1
       AND table_id IS NOT NULL
       AND business_date >= $2::date AND business_date <= $3::date`,
    [restaurantId, dateFrom, dateTo]
  );
  const totalRevenue = Math.round(Number(revRes.rows[0]?.total_revenue || 0) * 100) / 100;

  const hoursRes = await pool.query(
    `SELECT 
       COALESCE(SUM(
         EXTRACT(EPOCH FROM (
           LEAST(COALESCE(ended_at, CURRENT_TIMESTAMP), ($3::date + INTERVAL '1 day')) - 
           GREATEST(started_at, $2::date)
         ))/3600
       ), 0)::numeric as occupied_hours
     FROM table_sessions
     WHERE restaurant_id = $1
       AND started_at < ($3::date + INTERVAL '1 day')
       AND (ended_at IS NULL OR ended_at >= $2::date)`,
    [restaurantId, dateFrom, dateTo]
  );
  const occupiedTableHours = Math.round(Number(hoursRes.rows[0]?.occupied_hours || 0) * 10) / 10;
  const revPerTableHour = occupiedTableHours > 0 
    ? Math.round((totalRevenue / occupiedTableHours) * 100) / 100 
    : 0;

  return {
    date_from: dateFrom,
    date_to: dateTo,
    total_revenue: totalRevenue,
    occupied_table_hours: occupiedTableHours,
    revenue_per_table_hour: revPerTableHour
  };
}

/**
 * Master dispatcher for tool calls invoked by Gemini Function Calling
 */
export async function executeAnalystToolCall(restaurantId: string, toolName: string, args: any = {}): Promise<any> {
  try {
    switch (toolName) {
      case 'getSalesSummary':
        return await getSalesSummary(restaurantId, args);
      case 'getSalesTrend':
        return await getSalesTrend(restaurantId, args);
      case 'getHourlySales':
        return await getHourlySales(restaurantId, args);
      case 'getTopProducts':
        return await getTopProducts(restaurantId, args);
      case 'getBottomProducts':
        return await getBottomProducts(restaurantId, args);
      case 'getCategoryPerformance':
        return await getCategoryPerformance(restaurantId, args);
      case 'getAverageOrderValue':
        return await getAverageOrderValue(restaurantId, args);
      case 'getCancellationRate':
        return await getCancellationRate(restaurantId, args);
      case 'comparePeriods':
        return await comparePeriods(restaurantId, args);
      case 'getInventorySummary':
        return await getInventorySummary(restaurantId);
      case 'searchRestaurantKnowledge':
        return await searchRestaurantKnowledge(restaurantId, args);
      case 'getHolidays':
        return await getHolidays(restaurantId, args);
      case 'getWeather':
        return await getWeatherTool(restaurantId, args);
      case 'getTableOccupancy':
        return await getTableOccupancy(restaurantId, args);
      case 'getTableTurnover':
        return await getTableTurnover(restaurantId, args);
      case 'getAverageTableTurnTime':
        return await getAverageTableTurnTime(restaurantId, args);
      case 'getTableUtilization':
        return await getTableUtilization(restaurantId, args);
      case 'getTableUsageByHour':
        return await getTableUsageByHour(restaurantId, args);
      case 'getTablePerformance':
        return await getTablePerformance(restaurantId, args);
      case 'getTopTablesByRevenue':
        return await getTopTablesByRevenue(restaurantId, args);
      case 'getBottomTablesByRevenue':
        return await getBottomTablesByRevenue(restaurantId, args);
      case 'getTableCapacityPerformance':
        return await getTableCapacityPerformance(restaurantId, args);
      case 'getRevenuePerTableHour':
        return await getRevenuePerTableHour(restaurantId, args);
      default:
        return { error: `Unknown tool function name: ${toolName}` };
    }
  } catch (err: any) {
    console.error(`Error executing analyst tool ${toolName}:`, err);
    return { error: err.message || `Failed to execute tool ${toolName}` };
  }
}
