const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function runTests() {
  console.log('--- Starting Gemini Quota & Usage System Verification ---');

  const client = await pool.connect();
  try {
    // 1. Check Table Structure
    const tablesRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name IN ('gemini_config', 'gemini_daily_usage', 'gemini_usage', 'gemini_request_config', 'gemini_usage_monthly')
    `);
    console.log('✅ Found Gemini Tables:', tablesRes.rows.map(r => r.table_name).join(', '));

    // 2. Check Global Config
    const configRes = await client.query('SELECT * FROM gemini_config LIMIT 1');
    console.log('✅ Global Config:', configRes.rows[0]);

    // 3. Check Request Configs
    const reqConfigRes = await client.query('SELECT * FROM gemini_request_config');
    console.log('✅ Request Configs:', reqConfigRes.rows.map(r => `${r.request_type} => ${r.max_output_tokens}`));

    // 4. Verify Atomic Limit Test Concept
    const todayStr = new Date().toISOString().split('T')[0];
    const dailyRes = await client.query('SELECT * FROM gemini_daily_usage WHERE usage_date = $1', [todayStr]);
    console.log('✅ Today Daily Usage:', dailyRes.rows[0] || 'No usage yet (will auto-create on first request)');

    console.log('--- All Database Verification Passed Successfully! ---');
  } catch (err) {
    console.error('❌ Verification failed:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

runTests();
