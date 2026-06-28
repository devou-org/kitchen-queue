import { NextRequest, NextResponse } from 'next/server';
import { QueueService } from '@/modules/queue/queue.service';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const restaurantId = searchParams.get('restaurantId');
    const id = searchParams.get('id');
    
    if (!restaurantId || !id) {
      return NextResponse.json({ success: false, error: 'Restaurant ID and ID required' }, { status: 400 });
    }

    const queueData = await QueueService.getQueueById(restaurantId, id);

    if (!queueData) {
      return NextResponse.json({ success: false, error: 'Ticket not found for today' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: queueData });
  } catch (error: any) {
    console.error('Fetch Queue Ticket Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
