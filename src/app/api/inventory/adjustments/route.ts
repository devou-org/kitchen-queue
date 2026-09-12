import { NextRequest, NextResponse } from 'next/server';
import { resolveRestaurantId } from '../helper';
import { getStockAdjustments, recordStockAdjustment } from '@/lib/inventory';

export async function GET(request: NextRequest) {
  try {
    const restaurantId = await resolveRestaurantId(request);
    if (!restaurantId) {
      return NextResponse.json({ success: false, error: 'Unauthorized or restaurant not found' }, { status: 401 });
    }

    const records = await getStockAdjustments(restaurantId);
    return NextResponse.json({ success: true, data: records });
  } catch (error: any) {
    console.error('Get stock adjustments error:', error);
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
    if (!body.item_id || body.physical_stock === undefined || !body.reason) {
      return NextResponse.json({ success: false, error: 'Item ID, physical stock, and reason are required' }, { status: 400 });
    }

    const adjustment = await recordStockAdjustment(restaurantId, body);
    return NextResponse.json({ success: true, data: adjustment });
  } catch (error: any) {
    console.error('Record stock adjustment error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
