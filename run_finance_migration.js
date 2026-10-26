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

async function runFinanceMigration() {
  console.log('🚀 Running QDine Finance Module Database Migration...\n');
  const client = await pool.connect();

  try {
    const migrationPath = path.join(__dirname, 'migrations', '20261019_finance_module.sql');
    if (!fs.existsSync(migrationPath)) {
      console.error(`❌ Migration file not found: ${migrationPath}`);
      process.exit(1);
    }

    console.log(`📄 Executing migrations/20261019_finance_module.sql...`);
    const sql = fs.readFileSync(migrationPath, 'utf8');

    await client.query(sql);

    console.log('\n🎉 Finance Module tables created successfully:');
    console.log('   - finance_transactions');
    console.log('   - finance_till_reconciliations');
    console.log('   - finance_daily_summaries');
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runFinanceMigration();
