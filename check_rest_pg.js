const { Client } = require('pg');
const client = new Client({ connectionString: 'postgres://postgres:SminLCa9cvGJgUc4rYjQYOfvQaHKdVDdJRMiCEtfbpvyLMfqamS9NvqU6ND6x3rf@51.79.161.180:5432/qdine_test' });

async function check() {
  await client.connect();
  const res = await client.query(`SELECT id, name, billing_start_date, billing_end_date, billing_status FROM restaurants`);
  console.log(res.rows);
  process.exit(0);
}
check();
