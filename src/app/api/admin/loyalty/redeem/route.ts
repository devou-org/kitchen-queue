import { NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth';
import { getRestaurantBySlug, redeemLoyaltyReward } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { slug, phone, reward_id } = body;

    if (!slug || !phone || !reward_id) {
      return NextResponse.json({ success: false, error: 'Restaurant slug, phone, and reward_id are required' }, { status: 400 });
    }

    const restaurant = await getRestaurantBySlug(slug);
    if (!restaurant) {
      return NextResponse.json({ success: false, error: 'Restaurant not found' }, { status: 404 });
    }

    const result = await redeemLoyaltyReward(restaurant.id, phone, reward_id);
    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Error redeeming loyalty reward:', error);
    return NextResponse.json({ success: false, error: error.message || 'Server error' }, { status: 500 });
  }
}
