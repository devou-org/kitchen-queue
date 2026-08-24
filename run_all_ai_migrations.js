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
  connectionString: process.env.DATABASE_URL
});

const migrationFiles = [
  'migration_gemini_quota.sql',
  'migration_ai_analyst.sql',
  'migration_weather_holidays.sql'
];

async function runAllAIMigrations() {
  console.log('🚀 Starting Qdine AI Business Analyst Database Migrations...\n');
  const client = await pool.connect();

  try {
    for (const fileName of migrationFiles) {
      const filePath = path.join(__dirname, fileName);
      if (!fs.existsSync(filePath)) {
        console.warn(`⚠️ Warning: Migration file not found: ${fileName}, skipping...`);
        continue;
      }

      console.log(`📄 Executing ${fileName}...`);
      const sql = fs.readFileSync(filePath, 'utf8');

      await client.query('BEGIN');
      await client.query(sql);
      await client.query('COMMIT');

      console.log(`   ✅ ${fileName} applied successfully!\n`);
    }

    console.log('🎉 All AI Business Analyst migrations completed successfully!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runAllAIMigrations();
