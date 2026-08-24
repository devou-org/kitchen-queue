import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { Pool } from 'pg';
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function getTestDataSheet() {
  const restId = '3564690a-fdce-4338-9a9d-ca34b2e1ff36';

  // 1. Sales today vs yesterday
  const sales = await pool.query(
    `SELECT business_date::text, 
            count(*)::int as total_orders, 
            count(*) filter (where status='PAID')::int as paid_orders,
            count(*) filter (where status='CANCELLED')::int as cancelled_orders,
            coalesce(sum(total_price) filter (where status='PAID'), 0)::numeric as paid_revenue,
            coalesce(avg(total_price) filter (where status='PAID'), 0)::numeric as aov
     FROM orders 
     WHERE restaurant_id = $1 AND business_date IN ('2026-08-24', '2026-08-23')
     GROUP BY business_date ORDER BY business_date DESC`,
    [restId]
  );
  console.log('=== 1. Sales Summary (Today vs Yesterday) ===');
  console.table(sales.rows);

  // 2. Top products today
  const topProd = await pool.query(
    `SELECT p.name, sum(oi.quantity)::int as qty_sold, sum(oi.quantity * oi.price_at_purchase)::numeric as revenue
     FROM order_items oi
     JOIN products p ON p.id = oi.product_id
     JOIN orders o ON o.id = oi.order_id
     WHERE o.restaurant_id = $1 AND o.business_date = '2026-08-24' AND o.status = 'PAID'
     GROUP BY p.name ORDER BY qty_sold DESC LIMIT 5`,
    [restId]
  );
  console.log('=== 2. Top Products Today (2026-08-24) ===');
  console.table(topProd.rows);

  // 3. Inventory low / out of stock
  const inv = await pool.query(
    `SELECT name, category, stock_quantity, buffer_quantity, status FROM products WHERE restaurant_id = $1 AND status IN ('LOW_STOCK', 'OUT_OF_STOCK')`,
    [restId]
  );
  console.log('=== 3. Low/Out of Stock Products ===');
  console.table(inv.rows);

  // 4. Hourly sales peak today
  const hourly = await pool.query(
    `SELECT extract(hour from created_at)::int as hour, count(*)::int as orders, sum(total_price) filter (where status='PAID')::numeric as revenue
     FROM orders WHERE restaurant_id = $1 AND business_date = '2026-08-24'
     GROUP BY extract(hour from created_at) ORDER BY revenue DESC LIMIT 3`,
    [restId]
  );
  console.log('=== 4. Peak Hourly Sales Today ===');
  console.table(hourly.rows);

  // 5. Holidays
  const hol = await pool.query(
    `SELECT name, holiday_date::text, holiday_type FROM holidays WHERE holiday_date >= '2026-08-24' LIMIT 2`
  );
  console.log('=== 5. Upcoming Holidays ===');
  console.table(hol.rows);

  process.exit(0);
}

getTestDataSheet().catch(e => { console.error(e); process.exit(1); });
