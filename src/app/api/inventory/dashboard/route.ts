import { NextRequest, NextResponse } from 'next/server';
import { resolveRestaurantId } from '../helper';
import { getInventoryDashboardSummary } from '@/lib/inventory';

export async function GET(request: NextRequest) {
  try {
    const restaurantId = await resolveRestaurantId(request);
    if (!restaurantId) {
      return NextResponse.json({ success: false, error: 'Unauthorized or restaurant not found' }, { status: 401 });
    }

    const summary = await getInventoryDashboardSummary(restaurantId);
    return NextResponse.json({ success: true, data: summary });
  } catch (error: any) {
    console.error('Inventory dashboard API error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Failed to fetch inventory dashboard' }, { status: 500 });
  }
}
