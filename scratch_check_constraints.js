const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });
const pool = new Pool({ connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL });

async function checkConstraints() {
  const constraints = await pool.query(`
    SELECT conname, contype, pg_get_constraintdef(c.oid)
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'categories'
  `);
  console.log('Constraints on categories:', constraints.rows);

  const indexes = await pool.query(`
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE tablename = 'categories'
  `);
  console.log('Indexes on categories:', indexes.rows);

  // Let's also test running just the SELECT part without INSERT
  const selectRes = await pool.query(`
    SELECT 
      p.restaurant_id,
      TRIM(p.category) as name
    FROM products p
    WHERE p.restaurant_id = '3564690a-fdce-4338-9a9d-ca34b2e1ff36'
      AND p.category IS NOT NULL 
      AND TRIM(p.category) != ''
    GROUP BY p.restaurant_id, TRIM(p.category)
  `);
  console.log('SELECT part result:', selectRes.rows);

  await pool.end();
}
checkConstraints().catch(console.error);
