import { Pool } from '@neondatabase/serverless';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function runMigration() {
  try {
    const query = fs.readFileSync('migration_channels.sql', 'utf8');
    
    // Execute the full migration script
    await pool.query(query);
    console.log('✅ Migration channels completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
