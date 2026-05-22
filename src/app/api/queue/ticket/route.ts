import { NextRequest, NextResponse } from 'next/server';
import { QueueService } from '@/modules/queue/queue.service';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const restaurantId = searchParams.get('restaurantId');
    const tokenNumberStr = searchParams.get('tokenNumber');
    
    if (!restaurantId || !tokenNumberStr) {
      return NextResponse.json({ success: false, error: 'Restaurant ID and token number required' }, { status: 400 });
    }

    const tokenNumber = parseInt(tokenNumberStr, 10);
    const queueData = await QueueService.getQueueByToken(restaurantId, tokenNumber);

    if (!queueData) {
      return NextResponse.json({ success: false, error: 'Ticket not found for today' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: queueData });
  } catch (error: any) {
    console.error('Fetch Queue Ticket Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
