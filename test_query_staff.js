const { Pool } = require('pg');
const pool = new Pool({
  connectionString: "postgresql://postgres:postgres@localhost:5432/postgres" // Or read from env
});

// Since Next.js uses .env.local, let's parse it manually or just use pg's default envs.
// Actually, let's read the DATABASE_URL from .env.local if present.
const fs = require('fs');
const dotenv = require('dotenv');
if (fs.existsSync('.env.local')) {
  const envConfig = dotenv.parse(fs.readFileSync('.env.local'));
  for (const k in envConfig) {
    process.env[k] = envConfig[k];
  }
}

const dbUrl = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/postgres";
const dbPool = new Pool({ connectionString: dbUrl });

dbPool.query('SELECT id, name, slug FROM restaurants', (err, res) => {
  if (err) {
    console.error(err);
  } else {
    console.log(res.rows);
  }
  dbPool.end();
});
