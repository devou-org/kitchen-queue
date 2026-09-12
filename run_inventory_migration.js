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

async function runInventoryMigration() {
  console.log('🚀 Running Qdine Inventory System Database Migration...\n');
  const client = await pool.connect();

  try {
    const migrationPath = path.join(__dirname, 'migrations', '20260912_inventory_system.sql');
    if (!fs.existsSync(migrationPath)) {
      console.error(`❌ Migration file not found: ${migrationPath}`);
      process.exit(1);
    }

    console.log(`📄 Executing migrations/20260912_inventory_system.sql...`);
    const sql = fs.readFileSync(migrationPath, 'utf8');

    await client.query(sql);

    console.log('\n🎉 Inventory tables created successfully:');
    console.log('   - inventory_categories');
    console.log('   - inventory_units');
    console.log('   - suppliers');
    console.log('   - inventory_items');
    console.log('   - inventory_batches');
    console.log('   - stock_movements');
    console.log('   - purchase_orders');
    console.log('   - purchase_order_items');
    console.log('   - wastages');
    console.log('   - stock_adjustments');
    console.log('   - recipes');
    console.log('   - recipe_items');
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runInventoryMigration();

