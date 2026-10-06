/**
 * PostgreSQL Database Migration Runner
 * 
 * Usage:
 *   node run_migrations.js                 -> Runs all pending migrations in /migrations in chronological order
 *   node run_migrations.js --force         -> Re-runs all migrations even if previously recorded
 *   node run_migrations.js <file1> <file2> -> Runs specific migration file(s)
 */

const fs = require('fs');
const path = require('path');

// 1. Resolve environment variables (.env.local, .env)
const envLocalPath = path.resolve(__dirname, '.env.local');
const envPath = path.resolve(__dirname, '.env');

if (fs.existsSync(envLocalPath)) {
  require('dotenv').config({ path: envLocalPath });
} else if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
} else {
  require('dotenv').config();
}

// Fallback direct parser for DATABASE_URL if dotenv didn't load
if (!process.env.DATABASE_URL) {
  for (const envFile of [envLocalPath, envPath]) {
    if (fs.existsSync(envFile)) {
      const lines = fs.readFileSync(envFile, 'utf8').split('\n');
      for (const line of lines) {
        const match = line.match(/^\s*DATABASE_URL\s*=\s*["']?([^"'\r\n]+)["']?/);
        if (match) {
          process.env.DATABASE_URL = match[1].trim();
          break;
        }
      }
      if (process.env.DATABASE_URL) break;
    }
  }
}

if (!process.env.DATABASE_URL) {
  console.error('❌ Error: DATABASE_URL is not set in environment or .env.local file.');
  process.exit(1);
}

const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
});

async function setupMigrationTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS _schema_migrations (
      id SERIAL PRIMARY KEY,
      filename VARCHAR(255) UNIQUE NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

async function getAppliedMigrations(client) {
  const res = await client.query('SELECT filename FROM _schema_migrations ORDER BY id ASC');
  return new Set(res.rows.map(r => r.filename));
}

async function run() {
  const args = process.argv.slice(2);
  const isForce = args.includes('--force') || args.includes('-f');
  const specificFiles = args.filter(a => !a.startsWith('-'));

  const migrationsDir = path.resolve(__dirname, 'migrations');
  if (!fs.existsSync(migrationsDir)) {
    console.error(`❌ Migrations directory not found at: ${migrationsDir}`);
    process.exit(1);
  }

  // Determine list of files to run
  let targetFiles = [];
  if (specificFiles.length > 0) {
    targetFiles = specificFiles.map(f => path.basename(f)).filter(f => f.endsWith('.sql'));
  } else {
    targetFiles = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
  }

  // Mask database URL for safe logging
  const maskedUrl = process.env.DATABASE_URL.replace(/:\/\/([^:]+):([^@]+)@/, '://$1:****@');

  console.log('================================================================');
  console.log('🚀  PostgreSQL Database Migration Runner');
  console.log('================================================================');
  console.log(`📡 Database: ${maskedUrl}`);
  console.log(`📁 Directory: ${migrationsDir}`);
  console.log(`📄 Migrations queue (${targetFiles.length} files)`);
  if (isForce) console.log('⚠️  Mode: FORCE (re-running migrations)');
  console.log('----------------------------------------------------------------');

  const client = await pool.connect();

  try {
    await setupMigrationTable(client);
    const applied = await getAppliedMigrations(client);

    let executedCount = 0;
    let skippedCount = 0;

    for (let i = 0; i < targetFiles.length; i++) {
      const filename = targetFiles[i];
      const filePath = path.join(migrationsDir, filename);

      if (!fs.existsSync(filePath)) {
        console.error(`❌ Migration file not found: ${filePath}`);
        continue;
      }

      const isAlreadyApplied = applied.has(filename);

      if (isAlreadyApplied && !isForce) {
        console.log(`⏭️  [${i + 1}/${targetFiles.length}] Already applied: ${filename}`);
        skippedCount++;
        continue;
      }

      console.log(`⏳ [${i + 1}/${targetFiles.length}] Running: ${filename}...`);
      const sqlContent = fs.readFileSync(filePath, 'utf8');

      const start = Date.now();
      try {
        await client.query('BEGIN');
        await client.query(sqlContent);
        
        await client.query(`
          INSERT INTO _schema_migrations (filename, applied_at)
          VALUES ($1, CURRENT_TIMESTAMP)
          ON CONFLICT (filename) DO UPDATE SET applied_at = CURRENT_TIMESTAMP
        `, [filename]);
        
        await client.query('COMMIT');
        const duration = Date.now() - start;
        console.log(`✅ [${i + 1}/${targetFiles.length}] Applied: ${filename} (${duration}ms)`);
        executedCount++;
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`\n❌ Error applying migration "${filename}":`);
        console.error(err.message || err);
        console.error('\n🛑 Migration aborted. Rolled back current transaction.');
        process.exit(1);
      }
    }

    console.log('----------------------------------------------------------------');
    console.log(`🎉 Finished! Successfully applied: ${executedCount}, Skipped: ${skippedCount}`);
    console.log('================================================================\n');
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(err => {
  console.error('Fatal migration error:', err);
  process.exit(1);
});
