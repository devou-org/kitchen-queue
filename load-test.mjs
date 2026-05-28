import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { Pool } from '@neondatabase/serverless';
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const RESTAURANT_ID = '00000000-0000-0000-0000-000000000000';

async function runLoadTest() {
  console.log('--- STARTING ROW-LEVEL LOCK LOAD TEST ---');
  
  // 1. Get a product to test on
  const res = await pool.query('SELECT id, stock_quantity FROM products WHERE restaurant_id = $1 LIMIT 1', [RESTAURANT_ID]);
  if (res.rowCount === 0) {
    console.error('No products found for this restaurant.');
    process.exit(1);
  }
  const productId = res.rows[0].id;
  const initialStock = res.rows[0].stock_quantity;
  console.log(`Testing on Product: ${productId} | Initial Stock: ${initialStock}`);

  // We will simulate 1 Admin Update and 10 Concurrent Orders
  // Admin tries to set stock to 100.
  // 10 Orders try to deduct 1 stock each.
  
  // If locks work correctly, the final stock should account for both, OR
  // the admin's update will block/wait and overwrite, or the orders will block and deduct from 100.
  // Wait, if Admin hardcodes stock to 100, the orders that execute AFTER the admin will deduct from 100.
  // Let's test the lock by doing multiple updates that do stock_quantity = stock_quantity - 1 in parallel transactions,
  // AND an admin update that explicitly locks.

  const workers = [];

  // Function to simulate an admin explicitly locking and updating
  const adminUpdate = async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      console.log('[Admin] Acquired connection, waiting for lock...');
      // Explicit row-level lock
      await client.query('SELECT id FROM products WHERE id = $1 FOR UPDATE', [productId]);
      console.log('[Admin] Lock acquired! Simulating think time...');
      await new Promise(resolve => setTimeout(resolve, 1500)); // Hold lock for 1.5s
      
      console.log('[Admin] Updating stock to 500...');
      await client.query('UPDATE products SET stock_quantity = 500 WHERE id = $1', [productId]);
      await client.query('COMMIT');
      console.log('[Admin] Transaction committed.');
    } catch (e) {
      await client.query('ROLLBACK');
      console.error('[Admin] Failed', e.message);
    } finally {
      client.release();
    }
  };

  // Function to simulate a customer order (implicitly locks via UPDATE)
  const customerOrder = async (workerId) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      console.log(`[Order ${workerId}] Requesting update...`);
      // Implicit lock during update
      await client.query('UPDATE products SET stock_quantity = stock_quantity - 1 WHERE id = $1', [productId]);
      console.log(`[Order ${workerId}] Update applied!`);
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      console.error(`[Order ${workerId}] Failed`, e.message);
    } finally {
      client.release();
    }
  };

  // Start them all simultaneously
  console.log('Firing concurrent requests...');
  workers.push(adminUpdate());
  
  // Fire 10 concurrent orders after a tiny delay so the admin grabs the lock first
  setTimeout(() => {
    for (let i = 1; i <= 5; i++) {
      workers.push(customerOrder(i));
    }
  }, 100); // 100ms delay ensures admin gets the lock first

  await Promise.all(workers);

  // Check final stock
  const finalRes = await pool.query('SELECT stock_quantity FROM products WHERE id = $1', [productId]);
  console.log(`\n--- TEST COMPLETE ---`);
  console.log(`Final Stock: ${finalRes.rows[0].stock_quantity}`);
  console.log(`(Expected: 500 - 5 = 495)`);
  
  await pool.end();
}

runLoadTest().catch(console.error);
