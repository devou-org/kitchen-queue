const { neon } = require('@neondatabase/serverless');
const url = "postgresql://neondb_owner:npg_kj6aVQi4DGRT@ep-young-voice-a1ih57cv-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";
const sql = neon(url);

async function run() {
  try {
    const r = await sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'orders'`;
    console.log(r.map(c => c.column_name));
  } catch (err) {
    console.error(err);
  }
}
run();
