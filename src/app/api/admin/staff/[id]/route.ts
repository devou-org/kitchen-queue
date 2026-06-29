import { NextRequest, NextResponse } from 'next/server';
import { updateStaff, deleteStaff, getRestaurantBySlug } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { requireAdmin } from '@/lib/auth';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(request);
  if (!admin || !admin.isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const slug = request.headers.get('x-restaurant-slug') || 'demo';
    const restaurant = await getRestaurantBySlug(slug);
    if (!restaurant) {
      return NextResponse.json({ success: false, error: 'Restaurant not found' }, { status: 404 });
    }

    const { id } = await params;
    const body = await request.json();
    
    if (body.password) {
      body.password = await hashPassword(body.password);
    }

    const updated = await updateStaff(restaurant.id, id, body);
    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    if (error.message?.includes('staffs_email_key')) {
      return NextResponse.json({ success: false, error: 'User with this email already exists' }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(request);
  if (!admin || !admin.isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const slug = request.headers.get('x-restaurant-slug') || 'demo';
    const restaurant = await getRestaurantBySlug(slug);
    if (!restaurant) {
      return NextResponse.json({ success: false, error: 'Restaurant not found' }, { status: 404 });
    }

    const { id } = await params;
    await deleteStaff(restaurant.id, id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
