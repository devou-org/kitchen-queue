const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function updateGeminiModel() {
  const targetModel = 'gemini-3.5-flash-lite';
  console.log(`Updating Gemini global configuration model to: ${targetModel}...`);

  try {
    const res = await pool.query(
      `UPDATE gemini_config 
       SET model = $1, updated_at = CURRENT_TIMESTAMP 
       RETURNING *`,
      [targetModel]
    );

    if (res.rows.length > 0) {
      console.log('✅ gemini_config table updated successfully:');
      console.log(res.rows[0]);
    } else {
      console.log('⚠️ No row found in gemini_config. Inserting default row...');
      const insertRes = await pool.query(
        `INSERT INTO gemini_config (model, rpm_limit, tpm_limit, rpd_limit, max_output_tokens, is_enabled)
         VALUES ($1, 15, 200000, 1500, 2000, true)
         RETURNING *`,
        [targetModel]
      );
      console.log('✅ Inserted default row into gemini_config:');
      console.log(insertRes.rows[0]);
    }
  } catch (err) {
    console.error('❌ Error updating database gemini_config table:', err);
  } finally {
    await pool.end();
  }
}

updateGeminiModel();
