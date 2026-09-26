import { NextRequest, NextResponse } from 'next/server';
import { updateRole, deleteRole, getRestaurantBySlug } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    const { id } = await params;
    const body = await request.json();

    const updated = await updateRole(restaurant.id, id, body);
    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    if (error.message?.includes('roles_restaurant_id_name_key') || error.message?.includes('duplicate key')) {
      return NextResponse.json({ success: false, error: 'A role with this name already exists' }, { status: 400 });
    }
    console.error('Error updating role:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    const { id } = await params;
    await deleteRole(restaurant.id, id);
    return NextResponse.json({ success: true, message: 'Role deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting role:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}

