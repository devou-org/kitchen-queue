const { neon } = require('@neondatabase/serverless');
const url = "postgresql://neondb_owner:npg_kj6aVQi4DGRT@ep-young-voice-a1ih57cv-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";
const sql = neon(url);

async function run() {
  try {
    console.log('Creating categories table...');
    await sql`
      CREATE TABLE IF NOT EXISTS categories (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) UNIQUE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `;
    console.log('Categories table created.');

    console.log('Seeding categories from existing products...');
    await sql`
      INSERT INTO categories (name)
      SELECT DISTINCT category FROM products
      WHERE category IS NOT NULL AND category != ''
      ON CONFLICT (name) DO NOTHING
    `;
    console.log('Categories seeded.');

    // Add search index by name for lookup
    console.log('Creating index on users(name) for lookup...');
    await sql`CREATE INDEX IF NOT EXISTS idx_users_name ON users(name)`;
    console.log('Index created.');

  } catch (err) {
    console.error('Error:', err);
  }
}

run();
