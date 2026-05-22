import { NextRequest, NextResponse } from 'next/server';
import { QueueService } from '@/modules/queue/queue.service';

export async function POST(req: NextRequest) {
  try {
    const { queueId, statusEnum, restaurantId } = await req.json();

    if (!queueId || !statusEnum || !restaurantId) {
      return NextResponse.json({ success: false, error: 'queueId, statusEnum, restaurantId are required' }, { status: 400 });
    }

    const updated = await QueueService.updateQueueStatus(queueId, statusEnum, restaurantId);
    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    console.error('Update Queue Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
