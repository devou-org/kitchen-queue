const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });
const pool = new Pool({ connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL });

async function testGetCategories() {
  const restaurantId = '3564690a-fdce-4338-9a9d-ca34b2e1ff36';
  
  // Let's run the exact queries in getCategories(restaurantId)
  console.log('Running auto-sync query...');
  try {
    const syncRes = await pool.query(`
      INSERT INTO categories (restaurant_id, name, sort_order)
      SELECT 
        p.restaurant_id,
        TRIM(p.category) as name,
        COALESCE((SELECT MAX(sort_order) FROM categories WHERE restaurant_id = p.restaurant_id), 0) + 10 as sort_order
      FROM products p
      WHERE p.restaurant_id = $1
        AND p.category IS NOT NULL 
        AND TRIM(p.category) != ''
        AND NOT EXISTS (
          SELECT 1 FROM categories c 
          WHERE c.restaurant_id = p.restaurant_id 
            AND LOWER(c.name) = LOWER(TRIM(p.category))
        )
      GROUP BY p.restaurant_id, TRIM(p.category)
      ON CONFLICT DO NOTHING
      RETURNING *
    `, [restaurantId]);
    console.log('Sync inserted:', syncRes.rows);
  } catch (err) {
    console.error('Sync failed:', err);
  }

  const rows = await pool.query('SELECT * FROM categories WHERE restaurant_id = $1 ORDER BY sort_order ASC, name ASC', [restaurantId]);
  console.log('Categories after sync:', rows.rows);

  await pool.end();
}
testGetCategories().catch(console.error);
