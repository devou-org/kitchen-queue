import { NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth';
import { getRestaurantBySlug, getLoyaltyCustomersList, adjustCustomerPoints, deleteCustomerLoyaltyProfile } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const slug = searchParams.get('slug');
    const search = searchParams.get('search') || '';

    if (!slug) {
      return NextResponse.json({ success: false, error: 'Restaurant slug is required' }, { status: 400 });
    }

    const restaurant = await getRestaurantBySlug(slug);
    if (!restaurant) {
      return NextResponse.json({ success: false, error: 'Restaurant not found' }, { status: 404 });
    }

    const customers = await getLoyaltyCustomersList(restaurant.id, search);
    return NextResponse.json({ success: true, data: customers });
  } catch (error: any) {
    console.error('Error fetching loyalty customers:', error);
    return NextResponse.json({ success: false, error: error.message || 'Server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { admin } = await getAuthContext(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { slug, customer_loyalty_id, points_delta, reason } = body;

    if (!slug || !customer_loyalty_id || points_delta === undefined) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    const restaurant = await getRestaurantBySlug(slug);
    if (!restaurant) {
      return NextResponse.json({ success: false, error: 'Restaurant not found' }, { status: 404 });
    }

    const updated = await adjustCustomerPoints(restaurant.id, customer_loyalty_id, Number(points_delta), reason);
    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    console.error('Error adjusting loyalty points:', error);
    return NextResponse.json({ success: false, error: error.message || 'Server error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { admin } = await getAuthContext(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const slug = searchParams.get('slug');
    const customer_loyalty_id = searchParams.get('customer_loyalty_id');

    if (!slug || !customer_loyalty_id) {
      return NextResponse.json({ success: false, error: 'Missing required parameters' }, { status: 400 });
    }

    const restaurant = await getRestaurantBySlug(slug);
    if (!restaurant) {
      return NextResponse.json({ success: false, error: 'Restaurant not found' }, { status: 404 });
    }

    const success = await deleteCustomerLoyaltyProfile(restaurant.id, customer_loyalty_id);
    return NextResponse.json({ success });
  } catch (error: any) {
    console.error('Error deleting customer loyalty profile:', error);
    return NextResponse.json({ success: false, error: error.message || 'Server error' }, { status: 500 });
  }
}
