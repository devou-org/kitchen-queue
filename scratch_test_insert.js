const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });
const pool = new Pool({ connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL });

async function testInsert() {
  try {
    await pool.query(
      `INSERT INTO categories (restaurant_id, name, sort_order) VALUES ($1, $2, 10)`,
      ['3564690a-fdce-4338-9a9d-ca34b2e1ff36', 'Beverages']
    );
    console.log('Inserted Beverages for sb successfully!');
  } catch (err) {
    console.error('Failed to insert Beverages for sb:', err.message, err.constraint);
  }
  await pool.end();
}
testInsert().catch(console.error);
