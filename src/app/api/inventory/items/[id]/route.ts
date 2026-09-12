import { NextRequest, NextResponse } from 'next/server';
import { resolveRestaurantId } from '../../helper';
import { getInventoryItemById, updateInventoryItem } from '@/lib/inventory';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const restaurantId = await resolveRestaurantId(request);
    if (!restaurantId) {
      return NextResponse.json({ success: false, error: 'Unauthorized or restaurant not found' }, { status: 401 });
    }

    const { id } = await params;
    const item = await getInventoryItemById(restaurantId, id);
    if (!item) {
      return NextResponse.json({ success: false, error: 'Ingredient not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: item });
  } catch (error: any) {
    console.error('Get inventory item detail error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const restaurantId = await resolveRestaurantId(request);
    if (!restaurantId) {
      return NextResponse.json({ success: false, error: 'Unauthorized or restaurant not found' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    const updated = await updateInventoryItem(restaurantId, id, body);
    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    console.error('Update inventory item error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const restaurantId = await resolveRestaurantId(request);
    if (!restaurantId) {
      return NextResponse.json({ success: false, error: 'Unauthorized or restaurant not found' }, { status: 401 });
    }

    const { id } = await params;
    // Deactivate item rather than destroying audit ledger references
    const updated = await updateInventoryItem(restaurantId, id, { is_active: false });
    return NextResponse.json({ success: true, data: updated, message: 'Ingredient deactivated' });
  } catch (error: any) {
    console.error('Deactivate inventory item error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
