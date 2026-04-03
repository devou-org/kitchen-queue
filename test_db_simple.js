require('dotenv').config();
const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.DATABASE_URL);

async function test() {
  try {
    console.log('Testing DB connection...');
    const result = await sql`SELECT 1 as success`;
    console.log('Result:', result);
    const products = await sql`SELECT count(*) FROM products`;
    console.log('Product count:', products);
  } catch (e) {
    console.error('DB Error:', e);
  }
}
test();
