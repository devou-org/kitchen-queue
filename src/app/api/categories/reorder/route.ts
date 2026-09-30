import { NextRequest, NextResponse } from 'next/server';
import { reorderCategories, updateCategorySequence, getRestaurantBySlug } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const slug = request.headers.get('x-restaurant-slug');
    let restaurantId = admin.restaurantId || (admin as any).restaurant_id;

    if (slug && !restaurantId) {
      const restaurant = await getRestaurantBySlug(slug);
      if (restaurant) restaurantId = restaurant.id;
    }

    if (!restaurantId) {
      return NextResponse.json({ success: false, error: 'Restaurant context required' }, { status: 400 });
    }

    const body = await request.json();
    const { categoryId, direction, orderedCategoryIds } = body;

    if (Array.isArray(orderedCategoryIds) && orderedCategoryIds.length > 0) {
      const result = await updateCategorySequence(restaurantId, orderedCategoryIds);
      if (!result.success) {
        return NextResponse.json({ success: false, error: result.error || 'Failed to update category order' }, { status: 500 });
      }
      return NextResponse.json({ success: true, data: result.categories });
    }

    if (!categoryId || (direction !== 'up' && direction !== 'down')) {
      return NextResponse.json({ success: false, error: 'categoryId and direction ("up" | "down") or orderedCategoryIds are required' }, { status: 400 });
    }

    const result = await reorderCategories(restaurantId, categoryId, direction);
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error || 'Failed to reorder' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: result.categories });
  } catch (error: any) {
    console.error('❌ API Error (POST /api/categories/reorder):', error);
    return NextResponse.json({ success: false, error: error?.message || 'Failed to reorder category' }, { status: 500 });
  }
}

