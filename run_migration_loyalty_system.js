const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const envPath = path.join(__dirname, '.env');
let connectionString = process.env.DATABASE_URL;

if (!connectionString && fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const match = envContent.match(/^DATABASE_URL=(.+)$/m);
  if (match) {
    connectionString = match[1].trim().replace(/^["']|["']$/g, '');
  }
}

if (!connectionString) {
  console.error('DATABASE_URL not found.');
  process.exit(1);
}

async function tryQuery(useSsl) {
  const pool = new Pool({
    connectionString,
    ssl: useSsl ? { rejectUnauthorized: false } : false,
  });

  try {
    const sqlContent = fs.readFileSync(path.join(__dirname, 'migrations', '20260926_loyalty_system.sql'), 'utf8');
    await pool.query(sqlContent);
    console.log(`Migration executed successfully (ssl: ${useSsl}).`);
    return true;
  } catch (err) {
    console.error(`Attempt with ssl=${useSsl} failed:`, err.message);
    return false;
  } finally {
    await pool.end();
  }
}

async function main() {
  console.log('Running Loyalty System DB migration...');
  let ok = await tryQuery(false);
  if (!ok) {
    await tryQuery(true);
  }
}

main();
