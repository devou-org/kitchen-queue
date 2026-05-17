const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not defined in .env.local");
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);

async function run() {
  console.log("Starting menu_layout column migration...");
  try {
    // Add menu_layout column to restaurants
    await sql`
      ALTER TABLE restaurants 
      ADD COLUMN IF NOT EXISTS menu_layout VARCHAR(20) DEFAULT 'LIST';
    `;
    console.log("Migration successful: column menu_layout added to restaurants table!");
    
    // Set default value for existing rows
    await sql`
      UPDATE restaurants 
      SET menu_layout = 'LIST' 
      WHERE menu_layout IS NULL;
    `;
    console.log("Updated existing rows to default 'LIST' menu_layout!");

  } catch (error) {
    console.error("Migration failed:", error);
  }
}

run();
