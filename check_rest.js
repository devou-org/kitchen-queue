const { pool } = require('./src/lib/db');

async function check() {
  const res = await pool.query(`SELECT id, name, billing_start_date, billing_end_date, billing_status FROM restaurants`);
  console.log(res.rows);
  process.exit(0);
}
check();
