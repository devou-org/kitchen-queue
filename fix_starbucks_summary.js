const { Client } = require('pg');
const client = new Client({ connectionString: 'postgres://postgres:SminLCa9cvGJgUc4rYjQYOfvQaHKdVDdJRMiCEtfbpvyLMfqamS9NvqU6ND6x3rf@51.79.161.180:5432/qdine_test' });

async function fixData() {
  await client.connect();
  const starbucksId = '3564690a-fdce-4338-9a9d-ca34b2e1ff36';
  
  // Merge month 8 (August) back into month 7 (July) since cycle runs Jul 5 - Aug 5
  await client.query(`
    UPDATE monthly_billing_summary
    SET 
      order_charges = order_charges + 7.56,
      otp_charges = otp_charges + 0.50,
      total_amount = total_amount + 8.06,
      status = 'UNPAID'
    WHERE restaurant_id = $1 AND month = 7 AND year = 2026
  `, [starbucksId]);

  await client.query(`
    DELETE FROM monthly_billing_summary
    WHERE restaurant_id = $1 AND month = 8 AND year = 2026
  `, [starbucksId]);

  console.log('Database summary data corrected for Starbucks active cycle (Jul 5 - Aug 5).');
  process.exit(0);
}
fixData();
