import { NextRequest, NextResponse } from 'next/server';
import { QueueService } from '@/modules/queue/queue.service';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const restaurantId = searchParams.get('restaurantId');
    if (!restaurantId) {
      return NextResponse.json({ success: false, error: 'Restaurant ID required' }, { status: 400 });
    }

    const queues = await QueueService.getQueues(restaurantId);
    return NextResponse.json({ success: true, data: queues });
  } catch (error: any) {
    console.error('Fetch Queues Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
