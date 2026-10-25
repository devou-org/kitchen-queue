/**
 * Dedicated Migration Runner for Specified Migrations:
 * 1. 20261019_finance_module.sql
 * 2. 20261020_allow_nullable_phone_and_user_for_pos.sql
 * 3. 20261020_add_bill_printer_settings.sql
 * 4. 20261024_add_notes_to_order_items.sql
 * 
 * Usage:
 *   node run_specified_migrations.js          -> Runs any unapplied migrations among the 4
 *   node run_specified_migrations.js --force  -> Forces re-execution of all 4 migrations
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// 1. Load environment variables (.env.local first, fallback to .env)
const envLocalPath = path.resolve(process.cwd(), '.env.local');
const envPath = path.resolve(process.cwd(), '.env');

if (fs.existsSync(envLocalPath)) {
  require('dotenv').config({ path: envLocalPath });
} else if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
} else {
  require('dotenv').config();
}

// Fallback direct parser for DATABASE_URL if dotenv didn't capture it
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
  console.error('❌ Error: DATABASE_URL environment variable is not defined.');
  console.error('   Please ensure DATABASE_URL is set in .env.local or your environment.');
  process.exit(1);
}

const connectionString = process.env.DATABASE_URL;
const isSsl = connectionString.includes('sslmode=require') || process.env.NODE_ENV === 'production';

const pool = new Pool({
  connectionString,
  ssl: isSsl ? { rejectUnauthorized: false } : undefined,
});

// The 4 target migrations in chronological order
const TARGET_MIGRATIONS = [
  '20261019_finance_module.sql',
  '20261020_allow_nullable_phone_and_user_for_pos.sql',
  '20261020_add_bill_printer_settings.sql',
  '20261024_add_notes_to_order_items.sql',
];

async function ensureMigrationTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS _schema_migrations (
      id SERIAL PRIMARY KEY,
      filename VARCHAR(255) UNIQUE NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

async function getAppliedMigrations(client) {
  const res = await client.query('SELECT filename FROM _schema_migrations');
  return new Set(res.rows.map(r => r.filename));
}

async function runVerification(client) {
  console.log('\n🔍 Running Post-Migration Schema Verification...');
  console.log('----------------------------------------------------------------');

  try {
    // 1. Check finance tables
    const financeTablesRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name IN ('finance_transactions', 'finance_till_reconciliations', 'finance_daily_summaries')
      ORDER BY table_name;
    `);
    const foundFinanceTables = financeTablesRes.rows.map(r => r.table_name);
    console.log(`  📊 Finance Tables: ${foundFinanceTables.length}/3 found (${foundFinanceTables.join(', ')})`);

    // 2. Check orders & queues nullable columns
    const nullableRes = await client.query(`
      SELECT table_name, column_name, is_nullable 
      FROM information_schema.columns 
      WHERE (table_name = 'orders' AND column_name IN ('phone', 'user_id'))
         OR (table_name = 'queues' AND column_name = 'user_id')
      ORDER BY table_name, column_name;
    `);
    console.log('  📞 POS Nullable Columns:');
    nullableRes.rows.forEach(r => {
      console.log(`     • ${r.table_name}.${r.column_name}: is_nullable = ${r.is_nullable}`);
    });

    // 3. Check restaurants bill printer columns
    const printerColsRes = await client.query(`
      SELECT column_name, data_type, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'restaurants' 
        AND column_name IN ('bill_printer_name', 'bill_printer_type', 'bill_printer_address')
      ORDER BY column_name;
    `);
    console.log('  🖨️  Restaurant Bill Printer Columns:');
    printerColsRes.rows.forEach(r => {
      console.log(`     • restaurants.${r.column_name} (${r.data_type})`);
    });

    // 4. Check order_items notes column
    const orderItemNotesRes = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'order_items' AND column_name = 'notes';
    `);
    const hasNotes = orderItemNotesRes.rows.length > 0;
    console.log(`  📝 Order Items Notes Column: ${hasNotes ? '✅ order_items.notes exists' : '❌ missing'}`);

    console.log('----------------------------------------------------------------');
  } catch (err) {
    console.warn('⚠️ Verification check warning:', err.message);
  }
}

async function run() {
  const isForce = process.argv.includes('--force') || process.argv.includes('-f');
  const migrationsDir = path.resolve(process.cwd(), 'migrations');

  const maskedUrl = connectionString.replace(/:\/\/([^:]+):([^@]+)@/, '://$1:****@');

  console.log('================================================================');
  console.log('🚀 Running Specified Database Migrations');
  console.log('================================================================');
  console.log(`📡 Database: ${maskedUrl}`);
  console.log(`📁 Migrations Directory: ${migrationsDir}`);
  console.log(`📋 Total Files to Process: ${TARGET_MIGRATIONS.length}`);
  if (isForce) console.log('⚠️  Mode: FORCE (re-running even if previously applied)');
  console.log('----------------------------------------------------------------');

  const client = await pool.connect();

  try {
    await ensureMigrationTable(client);
    const applied = await getAppliedMigrations(client);

    let executed = 0;
    let skipped = 0;

    for (let i = 0; i < TARGET_MIGRATIONS.length; i++) {
      const filename = TARGET_MIGRATIONS[i];
      const filePath = path.join(migrationsDir, filename);

      if (!fs.existsSync(filePath)) {
        console.error(`❌ Migration file not found: ${filePath}`);
        process.exit(1);
      }

      const isAlreadyApplied = applied.has(filename);
      if (isAlreadyApplied && !isForce) {
        console.log(`⏭️  [${i + 1}/${TARGET_MIGRATIONS.length}] Already applied: ${filename} (skipping)`);
        skipped++;
        continue;
      }

      console.log(`⏳ [${i + 1}/${TARGET_MIGRATIONS.length}] Applying: ${filename}...`);
      let sql = fs.readFileSync(filePath, 'utf8');

      // Strip standalone BEGIN/COMMIT so our runner's transaction block manages atomicity cleanly
      sql = sql.replace(/^\s*BEGIN\s*;/gim, '-- BEGIN;').replace(/^\s*COMMIT\s*;/gim, '-- COMMIT;');

      const startTime = Date.now();
      try {
        await client.query('BEGIN');
        await client.query(sql);

        await client.query(`
          INSERT INTO _schema_migrations (filename, applied_at)
          VALUES ($1, CURRENT_TIMESTAMP)
          ON CONFLICT (filename) DO UPDATE SET applied_at = CURRENT_TIMESTAMP
        `, [filename]);

        await client.query('COMMIT');
        const elapsed = Date.now() - startTime;
        console.log(`✅ [${i + 1}/${TARGET_MIGRATIONS.length}] Successfully applied: ${filename} (${elapsed}ms)`);
        executed++;
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`\n❌ Error applying migration "${filename}":`);
        console.error(err.message || err);
        console.error('\n🛑 Migration aborted. Rolled back current file transaction.');
        process.exit(1);
      }
    }

    console.log('----------------------------------------------------------------');
    console.log(`🎉 Migration execution complete: ${executed} applied, ${skipped} skipped.`);

    // Run verification to confirm the schema state
    await runVerification(client);

    console.log('✨ All operations completed successfully!\n');
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(err => {
  console.error('Fatal migration error:', err);
  process.exit(1);
});
