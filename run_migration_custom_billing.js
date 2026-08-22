import { Pool } from 'pg';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function runMigration() {
  try {
    const query = fs.readFileSync('migration_custom_billing.sql', 'utf8');
    await pool.query(query);
    console.log('✅ Migration custom billing completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
