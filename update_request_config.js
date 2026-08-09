const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function run() {
  await pool.query(
    "UPDATE gemini_request_config SET max_output_tokens = 4000 WHERE request_type = 'MENU_EXTRACTION'"
  );
  console.log('✅ Updated MENU_EXTRACTION max_output_tokens to 4000');
  await pool.end();
}

run();
