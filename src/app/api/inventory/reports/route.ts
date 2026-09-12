import { NextRequest, NextResponse } from 'next/server';
import { resolveRestaurantId } from '../helper';
import { getInventoryReports } from '@/lib/inventory';

export async function GET(request: NextRequest) {
  try {
    const restaurantId = await resolveRestaurantId(request);
    if (!restaurantId) {
      return NextResponse.json({ success: false, error: 'Unauthorized or restaurant not found' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const date_from = searchParams.get('date_from') || undefined;
    const date_to = searchParams.get('date_to') || undefined;

    const reports = await getInventoryReports(restaurantId, { date_from, date_to });
    return NextResponse.json({ success: true, data: reports });
  } catch (error: any) {
    console.error('Inventory reports error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
