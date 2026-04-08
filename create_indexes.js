const { neon } = require('@neondatabase/serverless');
const url = "postgresql://neondb_owner:npg_kj6aVQi4DGRT@ep-young-voice-a1ih57cv-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";
const sql = neon(url);

async function run() {
  try {
    console.log('Creating optimized indexes...');
    
    // Partial index for active orders (if is_active exists, else just index status)
    // Based on earlier check, is_active is NOT in orders. I'll just index status.
    await sql`CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)`;
    
    await sql`CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_orders_status_created ON orders(status, created_at DESC)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_products_status ON products(status)`;
    
    // Index for the name-based user lookup
    await sql`CREATE INDEX IF NOT EXISTS idx_users_name ON users(name)`;

    console.log('Indexes created successfully.');
  } catch (err) {
    console.error('Error creating indexes:', err);
  }
}
run();
