import { NextRequest, NextResponse } from 'next/server';
import { getQueueState, getRestaurantBySlug } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const slug = request.headers.get('x-restaurant-slug') || 'demo';
    const restaurant = await getRestaurantBySlug(slug);
    
    if (!restaurant) {
       return NextResponse.json({ success: false, error: 'Restaurant not found' }, { status: 404 });
    }

    const state = await getQueueState(restaurant.id);
    return NextResponse.json({ success: true, data: state });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to get queue state' }, { status: 500 });
  }
}
