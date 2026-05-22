import { NextResponse } from 'next/server';
import { QueueService } from '@/modules/queue/queue.service';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { restaurantId, name, phone, partySize, notes } = body;

    if (!restaurantId || !name || !phone || !partySize) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    // 1-Hour Waitlist Rate Limit per Phone Number
    const { pool } = require('@/lib/db');
    const rateLimitCheck = await pool.query(`
      SELECT id FROM queues 
      WHERE restaurant_id = $1 
      AND user_id IN (SELECT id FROM users WHERE phone = $2)
      AND created_at > NOW() - INTERVAL '1 hour'
    `, [restaurantId, phone]);

    if (rateLimitCheck.rows.length > 0) {
      return NextResponse.json({ success: false, error: 'You have already joined the waitlist recently. Please check your existing ticket or try again in an hour.' }, { status: 400 });
    }

    const queueData = await QueueService.joinQueue({
      restaurantId,
      name,
      phone,
      partySize,
      notes
    });

    const fullQueueData = await QueueService.getQueueByToken(restaurantId, queueData.token_number);

    return NextResponse.json({ success: true, ...fullQueueData });
  } catch (error: any) {
    console.error('Join Queue Error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Failed to join queue' }, { status: 500 });
  }
}
