import { sql } from '@vercel/postgres'; // No, wait. 
import { Pool } from 'pg';
const pool = new Pool({
  connectionString: 'postgres://postgres:SminLCa9cvGJgUc4rYjQYOfvQaHKdVDdJRMiCEtfbpvyLMfqamS9NvqU6ND6x3rf@51.79.161.180:5432/postgres'
});

async function main() {
  const restaurantId = 'ad784341-6775-4d43-99df-888553679aaa'; // testcafe
  const dateFrom = '2026-06-23';
  const dateTo = '2026-06-23';
  const localTimezone = 'Asia/Kolkata';

  console.log("Fetching order stats...");
  const resStats = await pool.query(`
    SELECT 
      COUNT(*)::int as total_orders,
      COUNT(*) FILTER (WHERE status = 'PAID')::int as paid_orders,
      COALESCE(SUM(total_price) FILTER (WHERE status != 'CANCELLED'), 0) as total_revenue,
      COALESCE(SUM(total_price) FILTER (WHERE status = 'PAID'), 0) as total_paid_revenue
    FROM orders
    WHERE restaurant_id = $1 AND DATE(created_at AT TIME ZONE $2) >= $3::date
      AND DATE(created_at AT TIME ZONE $2) <= $4::date
  `, [restaurantId, localTimezone, dateFrom, dateTo]);
  
  console.log("Stats:", resStats.rows[0]);
  
  process.exit(0);
}
main().catch(console.error);
