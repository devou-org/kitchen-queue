import { NextRequest, NextResponse } from 'next/server';
import { getAllRestaurants, createRestaurant } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

async function requireSuperAdmin(request: NextRequest) {
  const token = request.cookies.get('super_admin_token')?.value
    || request.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload?.isSuperAdmin) return null;
  return payload;
}

// GET /api/super-admin/restaurants — list all restaurants
export async function GET(request: NextRequest) {
  const admin = await requireSuperAdmin(request);
  if (!admin) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  try {
    const restaurants = await getAllRestaurants();
    return NextResponse.json({ success: true, data: restaurants });
  } catch (error) {
    console.error('List restaurants error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch restaurants' }, { status: 500 });
  }
}

// POST /api/super-admin/restaurants — create a restaurant
export async function POST(request: NextRequest) {
  const admin = await requireSuperAdmin(request);
  if (!admin) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const { name, slug, phone, address, logo_url, primary_color, secondary_color, menu_layout, menu_title, menu_description, modules } = body;

    if (!name || !slug) {
      return NextResponse.json({ success: false, error: 'Name and slug are required' }, { status: 400 });
    }

    // Validate slug: lowercase letters, numbers, hyphens only
    if (!/^[a-z0-9-]+$/.test(slug)) {
      return NextResponse.json({ success: false, error: 'Slug must be lowercase letters, numbers, and hyphens only' }, { status: 400 });
    }

    const restaurant = await createRestaurant({ name, slug, phone, address, logo_url, primary_color, secondary_color, menu_layout, menu_title, menu_description, modules });
    return NextResponse.json({ success: true, data: restaurant }, { status: 201 });
  } catch (error: any) {
    console.error('Create restaurant error:', error);
    if (error.message?.includes('duplicate') || error.message?.includes('unique')) {
      return NextResponse.json({ success: false, error: 'A restaurant with this slug already exists' }, { status: 409 });
    }
    return NextResponse.json({ success: false, error: 'Failed to create restaurant' }, { status: 500 });
  }
}
