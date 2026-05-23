import { NextResponse } from 'next/server';
import sql from '@/lib/db';

export async function GET() {
  try {
    console.log('Starting order to queue migration...');
    
    // 1. Add queue_id to orders
    await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS queue_id UUID REFERENCES queues(id)`;
    
    try {
      await sql`ALTER TABLE queue_status ADD COLUMN IF NOT EXISTS color VARCHAR(20) DEFAULT '#cbd5e1'`;
    } catch(e) {}
    
    try {
      await sql`ALTER TYPE queue_status_enum ADD VALUE IF NOT EXISTS 'PENDING'`;
      await sql`ALTER TYPE queue_status_enum ADD VALUE IF NOT EXISTS 'PREPARING'`;
      await sql`ALTER TYPE queue_status_enum ADD VALUE IF NOT EXISTS 'READY'`;
      await sql`ALTER TYPE queue_status_enum ADD VALUE IF NOT EXISTS 'COMPLETED'`;
      await sql`ALTER TYPE queue_status_enum ADD VALUE IF NOT EXISTS 'CANCELLED'`;
    } catch(e) {}
    
    // 2. Fetch all restaurants
    const restaurants = await sql`SELECT id FROM restaurants`;

    const statuses = [
      { name: 'PENDING', color: '#f59e0b' },
      { name: 'PREPARING', color: '#3b82f6' },
      { name: 'READY', color: '#10b981' },
      { name: 'COMPLETED', color: '#64748b' },
      { name: 'CANCELLED', color: '#ef4444' },
      { name: 'WAITING', color: '#8b5cf6' },
      { name: 'SEATED', color: '#14b8a6' }
    ];

    // 3. Ensure queue_status exists
    for (const r of restaurants) {
      for (const s of statuses) {
        await sql`
          INSERT INTO queue_status (restaurant_id, possible_queue_status, color)
          VALUES (${r.id}, ${s.name}, ${s.color})
          ON CONFLICT DO NOTHING
        `;
        await sql`
          UPDATE queue_status SET color = ${s.color} WHERE restaurant_id = ${r.id} AND possible_queue_status = ${s.name}
        `;
      }
    }

    // 4. Fetch orders
    const orders = await sql`SELECT * FROM orders WHERE queue_id IS NULL`;

    console.log(`Found ${orders.length} orders to migrate...`);

    let migrated = 0;
    for (const order of orders) {
      try {
        const userRes = await sql`
          INSERT INTO users (name, phone, role)
          VALUES (${order.customer_name || 'Guest'}, ${order.phone || '0000000000'}, 'USER')
          ON CONFLICT (phone) DO UPDATE SET name = EXCLUDED.name
          RETURNING id
        `;
        const userId = userRes[0].id;

        const statusRes = await sql`
          SELECT id FROM queue_status WHERE restaurant_id = ${order.restaurant_id} AND possible_queue_status = ${order.status || 'PENDING'} LIMIT 1
        `;
        const statusId = statusRes[0]?.id;

        const queueRes = await sql`
          INSERT INTO queues (
            restaurant_id, user_id, queue_status_id, token_number, 
            queue_type, party_size, notes, created_at
          ) VALUES (
            ${order.restaurant_id}, ${userId}, ${statusId}, ${order.ticket_number || 0},
            'ORDER', ${order.party_size || 1}, ${order.notes || ''}, ${order.created_at}
          )
          RETURNING id
        `;
        const queueId = queueRes[0].id;

        await sql`UPDATE orders SET queue_id = ${queueId} WHERE id = ${order.id}`;
        migrated++;
      } catch (e: any) {
        console.error(`Failed order ${order.id}: ${e.message}`);
      }
    }

    return NextResponse.json({ success: true, migrated });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message });
  }
}
