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

export async function GET(request: NextRequest) {
  try {
    const slug = await resolveSlug(request);
    const restaurant = await getRestaurantBySlug(slug);

    if (!restaurant) {
      return NextResponse.json({ success: false, error: `Restaurant not found for slug: ${slug}` }, { status: 404 });
    }

    const tables = await TablesService.getTables(restaurant.id);

    return NextResponse.json({
      success: true,
      tables
    });
  } catch (error: any) {
    console.error('GET /api/tables error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Failed to fetch tables' }, { status: 500 });
  }
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
    const { table_number, capacity } = body;

    if (!table_number || !table_number.trim()) {
      return NextResponse.json({ success: false, error: 'Table number is required' }, { status: 400 });
    }

    const table = await TablesService.createTable(
      restaurant.id,
      restaurant.slug,
      table_number,
      parseInt(capacity || '4', 10)
    );

    return NextResponse.json({
      success: true,
      table,
      message: `Table ${table.table_number} created successfully!`
    }, { status: 201 });
  } catch (error: any) {
    console.error('POST /api/tables error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Failed to create table' }, { status: 400 });
  }
}
