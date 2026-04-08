const { neon } = require('@neondatabase/serverless');
const url = "postgresql://neondb_owner:npg_kj6aVQi4DGRT@ep-young-voice-a1ih57cv-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";
const sql = neon(url);

async function run() {
  try {
    console.log('Adding columns to products if missing...');
    await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS description TEXT`;
    await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE`;
    console.log('Columns fixed.');
  } catch (err) {
    console.error('Error fixing columns:', err);
  }
}
run();
