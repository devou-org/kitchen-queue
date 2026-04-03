const { neon } = require('@neondatabase/serverless');

const url = "postgresql://neondb_owner:npg_kj6aVQi4DGRT@ep-young-voice-a1ih57cv-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";
const sql = neon(url);

async function run() {
  try {
    const rows = await sql('SELECT * FROM orders ORDER BY created_at DESC LIMIT 5');
    console.log(JSON.stringify(rows, null, 2));
  } catch (err) {
    console.error(err);
  }
}

run();
