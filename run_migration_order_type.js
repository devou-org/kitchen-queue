require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const fs = require('fs');

async function runMigration() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  try {
    await client.connect();
    const query = fs.readFileSync('migration_order_type.sql', 'utf8');
    await client.query(query);
    console.log('✅ Order Type Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration();
