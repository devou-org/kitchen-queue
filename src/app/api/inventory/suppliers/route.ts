import { NextRequest, NextResponse } from 'next/server';
import { resolveRestaurantId } from '../helper';
import { getSuppliers, createSupplier } from '@/lib/inventory';

export async function GET(request: NextRequest) {
  try {
    const restaurantId = await resolveRestaurantId(request);
    if (!restaurantId) {
      return NextResponse.json({ success: false, error: 'Unauthorized or restaurant not found' }, { status: 401 });
    }

    const suppliers = await getSuppliers(restaurantId);
    return NextResponse.json({ success: true, data: suppliers });
  } catch (error: any) {
    console.error('Get suppliers error:', error);
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
      return NextResponse.json({ success: false, error: 'Supplier name is required' }, { status: 400 });
    }

    const supplier = await createSupplier(restaurantId, body);
    return NextResponse.json({ success: true, data: supplier });
  } catch (error: any) {
    console.error('Create supplier error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
