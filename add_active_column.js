const { neon } = require('@neondatabase/serverless');

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("No DATABASE_URL");
  process.exit(1);
}

const sql = neon(url);

async function run() {
  try {
    await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;`;
    console.log("Successfully added is_active column");
  } catch (err) {
    console.error("Error migrating table:", err);
  }
}

run();
