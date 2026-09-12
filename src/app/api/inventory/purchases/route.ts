import { NextRequest, NextResponse } from 'next/server';
import { resolveRestaurantId } from '../helper';
import { getPurchaseOrders, receivePurchaseStock } from '@/lib/inventory';

export async function GET(request: NextRequest) {
  try {
    const restaurantId = await resolveRestaurantId(request);
    if (!restaurantId) {
      return NextResponse.json({ success: false, error: 'Unauthorized or restaurant not found' }, { status: 401 });
    }

    const purchases = await getPurchaseOrders(restaurantId);
    return NextResponse.json({ success: true, data: purchases });
  } catch (error: any) {
    console.error('Get purchases error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const restaurantId = await resolveRestaurantId(request);
    if (!restaurantId) {
      return NextResponse.json({ success: false, error: 'Unauthorized or restaurant not found' }, { status: 401 });
    }

    const body = await request.json();
    if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json({ success: false, error: 'At least one line item is required' }, { status: 400 });
    }

    const po = await receivePurchaseStock(restaurantId, body);
    return NextResponse.json({ success: true, data: po });
  } catch (error: any) {
    console.error('Receive purchase stock error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
