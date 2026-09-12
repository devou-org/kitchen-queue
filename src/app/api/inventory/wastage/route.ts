import { NextRequest, NextResponse } from 'next/server';
import { resolveRestaurantId } from '../helper';
import { getWastageRecords, recordWastage } from '@/lib/inventory';

export async function GET(request: NextRequest) {
  try {
    const restaurantId = await resolveRestaurantId(request);
    if (!restaurantId) {
      return NextResponse.json({ success: false, error: 'Unauthorized or restaurant not found' }, { status: 401 });
    }

    const records = await getWastageRecords(restaurantId);
    return NextResponse.json({ success: true, data: records });
  } catch (error: any) {
    console.error('Get wastage records error:', error);
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
    if (!body.item_id || !body.quantity || !body.reason) {
      return NextResponse.json({ success: false, error: 'Ingredient, quantity, and reason are required' }, { status: 400 });
    }

    const record = await recordWastage(restaurantId, body);
    return NextResponse.json({ success: true, data: record });
  } catch (error: any) {
    console.error('Record wastage error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
