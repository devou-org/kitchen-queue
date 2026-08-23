import { pool } from '@/lib/db';
import { getCurrentBusinessDate } from '@/lib/format';

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
  const { currentBusinessDate } = await getRestaurantContext(restaurantId);
  const dateFrom = params.date_from || currentBusinessDate;
  const dateTo = params.date_to || currentBusinessDate;

  const res = await pool.query(
    `SELECT 
       COUNT(*)::int as total_orders,
       COUNT(*) FILTER (WHERE status = 'PAID')::int as paid_orders,
       COUNT(*) FILTER (WHERE status = 'CANCELLED')::int as cancelled_orders,
       COALESCE(SUM(total_price) FILTER (WHERE status != 'CANCELLED'), 0)::numeric as gross_revenue,
       COALESCE(SUM(total_price) FILTER (WHERE status = 'PAID'), 0)::numeric as total_paid_revenue,
       COALESCE(SUM(subtotal) FILTER (WHERE status = 'PAID'), 0)::numeric as net_subtotal,
       COALESCE(SUM(gst_amount) FILTER (WHERE status = 'PAID'), 0)::numeric as gst_collected,
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

  return {
    date_from: dateFrom,
    date_to: dateTo,
    total_orders: totalOrders,
    paid_orders: Number(row.paid_orders || 0),
    cancelled_orders: cancelledOrders,
    cancellation_rate_percent: cancellationRatePercent,
    gross_revenue: Math.round(Number(row.gross_revenue) * 100) / 100,
    paid_revenue: Math.round(Number(row.total_paid_revenue) * 100) / 100,
    net_subtotal: Math.round(Number(row.net_subtotal) * 100) / 100,
    gst_collected: Math.round(Number(row.gst_collected) * 100) / 100,
    average_order_value: Math.round(Number(row.average_order_value) * 100) / 100
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
      default:
        return { error: `Unknown tool function name: ${toolName}` };
    }
  } catch (err: any) {
    console.error(`Error executing analyst tool ${toolName}:`, err);
    return { error: err.message || `Failed to execute tool ${toolName}` };
  }
}
