const { neon } = require('@neondatabase/serverless');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });
const sql = neon(process.env.DATABASE_URL);
async function run() {
  await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS dietary_preference VARCHAR(20);`;
  console.log('done');
}
run();
