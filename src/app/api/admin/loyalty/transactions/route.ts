import { NextResponse } from 'next/server';
import { getRestaurantBySlug, getLoyaltyTransactionsList } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const slug = searchParams.get('slug');

    if (!slug) {
      return NextResponse.json({ success: false, error: 'Restaurant slug is required' }, { status: 400 });
    }

    const restaurant = await getRestaurantBySlug(slug);
    if (!restaurant) {
      return NextResponse.json({ success: false, error: 'Restaurant not found' }, { status: 404 });
    }

    const transactions = await getLoyaltyTransactionsList(restaurant.id);
    return NextResponse.json({ success: true, data: transactions });
  } catch (error: any) {
    console.error('Error fetching loyalty transactions:', error);
    return NextResponse.json({ success: false, error: error.message || 'Server error' }, { status: 500 });
  }
}
