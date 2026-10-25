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
    const { primary_table_id, secondary_table_ids } = body;

    if (!primary_table_id) {
      return NextResponse.json({ success: false, error: 'Primary table ID is required' }, { status: 400 });
    }

    if (!Array.isArray(secondary_table_ids) || secondary_table_ids.length === 0) {
      return NextResponse.json({ success: false, error: 'Please select at least one table to merge with' }, { status: 400 });
    }

    const result = await TablesService.mergeTables(
      restaurant.id,
      primary_table_id,
      secondary_table_ids
    );

    return NextResponse.json({
      success: true,
      message: `Table #${result.primaryTable.table_number} merged successfully with ${result.mergedTables.map(t => `#${t.table_number}`).join(', ')}`,
      result
    });
  } catch (error: any) {
    console.error('POST /api/tables/merge error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Failed to merge tables' }, { status: 400 });
  }
}
