const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

if (!process.env.DATABASE_URL) {
  require('dotenv').config({ path: '.env' });
}

if (!process.env.DATABASE_URL) {
  console.error('❌ Error: DATABASE_URL environment variable is not defined.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function runRoleManagementMigration() {
  console.log('🚀 Running Role Management Database Migration...\n');
  const client = await pool.connect();

  try {
    const migrationPath = path.join(__dirname, 'migrations', '20260929_role_management.sql');
    if (!fs.existsSync(migrationPath)) {
      console.error(`❌ Migration file not found: ${migrationPath}`);
      process.exit(1);
    }

    console.log('📄 Executing migrations/20260929_role_management.sql...');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    await client.query(sql);

    console.log('✅ Role management migration completed successfully!\n');

    // Display summary of created / existing roles
    const res = await client.query(`
      SELECT r.name, r.description, r.permissions, r.is_default, COUNT(s.id)::int as staff_assigned
      FROM roles r
      LEFT JOIN staffs s ON s.role_id = r.id
      GROUP BY r.id, r.name, r.description, r.permissions, r.is_default
      ORDER BY r.name ASC
      LIMIT 20;
    `);

    console.log('=== ROLES OVERVIEW ===');
    console.table(res.rows);

  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runRoleManagementMigration();
