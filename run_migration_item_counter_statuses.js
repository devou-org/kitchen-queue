const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

if (!process.env.DATABASE_URL) {
  require('dotenv').config({ path: '.env' });
}

if (!process.env.DATABASE_URL) {
  console.error('❌ Error: DATABASE_URL environment variable is not defined.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function runMigration() {
  console.log('🚀 Running Item & Counter Status Architecture Migration...\n');
  const client = await pool.connect();

  try {
    const migrationPath = path.join(__dirname, 'migrations', '20260929_item_counter_statuses.sql');
    if (!fs.existsSync(migrationPath)) {
      console.error(`❌ Migration file not found: ${migrationPath}`);
      process.exit(1);
    }

    console.log('📄 Executing migrations/20260929_item_counter_statuses.sql...');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    await client.query(sql);

    console.log('✅ Migration executed successfully!\n');

    const res = await client.query(`
      SELECT oi.order_id, oi.product_id, oi.counter, oi.status, oi.quantity, p.name as product_name
      FROM order_items oi
      JOIN products p ON p.id = oi.product_id
      ORDER BY oi.id DESC
      LIMIT 10;
    `);

    console.log('=== SAMPLE UPDATED ORDER ITEMS ===');
    console.table(res.rows);

  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
