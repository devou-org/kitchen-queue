import { NextRequest, NextResponse } from 'next/server';
import { getCategories, createCategory, deleteCategory } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

export async function GET() {
  try {
    const categories = await getCategories();
    return NextResponse.json({ success: true, data: categories });
  } catch (error) {
    console.error('Get categories error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch categories' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // Admin only
    const adminToken = request.cookies.get('admin_token')?.value;
    const authHeader = request.headers.get('Authorization')?.replace('Bearer ', '');
    const token = adminToken || authHeader;

    if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload || !payload.isAdmin) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });

    const { name } = await request.json();
    if (!name?.trim()) return NextResponse.json({ success: false, error: 'Name is required' }, { status: 400 });

    const category = await createCategory(name.trim());
    return NextResponse.json({ success: true, data: category });
  } catch (error) {
    console.error('Create category error:', error);
    return NextResponse.json({ success: false, error: 'Failed to create category' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
     // Admin only
     const adminToken = request.cookies.get('admin_token')?.value;
     const authHeader = request.headers.get('Authorization')?.replace('Bearer ', '');
     const token = adminToken || authHeader;
 
     if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
     const payload = await verifyToken(token);
     if (!payload || !payload.isAdmin) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ success: false, error: 'ID is required' }, { status: 400 });

    await deleteCategory(id);
    return NextResponse.json({ success: true, message: 'Category deleted' });
  } catch (error) {
    console.error('Delete category error:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete category' }, { status: 500 });
  }
}
