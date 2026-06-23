import { NextRequest, NextResponse } from 'next/server';
import { advanceQueue, getRestaurantBySlug } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { pusherServer } from '@/lib/pusher';

export async function POST(request: NextRequest) {
  try {
    const slug = request.headers.get('x-restaurant-slug') || 'demo';
    const restaurant = await getRestaurantBySlug(slug);
    
    if (!restaurant) {
       return NextResponse.json({ success: false, error: 'Restaurant not found' }, { status: 404 });
    }

    const admin = await requireAdmin(request);
    if (!admin) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });

    const state = await advanceQueue(restaurant.id);

    // Broadcast to all connected customers via Pusher
    await pusherServer.trigger(`queue-channel-${restaurant.id}`, 'queue_update', {
      type: 'queue_update',
      restaurant_id: restaurant.id,
      queue_number: state.current_queue_number,
      last_served_number: state.last_served_number,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      queue_number: state.current_queue_number,
      message: `Queue advanced to #${state.current_queue_number}`,
    });
  } catch (error) {
    console.error('Advance queue error:', error);
    return NextResponse.json({ success: false, border: false, error: error instanceof Error ? error.message : 'Failed to advance queue' }, { status: 400 });
  }
}
