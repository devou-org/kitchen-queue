import { NextRequest, NextResponse } from 'next/server';
import { getCategories, createCategory } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

async function requireAdmin(request: NextRequest) {
  const adminToken = request.cookies.get('admin_token')?.value;
  const authHeader = request.headers.get('Authorization')?.replace('Bearer ', '');
  const token = adminToken || authHeader;
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload?.isAdmin) return null;
  return payload;
}



export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const categories = await getCategories();
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

    const { name } = await request.json();
    if (!name) return NextResponse.json({ success: false, error: 'Name is required' }, { status: 400 });

    const category = await createCategory(name);
    return NextResponse.json({ success: true, data: category });
  } catch (error: any) {
    console.error('❌ API Error (POST /api/categories):', error);
    return NextResponse.json({ success: false, error: error?.message || 'Failed to create category' }, { status: 500 });
  }
}
