const { neon } = require('@neondatabase/serverless');
const url = "postgresql://neondb_owner:npg_kj6aVQi4DGRT@ep-young-voice-a1ih57cv-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";
const sql = neon(url);

const fs = require('fs');
async function f() {
  try {
    const r = await sql`SELECT column_name, data_type, column_default FROM information_schema.columns WHERE table_name = 'orders'`;
    fs.writeFileSync('schema_output.json', JSON.stringify(r, null, 2));
    console.log('Schema with defaults written to schema_output.json');
  } catch (err) {
    console.error(err);
  }
}
f();
