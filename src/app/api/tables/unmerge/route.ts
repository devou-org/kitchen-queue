import { NextRequest, NextResponse } from 'next/server';
import { getRestaurantBySlug } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { TablesService } from '@/modules/tables/tables.service';

async function resolveSlug(request: NextRequest): Promise<string> {
  const { searchParams } = new URL(request.url);
  const querySlug = searchParams.get('slug');
  const headerSlug = request.headers.get('x-restaurant-slug');

  if (querySlug && querySlug.trim()) return querySlug.trim();
  if (headerSlug && headerSlug.trim() && headerSlug !== 'demo') return headerSlug.trim();

  const authUser = await requireAdmin(request);
  if (authUser?.restaurantSlug) return authUser.restaurantSlug;

  return headerSlug || 'demo';
}

export async function POST(request: NextRequest) {
  try {
    const slug = await resolveSlug(request);
    const restaurant = await getRestaurantBySlug(slug);

    if (!restaurant) {
      return NextResponse.json({ success: false, error: 'Restaurant not found' }, { status: 404 });
    }

    const admin = await requireAdmin(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { table_id } = body;

    if (!table_id) {
      return NextResponse.json({ success: false, error: 'Table ID is required' }, { status: 400 });
    }

    const result = await TablesService.unmergeTable(restaurant.id, table_id);

    return NextResponse.json({
      success: true,
      message: 'Table(s) unmerged successfully',
      result
    });
  } catch (error: any) {
    console.error('POST /api/tables/unmerge error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Failed to unmerge table' }, { status: 400 });
  }
}
