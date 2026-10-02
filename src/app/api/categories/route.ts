import { NextRequest, NextResponse } from 'next/server';
import { getCategories, createCategory, deleteCategory, getRestaurantBySlug } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

async function resolveRestaurantId(request: NextRequest): Promise<string | undefined> {
  const headerSlug = request.headers.get('x-restaurant-slug');
  const { searchParams } = new URL(request.url);
  const querySlug = searchParams.get('slug');

  let rawSlug = querySlug || headerSlug || '';
  if (rawSlug.startsWith('["') || rawSlug.startsWith("['")) {
    try {
      const parsed = JSON.parse(rawSlug);
      if (Array.isArray(parsed) && parsed[0]) rawSlug = parsed[0];
    } catch {
      // ignore
    }
  }
  const cleanSlug = rawSlug.replace(/[\[\]'"]/g, '').trim();

  if (cleanSlug) {
    const restaurant = await getRestaurantBySlug(cleanSlug);
    if (restaurant) return restaurant.id;
  }

  // Fallback to admin context
  const admin = await requireAdmin(request);
  if (admin) {
    if (admin.restaurantId || (admin as any).restaurant_id) {
      return admin.restaurantId || (admin as any).restaurant_id;
    }
    if (admin.restaurantSlug) {
      const restaurant = await getRestaurantBySlug(admin.restaurantSlug);
      if (restaurant) return restaurant.id;
    }
  }

  return undefined;
}

export async function GET(request: NextRequest) {
  try {
    const restaurantId = await resolveRestaurantId(request);

    if (!restaurantId) {
      return NextResponse.json({ success: false, error: 'Restaurant not found or unauthorized' }, { status: 400 });
    }

    const categories = await getCategories(restaurantId);
    return NextResponse.json({ success: true, data: categories });
  } catch (error: any) {
    console.error('❌ API Error (GET /api/categories):', error);
    return NextResponse.json({ success: false, error: error?.message || 'Failed to fetch categories' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const restaurantId = await resolveRestaurantId(request);
    if (!restaurantId) {
      return NextResponse.json({ success: false, error: 'Restaurant not found' }, { status: 400 });
    }

    const { name } = await request.json();
    if (!name || !name.trim()) {
      return NextResponse.json({ success: false, error: 'Name is required' }, { status: 400 });
    }

    const trimmedName = name.trim();
    const existingCategories = await getCategories(restaurantId);
    const isDuplicate = existingCategories.some(
      (c: any) => c.name.toLowerCase() === trimmedName.toLowerCase()
    );

    if (isDuplicate) {
      return NextResponse.json({ success: false, error: 'Category already exists' }, { status: 400 });
    }

    const category = await createCategory(trimmedName, restaurantId);
    return NextResponse.json({ success: true, data: category });
  } catch (error: any) {
    console.error('❌ API Error (POST /api/categories):', error);
    return NextResponse.json({ success: false, error: error?.message || 'Failed to create category' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const restaurantId = await resolveRestaurantId(request);
    if (!restaurantId) {
      return NextResponse.json({ success: false, error: 'Restaurant not found' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    let categoryId = searchParams.get('id');

    if (!categoryId) {
      try {
        const body = await request.json();
        categoryId = body?.id || null;
      } catch {
        // no body
      }
    }

    if (!categoryId) {
      return NextResponse.json({ success: false, error: 'Category ID is required' }, { status: 400 });
    }

    const result = await deleteCategory(restaurantId, categoryId);
    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    console.error('❌ API Error (DELETE /api/categories):', error);
    return NextResponse.json({ success: false, error: error?.message || 'Failed to delete category' }, { status: 500 });
  }
}
