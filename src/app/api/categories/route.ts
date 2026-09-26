import { NextRequest, NextResponse } from 'next/server';
import { getCategories, createCategory, deleteCategory, getRestaurantBySlug } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const slug = request.headers.get('x-restaurant-slug');
    let restaurantId: string | undefined = undefined;

    if (slug) {
      const restaurant = await getRestaurantBySlug(slug);
      if (restaurant) {
        restaurantId = restaurant.id;
      }
    }

    if (!restaurantId) {
      const admin = await requireAdmin(request);
      if (admin && (admin.restaurantId || (admin as any).restaurant_id)) {
        restaurantId = admin.restaurantId || (admin as any).restaurant_id;
      }
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

    const slug = request.headers.get('x-restaurant-slug');
    let restaurantId = admin.restaurantId || (admin as any).restaurant_id;

    if (slug && !restaurantId) {
      const restaurant = await getRestaurantBySlug(slug);
      if (restaurant) restaurantId = restaurant.id;
    }

    const { name } = await request.json();
    if (!name) return NextResponse.json({ success: false, error: 'Name is required' }, { status: 400 });

    const trimmedName = name.trim();
    const existingCategories = await getCategories(restaurantId);
    const isDuplicate = existingCategories.some((c: any) => c.name.toLowerCase() === trimmedName.toLowerCase());

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

    const slug = request.headers.get('x-restaurant-slug');
    let restaurantId = admin.restaurantId || (admin as any).restaurant_id;

    if (slug && !restaurantId) {
      const restaurant = await getRestaurantBySlug(slug);
      if (restaurant) restaurantId = restaurant.id;
    }

    const { id, name } = await request.json();
    const target = id || name;
    if (!target) return NextResponse.json({ success: false, error: 'Category ID or Name is required' }, { status: 400 });

    await deleteCategory(target, restaurantId);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('❌ API Error (DELETE /api/categories):', error);
    return NextResponse.json({ success: false, error: error?.message || 'Failed to delete category' }, { status: 500 });
  }
}
