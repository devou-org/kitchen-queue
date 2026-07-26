require('dotenv').config({path: '.env.local'});
const { Client } = require('pg');

async function check() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const res = await client.query("SELECT column_name, data_type, column_default FROM information_schema.columns WHERE table_name = 'orders'");
  console.log(res.rows);
  await client.end();
}

check().catch(console.error);
