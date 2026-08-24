const { Pool } = require('pg');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function runMigration() {
  try {
    const sql = fs.readFileSync('migration_ai_analyst.sql', 'utf8');
    await pool.query(sql);
    console.log('✅ AI Analyst Chat migration executed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await pool.end();
  }
}

runMigration();
