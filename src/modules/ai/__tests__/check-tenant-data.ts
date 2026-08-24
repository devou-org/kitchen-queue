import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { Pool } from 'pg';
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function checkData() {
  const restId = '3564690a-fdce-4338-9a9d-ca34b2e1ff36';

  const res = await pool.query(
    `SELECT business_date::text, count(*)::int as orders_count, sum(total_price) filter (where status='PAID')::numeric as revenue FROM orders WHERE restaurant_id = $1 GROUP BY business_date ORDER BY business_date DESC LIMIT 10`,
    [restId]
  );
  console.log('Current Orders Seeded:');
  console.table(res.rows);

  const total = await pool.query(`SELECT count(*)::int as total_orders FROM orders WHERE restaurant_id = $1`, [restId]);
  console.log('Total Orders Count:', total.rows[0].total_orders);

  process.exit(0);
}

checkData().catch(e => { console.error(e); process.exit(1); });
