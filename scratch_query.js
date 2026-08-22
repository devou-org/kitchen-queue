const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function migrate() {
  await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50);`);
  console.log("Migration successful: Added payment_method to orders table.");
  process.exit(0);
}

migrate().catch(console.error);
