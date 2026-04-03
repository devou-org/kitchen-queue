const { neon } = require('@neondatabase/serverless');
require('dotenv').config();

async function check() {
  const sql = neon(process.env.DATABASE_URL);
  const rows = await sql`SELECT * FROM orders ORDER BY created_at DESC LIMIT 5`;
  console.log('Last 5 orders:', JSON.stringify(rows, null, 2));
}

check();
