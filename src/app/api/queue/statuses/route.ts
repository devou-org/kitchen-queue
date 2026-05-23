import { NextRequest, NextResponse } from 'next/server';
import { QueueService } from '@/modules/queue/queue.service';
import { getRestaurantBySlug } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const slug = request.headers.get('x-restaurant-slug') || 'demo';
    const restaurant = await getRestaurantBySlug(slug);
    
    if (!restaurant) {
       return NextResponse.json({ success: false, error: 'Restaurant not found' }, { status: 404 });
    }

    const statuses = await QueueService.getQueueStatuses(restaurant.id);
    return NextResponse.json({ success: true, data: statuses });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to get queue statuses' }, { status: 500 });
  }
}
