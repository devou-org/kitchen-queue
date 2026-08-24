import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { Pool } from 'pg';
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function fixIsPaid() {
  const res = await pool.query(
    `UPDATE orders SET is_paid = true WHERE status = 'PAID' AND (is_paid IS NOT true)`
  );
  console.log(`Updated ${res.rowCount} orders to set is_paid = true where status = 'PAID'`);
  process.exit(0);
}

fixIsPaid().catch(e => { console.error(e); process.exit(1); });
