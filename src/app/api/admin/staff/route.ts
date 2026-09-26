import { NextRequest, NextResponse } from 'next/server';
import { getStaffs, createStaff, getRestaurantBySlug } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { requireAdmin } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const user = await requireAdmin(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!user.isAdmin && (!user.permissions || !user.permissions.includes('staff'))) {
    return NextResponse.json({ error: 'Forbidden: Insufficient permissions' }, { status: 403 });
  }

  try {
    const slug = request.headers.get('x-restaurant-slug') || 'demo';
    const restaurant = await getRestaurantBySlug(slug);
    if (!restaurant) {
      return NextResponse.json({ success: false, error: 'Restaurant not found' }, { status: 404 });
    }

    const staffs = await getStaffs(restaurant.id);
    return NextResponse.json({ success: true, data: staffs });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const user = await requireAdmin(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!user.isAdmin && (!user.permissions || !user.permissions.includes('staff'))) {
    return NextResponse.json({ error: 'Forbidden: Insufficient permissions' }, { status: 403 });
  }

  try {
    const slug = request.headers.get('x-restaurant-slug') || 'demo';
    const restaurant = await getRestaurantBySlug(slug);
    if (!restaurant) {
      return NextResponse.json({ success: false, error: 'Restaurant not found' }, { status: 404 });
    }

    const body = await request.json();
    const { name, email, phone, password, role, role_id, is_active } = body;

    if (!name || !email || !password) {
      return NextResponse.json({ success: false, error: 'Name, email, and password are required' }, { status: 400 });
    }

    const hashedPassword = await hashPassword(password);

    const staff = await createStaff(restaurant.id, {
      name,
      email,
      phone,
      password: hashedPassword,
      role: role || 'STAFF',
      role_id: role_id || null,
      is_active: is_active !== undefined ? is_active : true
    });

    return NextResponse.json({ success: true, data: staff });
  } catch (error: any) {
    if (error.message?.includes('staffs_email_key')) {
      return NextResponse.json({ success: false, error: 'User with this email already exists' }, { status: 400 });
    }
    if (error.message?.includes('limit reached')) {
      return NextResponse.json({ success: false, error: error.message }, { status: 403 });
    }
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
