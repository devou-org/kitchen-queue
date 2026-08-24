import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { Pool } from 'pg';
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function printSummary() {
  const restId = '3564690a-fdce-4338-9a9d-ca34b2e1ff36';

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
  console.log('SALES:');
  console.log(JSON.stringify(sales.rows, null, 2));

  const topProd = await pool.query(
    `SELECT p.name, sum(oi.quantity)::int as qty_sold, sum(oi.quantity * oi.price_at_purchase)::numeric as revenue
     FROM order_items oi
     JOIN products p ON p.id = oi.product_id
     JOIN orders o ON o.id = oi.order_id
     WHERE o.restaurant_id = $1 AND o.business_date = '2026-08-24' AND o.status = 'PAID'
     GROUP BY p.name ORDER BY qty_sold DESC LIMIT 5`,
    [restId]
  );
  console.log('TOP PRODUCTS TODAY:');
  console.log(JSON.stringify(topProd.rows, null, 2));

  process.exit(0);
}

printSummary().catch(e => { console.error(e); process.exit(1); });
