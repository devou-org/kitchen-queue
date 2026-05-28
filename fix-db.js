require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.DATABASE_URL);

async function main() {
  await sql`DROP TABLE IF EXISTS restaurant_channels CASCADE`;
  console.log("Table restaurant_channels dropped successfully.");
}
main().catch(console.error);
