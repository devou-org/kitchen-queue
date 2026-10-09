const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  try {
    console.log("Running migration...");

    // 1. Add columns to restaurants
    await pool.query(`
      ALTER TABLE restaurants
      ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'Asia/Kolkata',
      ADD COLUMN IF NOT EXISTS opening_time TIME DEFAULT '09:00:00',
      ADD COLUMN IF NOT EXISTS closing_time TIME DEFAULT '22:00:00',
      ADD COLUMN IF NOT EXISTS rollover_time TIME DEFAULT '00:00:00';
    `);
    console.log("Added new columns to restaurants table.");

    // 2. Add business_date to queues
    await pool.query(`
      ALTER TABLE queues
      ADD COLUMN IF NOT EXISTS business_date DATE DEFAULT CURRENT_DATE;
    `);
    console.log("Added business_date column to queues table.");

    // Update existing queues where business_date is still default CURRENT_DATE but they were created earlier
    // For existing data, we can just cast created_at to DATE
    await pool.query(`
      UPDATE queues 
      SET business_date = DATE(created_at AT TIME ZONE 'Asia/Kolkata')
      WHERE business_date = CURRENT_DATE AND DATE(created_at AT TIME ZONE 'Asia/Kolkata') != CURRENT_DATE;
    `);
    console.log("Updated business_date for existing queues.");

    console.log("Migration complete.");
  } catch (error) {
    console.error("Migration failed:", error);
  } finally {
    pool.end();
  }
}

run();
