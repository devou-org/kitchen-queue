import { NextRequest, NextResponse } from 'next/server';
import { getProducts, createProduct } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { calculateProductStatus } from '@/lib/validators';

export async function GET() {
  try {
    const products = await getProducts(true);
    return NextResponse.json({ success: true, data: products });
  } catch (error) {
    console.error('Get products error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch products' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // Verify admin token
    const adminToken = request.cookies.get('admin_token')?.value;
    const authHeader = request.headers.get('Authorization')?.replace('Bearer ', '');
    const token = adminToken || authHeader;

    if (!token) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload || !payload.isAdmin) {
      return NextResponse.json({ success: false, error: 'Forbidden - Admin only' }, { status: 403 });
    }

    const body = await request.json();
    const { name, description, price, image_url, stock_quantity, buffer_quantity, category } = body;

    if (!name || !description || !price || !category) {
      return NextResponse.json({ success: false, error: 'Name, description, price, and category are required' }, { status: 400 });
    }

    const stock = parseInt(stock_quantity) || 0;
    const buffer = parseInt(buffer_quantity) || 5;
    const status = calculateProductStatus(stock, buffer);

    const product = await createProduct({
      name: name.trim(),
      description: description.trim(),
      price: parseFloat(price),
      image_url: image_url?.trim() || '',
      stock_quantity: stock,
      buffer_quantity: buffer,
      status,
      category: category.trim(),
    });

    return NextResponse.json({
      success: true,
      data: product,
      message: 'Product created successfully',
    }, { status: 201 });
  } catch (error) {
    console.error('Create product error:', error);
    return NextResponse.json({ success: false, error: 'Failed to create product' }, { status: 500 });
  }
}
