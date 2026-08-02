const { Client } = require('pg');
const client = new Client({ connectionString: 'postgres://postgres:SminLCa9cvGJgUc4rYjQYOfvQaHKdVDdJRMiCEtfbpvyLMfqamS9NvqU6ND6x3rf@51.79.161.180:5432/qdine_test' });

async function check() {
  await client.connect();
  const res = await client.query(`SELECT * FROM monthly_billing_summary WHERE restaurant_id = '3564690a-fdce-4338-9a9d-ca34b2e1ff36'`);
  console.log('SUMMARIES:', res.rows);
  const txs = await client.query(`SELECT * FROM billing_transactions WHERE restaurant_id = '3564690a-fdce-4338-9a9d-ca34b2e1ff36'`);
  console.log('TRANSACTIONS:', txs.rows);
  process.exit(0);
}
check();
