import { NextRequest, NextResponse } from 'next/server';
import { getCounters, createCounter, getRestaurantBySlug } from '@/lib/db';
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

export async function GET(request: NextRequest) {
  try {
    const restaurantId = await resolveRestaurantId(request);
    if (!restaurantId) {
      return NextResponse.json({ success: false, error: 'Restaurant not found or unauthorized' }, { status: 401 });
    }

    const rows = await getCounters(restaurantId);
    return NextResponse.json({ success: true, data: rows });
  } catch (error: any) {
    console.error('Failed to get counters:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const restaurantId = await resolveRestaurantId(request);
    if (!restaurantId) {
      return NextResponse.json({ success: false, error: 'Restaurant not found or unauthorized' }, { status: 401 });
    }

    const data = await request.json();
    if (!data.name) {
      return NextResponse.json({ success: false, error: 'Counter name is required' }, { status: 400 });
    }

    const newCounter = await createCounter(restaurantId, data);
    return NextResponse.json({ success: true, data: newCounter });
  } catch (error: any) {
    console.error('Failed to create counter:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
