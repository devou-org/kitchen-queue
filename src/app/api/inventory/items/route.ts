import { NextRequest, NextResponse } from 'next/server';
import { resolveRestaurantId } from '../helper';
import { getInventoryItems, createInventoryItem } from '@/lib/inventory';

export async function GET(request: NextRequest) {
  try {
    const restaurantId = await resolveRestaurantId(request);
    if (!restaurantId) {
      return NextResponse.json({ success: false, error: 'Unauthorized or restaurant not found' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const category_id = searchParams.get('category_id') || undefined;
    const search = searchParams.get('search') || undefined;
    const status = (searchParams.get('status') as any) || undefined;
    const is_active_param = searchParams.get('is_active');
    const is_active = is_active_param !== null ? is_active_param === 'true' : undefined;

    const items = await getInventoryItems(restaurantId, {
      category_id,
      search,
      status,
      is_active,
    });

    return NextResponse.json({ success: true, data: items });
  } catch (error: any) {
    console.error('Get inventory items error:', error);
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
    if (!body.name || !body.name.trim()) {
      return NextResponse.json({ success: false, error: 'Ingredient name is required' }, { status: 400 });
    }

    const item = await createInventoryItem(restaurantId, body);
    return NextResponse.json({ success: true, data: item });
  } catch (error: any) {
    console.error('Create inventory item error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
