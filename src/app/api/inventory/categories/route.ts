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
      `SELECT * FROM inventory_categories WHERE restaurant_id = $1 ORDER BY name ASC`,
      [restaurantId]
    );
    return NextResponse.json({ success: true, data: res.rows });
  } catch (error: any) {
    console.error('Get categories error:', error);
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
      return NextResponse.json({ success: false, error: 'Category name is required' }, { status: 400 });
    }

    const res = await pool.query(
      `INSERT INTO inventory_categories (restaurant_id, name, description)
       VALUES ($1, $2, $3)
       ON CONFLICT (restaurant_id, name) DO UPDATE SET description = EXCLUDED.description
       RETURNING *`,
      [restaurantId, body.name.trim(), body.description?.trim() || null]
    );

    return NextResponse.json({ success: true, data: res.rows[0] });
  } catch (error: any) {
    console.error('Create category error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
