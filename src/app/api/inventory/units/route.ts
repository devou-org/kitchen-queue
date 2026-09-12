import { NextRequest, NextResponse } from 'next/server';
import { resolveRestaurantId } from '../helper';
import { pool } from '@/lib/db';
import { ensureDefaultCategoriesAndUnits } from '@/lib/inventory';

export async function GET(request: NextRequest) {
  try {
    const restaurantId = await resolveRestaurantId(request);
    if (!restaurantId) {
      return NextResponse.json({ success: false, error: 'Unauthorized or restaurant not found' }, { status: 401 });
    }

    await ensureDefaultCategoriesAndUnits(restaurantId);

    const res = await pool.query(
      `SELECT * FROM inventory_units WHERE restaurant_id = $1 ORDER BY name ASC`,
      [restaurantId]
    );
    return NextResponse.json({ success: true, data: res.rows });
  } catch (error: any) {
    console.error('Get units error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
