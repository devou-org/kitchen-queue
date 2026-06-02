import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

async function runMigration() {
  try {
    console.log('Running migration...');
    
    // Step 1: Add user_id column to orders
    await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS user_id UUID`;
    console.log('Added user_id column to orders');

    // Step 2: Backfill Existing Orders
    await sql`
      UPDATE orders o
      SET user_id = u.id
      FROM users u
      WHERE o.phone = u.phone AND o.user_id IS NULL
    `;
    console.log('Backfilled existing orders with user_id');

    // Step 3: Check Missing Records (just logging count)
    const missing = await sql`SELECT COUNT(*) FROM orders WHERE user_id IS NULL`;
    console.log(`Orders missing user_id: ${missing[0].count}`);

    // Step 4: Add Foreign Key
    try {
      await sql`
        ALTER TABLE orders
        ADD CONSTRAINT fk_orders_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
      `;
      console.log('Added foreign key constraint');
    } catch (e) {
      console.log('Foreign key might already exist:', e.message);
    }

    // Step 5: Create Index
    try {
      await sql`CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id)`;
      console.log('Created index on user_id');
    } catch (e) {
      console.log('Index might already exist:', e.message);
    }

    // Step 6: Create reviews table
    await sql`
      CREATE TABLE IF NOT EXISTS reviews (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
        rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
        comment TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `;
    console.log('Created reviews table');

    console.log('Migration completed successfully.');
  } catch (error) {
    console.error('Migration failed:', error);
  }
}

runMigration();
