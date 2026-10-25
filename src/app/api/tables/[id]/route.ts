import { NextRequest, NextResponse } from 'next/server';
import { getRestaurantBySlug } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { TablesService } from '@/modules/tables/tables.service';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const slug = request.headers.get('x-restaurant-slug') || 'demo';
    const restaurant = await getRestaurantBySlug(slug);

    if (!restaurant) {
      return NextResponse.json({ success: false, error: 'Restaurant not found' }, { status: 404 });
    }

    const admin = await requireAdmin(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { table_number, capacity, status } = body;

    const updatedTable = await TablesService.updateTable(id, restaurant.id, restaurant.slug, {
      table_number: table_number !== undefined ? String(table_number) : undefined,
      capacity: capacity !== undefined ? parseInt(capacity, 10) : undefined,
      status
    });

    return NextResponse.json({
      success: true,
      table: updatedTable,
      message: 'Table updated successfully!'
    });
  } catch (error: any) {
    console.error('PATCH /api/tables/[id] error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Failed to update table' }, { status: 400 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const slug = request.headers.get('x-restaurant-slug') || 'demo';
    const restaurant = await getRestaurantBySlug(slug);

    if (!restaurant) {
      return NextResponse.json({ success: false, error: 'Restaurant not found' }, { status: 404 });
    }

    const admin = await requireAdmin(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    await TablesService.deleteTable(id, restaurant.id);

    return NextResponse.json({
      success: true,
      message: 'Table deleted successfully!'
    });
  } catch (error: any) {
    console.error('DELETE /api/tables/[id] error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Failed to delete table' }, { status: 400 });
  }
}
