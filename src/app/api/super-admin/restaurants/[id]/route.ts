import { NextRequest, NextResponse } from 'next/server';
import { getRestaurantWithModules, updateRestaurant, deleteRestaurant, setAllRestaurantModules } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

async function requireSuperAdmin(request: NextRequest) {
  const token = request.cookies.get('super_admin_token')?.value
    || request.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload?.isSuperAdmin) return null;
  return payload;
}

// GET /api/super-admin/restaurants/[id] — get restaurant + modules
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireSuperAdmin(request);
  if (!admin) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  try {
    const { id } = await params;
    const restaurant = await getRestaurantWithModules(id);
    if (!restaurant) return NextResponse.json({ success: false, error: 'Restaurant not found' }, { status: 404 });
    return NextResponse.json({ success: true, data: restaurant });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to fetch restaurant' }, { status: 500 });
  }
}

// PUT /api/super-admin/restaurants/[id] — update restaurant info + modules
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireSuperAdmin(request);
  if (!admin) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  try {
    const { id } = await params;
    const body = await request.json();
    const { name, slug, phone, address, logo_url, modules } = body;

    if (slug && !/^[a-z0-9-]+$/.test(slug)) {
      return NextResponse.json({ success: false, error: 'Slug must be lowercase letters, numbers, and hyphens only' }, { status: 400 });
    }

    // Update restaurant info
    const restaurant = await updateRestaurant(id, { name, slug, phone, address, logo_url });
    if (!restaurant) return NextResponse.json({ success: false, error: 'Restaurant not found' }, { status: 404 });

    // Update modules if provided
    if (Array.isArray(modules)) {
      await setAllRestaurantModules(id, modules);
    }

    const updated = await getRestaurantWithModules(id);
    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    console.error('Update restaurant error:', error);
    if (error.message?.includes('duplicate') || error.message?.includes('unique')) {
      return NextResponse.json({ success: false, error: 'A restaurant with this slug already exists' }, { status: 409 });
    }
    return NextResponse.json({ success: false, error: 'Failed to update restaurant' }, { status: 500 });
  }
}

// DELETE /api/super-admin/restaurants/[id] — delete restaurant
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireSuperAdmin(request);
  if (!admin) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  try {
    const { id } = await params;
    // Prevent deleting the default demo restaurant
    if (id === '00000000-0000-0000-0000-000000000000') {
      return NextResponse.json({ success: false, error: 'Cannot delete the default demo restaurant' }, { status: 403 });
    }
    await deleteRestaurant(id);
    return NextResponse.json({ success: true, message: 'Restaurant deleted' });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to delete restaurant' }, { status: 500 });
  }
}
