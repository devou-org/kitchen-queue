import { NextRequest, NextResponse } from 'next/server';
import { updateCounter, deleteCounter, getRestaurantBySlug } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

async function resolveRestaurantId(request: NextRequest): Promise<string | null> {
  const admin = await requireAdmin(request);
  if (admin?.restaurantId) return admin.restaurantId;

  const headerSlug = request.headers.get('x-restaurant-slug');
  const { searchParams } = new URL(request.url);
  const querySlug = searchParams.get('slug');
  const slug = querySlug?.trim() || headerSlug?.trim() || admin?.restaurantSlug;

  if (slug) {
    const restaurant = await getRestaurantBySlug(slug);
    if (restaurant) return restaurant.id;
  }
  return null;
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> | { id: string } }) {
  try {
    const restaurantId = await resolveRestaurantId(request);
    if (!restaurantId) {
      return NextResponse.json({ success: false, error: 'Restaurant not found or unauthorized' }, { status: 401 });
    }

    const resolvedParams = await params;
    const { id } = resolvedParams;
    const data = await request.json();

    const updated = await updateCounter(restaurantId, id, data);
    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    console.error('Failed to update counter:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> | { id: string } }) {
  try {
    const restaurantId = await resolveRestaurantId(request);
    if (!restaurantId) {
      return NextResponse.json({ success: false, error: 'Restaurant not found or unauthorized' }, { status: 401 });
    }

    const resolvedParams = await params;
    const { id } = resolvedParams;
    const deleted = await deleteCounter(restaurantId, id);
    return NextResponse.json({ success: true, data: { deleted } });
  } catch (error: any) {
    console.error('Failed to delete counter:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
