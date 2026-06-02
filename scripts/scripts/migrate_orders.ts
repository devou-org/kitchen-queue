import { neon, Pool } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL!);
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  const client = await pool.connect();
  try {
    console.log('Starting order to queue migration...');
    
    // 1. Add queue_id to orders
    await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS queue_id UUID REFERENCES queues(id)`);
    
    // 2. Fetch all restaurants
    const restRes = await client.query('SELECT id FROM restaurants');
    const restaurants = restRes.rows;

    const statuses = [
      { name: 'PENDING', color: '#f59e0b' },
      { name: 'PREPARING', color: '#3b82f6' },
      { name: 'READY', color: '#10b981' },
      { name: 'COMPLETED', color: '#64748b' },
      { name: 'CANCELLED', color: '#ef4444' },
      { name: 'WAITING', color: '#8b5cf6' },
      { name: 'SEATED', color: '#14b8a6' }
    ];

    // 3. Ensure queue_status exists for all statuses and restaurants
    for (const r of restaurants) {
      for (const s of statuses) {
        await client.query(`
          INSERT INTO queue_status (restaurant_id, possible_queue_status, color)
          VALUES ($1, $2, $3)
          ON CONFLICT DO NOTHING
        `, [r.id, s.name, s.color]);
        
        // Update color if exists
        await client.query(`
          UPDATE queue_status SET color = $3 WHERE restaurant_id = $1 AND possible_queue_status = $2
        `, [r.id, s.name, s.color]);
      }
    }

    // 4. Fetch all orders that don't have a queue_id yet
    const ordersRes = await client.query(`SELECT * FROM orders WHERE queue_id IS NULL`);
    const orders = ordersRes.rows;

    console.log(`Found ${orders.length} orders to migrate...`);

    for (const order of orders) {
      // Create user if not exists
      const userRes = await client.query(`
        INSERT INTO users (name, phone, role)
        VALUES ($1, $2, 'USER')
        ON CONFLICT (phone) DO UPDATE SET name = EXCLUDED.name
        RETURNING id
      `, [order.customer_name || 'Guest', order.phone || '0000000000']);
      const userId = userRes.rows[0].id;

      // Get status ID
      const statusRes = await client.query(`
        SELECT id FROM queue_status WHERE restaurant_id = $1 AND possible_queue_status = $2 LIMIT 1
      `, [order.restaurant_id, order.status || 'PENDING']);
      const statusId = statusRes.rows[0]?.id;

      // Create queue entry
      const queueRes = await client.query(`
        INSERT INTO queues (
          restaurant_id, user_id, queue_status_id, token_number, 
          queue_type, party_size, notes, created_at
        ) VALUES ($1, $2, $3, $4, 'ORDER', $5, $6, $7)
        RETURNING id
      `, [
        order.restaurant_id, userId, statusId, order.ticket_number || 0,
        order.party_size || 1, order.notes || '', order.created_at
      ]);
      const queueId = queueRes.rows[0].id;

      // Update order
      await client.query(`UPDATE orders SET queue_id = $1 WHERE id = $2`, [queueId, order.id]);
      console.log(`Migrated order ${order.id} to queue ${queueId}`);
    }

    console.log('Migration complete!');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    pool.end();
    process.exit(0);
  }
}

run();
