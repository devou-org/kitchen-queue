import { NextRequest, NextResponse } from 'next/server';
import { getRoles, createRole, getRestaurantBySlug } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const user = await requireAdmin(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const slug = request.headers.get('x-restaurant-slug') || 'demo';
    const restaurant = await getRestaurantBySlug(slug);
    if (!restaurant) {
      return NextResponse.json({ success: false, error: 'Restaurant not found' }, { status: 404 });
    }

    const roles = await getRoles(restaurant.id);
    return NextResponse.json({ success: true, data: roles });
  } catch (error: any) {
    console.error('Error fetching roles:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const user = await requireAdmin(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Only Admin or Staff with staff permission can create roles
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
    const { name, description, permissions } = body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ success: false, error: 'Role name is required' }, { status: 400 });
    }

    if (!permissions || !Array.isArray(permissions)) {
      return NextResponse.json({ success: false, error: 'Permissions must be a list of module keys' }, { status: 400 });
    }

    const role = await createRole(restaurant.id, {
      name: name.trim(),
      description: description?.trim(),
      permissions,
    });

    return NextResponse.json({ success: true, data: role });
  } catch (error: any) {
    if (error.message?.includes('roles_restaurant_id_name_key') || error.message?.includes('duplicate key')) {
      return NextResponse.json({ success: false, error: 'A role with this name already exists' }, { status: 400 });
    }
    console.error('Error creating role:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

