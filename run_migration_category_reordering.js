const { Pool } = require('pg');
const fs = require('fs');

let dbUrl = process.env.DATABASE_URL;
if (!dbUrl && fs.existsSync('.env')) {
  const envContent = fs.readFileSync('.env', 'utf8');
  const match = envContent.match(/DATABASE_URL=["']?([^"'\r\n]+)["']?/);
  if (match) dbUrl = match[1];
}

const pool = new Pool({ connectionString: dbUrl });

async function runMigration() {
  try {
    console.log('🔄 Executing category reordering migration...');
    const sqlScript = fs.readFileSync('migrations/20260918_category_reordering.sql', 'utf8');
    await pool.query(sqlScript);
    console.log('✅ Category reordering migration completed successfully!');

    const res = await pool.query('SELECT restaurant_id, name, sort_order FROM categories ORDER BY restaurant_id, sort_order LIMIT 20;');
    console.log('\n=== MIGRATED CATEGORIES SAMPLE ===');
    console.table(res.rows);

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
