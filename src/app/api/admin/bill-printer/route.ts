import { NextRequest, NextResponse } from 'next/server';
import sql, { getRestaurantBySlug, updateRestaurantBillPrinter } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

async function resolveRestaurant(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (admin?.restaurantId) {
    const rows = await sql`SELECT * FROM restaurants WHERE id = ${admin.restaurantId} LIMIT 1`;
    if (rows && rows[0]) return rows[0];
  }

  const headerSlug = request.headers.get('x-restaurant-slug');
  const { searchParams } = new URL(request.url);
  const querySlug = searchParams.get('slug');
  const slug = querySlug?.trim() || headerSlug?.trim() || admin?.restaurantSlug;

  if (slug) {
    return await getRestaurantBySlug(slug);
  }
  return null;
}

export async function GET(request: NextRequest) {
  try {
    const restaurant = await resolveRestaurant(request);
    if (!restaurant) {
      return NextResponse.json({ success: false, error: 'Restaurant not found or unauthorized' }, { status: 401 });
    }

    return NextResponse.json({
      success: true,
      data: {
        bill_printer_name: restaurant.bill_printer_name || 'POS-80C',
        bill_printer_type: restaurant.bill_printer_type || 'DEFAULT',
        bill_printer_address: restaurant.bill_printer_address || '',
      },
    });
  } catch (error: any) {
    console.error('Failed to get bill printer settings:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const restaurant = await resolveRestaurant(request);
    if (!restaurant) {
      return NextResponse.json({ success: false, error: 'Restaurant not found or unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { bill_printer_name, bill_printer_type, bill_printer_address } = body;

    if (!bill_printer_name || !bill_printer_name.trim()) {
      return NextResponse.json({ success: false, error: 'Printer name is required' }, { status: 400 });
    }

    const effType = (bill_printer_type || 'DEFAULT').toUpperCase();
    const cleanAddress = effType === 'NETWORK' && bill_printer_address ? bill_printer_address.trim() : null;

    const updated = await updateRestaurantBillPrinter(restaurant.id, {
      bill_printer_name: bill_printer_name.trim(),
      bill_printer_type: effType,
      bill_printer_address: cleanAddress,
    });

    return NextResponse.json({
      success: true,
      message: `Default bill printer configured as "${bill_printer_name.trim()}"`,
      data: updated,
    });
  } catch (error: any) {
    console.error('Failed to update bill printer settings:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
