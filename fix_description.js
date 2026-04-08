const { neon } = require('@neondatabase/serverless');
const url = "postgresql://neondb_owner:npg_kj6aVQi4DGRT@ep-young-voice-a1ih57cv-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";
const sql = neon(url);

async function run() {
  try {
    console.log('Adding description column to products...');
    await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS description TEXT`;
    console.log('Column added or already exists.');
  } catch (err) {
    console.error('Error adding column:', err);
  }
}
run();
