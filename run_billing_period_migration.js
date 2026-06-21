const { Pool } = require('pg');
const fs = require('fs');
const dotenv = require('dotenv');

if (fs.existsSync('.env.local')) {
  const envConfig = dotenv.parse(fs.readFileSync('.env.local'));
  for (const k in envConfig) {
    process.env[k] = envConfig[k];
  }
}

const dbUrl = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/postgres";
const dbPool = new Pool({ connectionString: dbUrl });

async function run() {
  try {
    await dbPool.query(`
      ALTER TABLE restaurants 
      ADD COLUMN IF NOT EXISTS billing_period VARCHAR(20) DEFAULT 'MONTHLY';
    `);
    console.log('Successfully migrated billing_period column.');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    dbPool.end();
  }
}

run();
