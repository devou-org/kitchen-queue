import { NextResponse } from 'next/server';
import { QueueService } from '@/modules/queue/queue.service';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { restaurantId, name, phone, partySize, notes } = body;

    if (!restaurantId || !name || !phone || !partySize) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    // We removed the strict rate limit so that `QueueService.joinQueue` can elegantly 
    // handle returning the existing active ticket or creating a new one if previous is seated.

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
