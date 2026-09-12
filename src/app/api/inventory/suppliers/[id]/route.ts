import { NextRequest, NextResponse } from 'next/server';
import { resolveRestaurantId } from '../../helper';
import { updateSupplier } from '@/lib/inventory';

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

    const updated = await updateSupplier(restaurantId, id, body);
    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    console.error('Update supplier error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
