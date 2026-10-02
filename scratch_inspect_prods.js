const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });
const pool = new Pool({ connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL });

async function check() {
  const cats = await pool.query('SELECT * FROM categories WHERE restaurant_id = $1', ['3564690a-fdce-4338-9a9d-ca34b2e1ff36']);
  console.log('Categories for sb in categories table:', cats.rows);
  
  const distinctProdCats = await pool.query(
    'SELECT DISTINCT category, count(*) FROM products WHERE restaurant_id = $1 GROUP BY category',
    ['3564690a-fdce-4338-9a9d-ca34b2e1ff36']
  );
  console.log('Distinct categories in products table for sb:', distinctProdCats.rows);

  await pool.end();
}
check().catch(console.error);
