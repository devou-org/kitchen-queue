const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL);

async function run() {
  console.log("Starting menu fields migration...");
  try {
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'restaurants';
    `;
    console.log("Restaurants table check result:", tables);

    if (tables.length > 0) {
      console.log("Table 'restaurants' exists. Running ALTER TABLE queries...");
      await sql`
        ALTER TABLE restaurants 
        ADD COLUMN IF NOT EXISTS menu_title VARCHAR(200) DEFAULT 'Today''s Specials',
        ADD COLUMN IF NOT EXISTS menu_description TEXT DEFAULT 'Hand-curated coastal delicacies prepared with traditional recipes.';
      `;
      console.log("Migration columns menu_title and menu_description added successfully!");
    } else {
      console.log("Error: 'restaurants' table does not exist!");
    }
  } catch (error) {
    console.error("Migration failed:", error);
  }
}

run();
