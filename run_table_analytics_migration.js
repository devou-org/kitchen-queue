const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function runMigration() {
  console.log('Running migration_table_analytics.sql...');
  try {
    const sqlContent = fs.readFileSync(path.join(__dirname, 'migration_table_analytics.sql'), 'utf8');
    await pool.query(sqlContent);
    console.log('✅ migration_table_analytics.sql executed successfully!');
  } catch (err) {
    console.error('❌ Migration failed:', err);
  } finally {
    await pool.end();
  }
}

runMigration();
