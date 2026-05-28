require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.DATABASE_URL);

async function main() {
  const cols = await sql`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'restaurant_channels'`;
  console.log("COLUMNS:", cols);
}
main().catch(console.error);
