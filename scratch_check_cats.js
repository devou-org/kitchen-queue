const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });
const pool = new Pool({ connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL });

async function check() {
  const cols = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'categories'");
  console.log('Categories columns:', cols.rows);
  
  const allCats = await pool.query("SELECT id, restaurant_id, name, sort_order FROM categories");
  console.log('All Categories in DB:', allCats.rows);

  const prods = await pool.query("SELECT p.restaurant_id, r.slug, p.category, count(p.id) as cnt FROM products p LEFT JOIN restaurants r ON r.id = p.restaurant_id GROUP BY p.restaurant_id, r.slug, p.category");
  console.log('Products categories:', prods.rows);

  await pool.end();
}
check().catch(console.error);
