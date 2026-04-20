import { NextRequest, NextResponse } from 'next/server';
import { getProductById, updateProduct, softDeleteProduct } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { calculateProductStatus } from '@/lib/validators';
import { pusherServer } from '@/lib/pusher';

async function requireAdmin(request: NextRequest) {
  const adminToken = request.cookies.get('admin_token')?.value;
  const authHeader = request.headers.get('Authorization')?.replace('Bearer ', '');
  const token = adminToken || authHeader;
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload?.isAdmin) return null;
  return payload;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const product = await getProductById(id);
    if (!product) return NextResponse.json({ success: false, error: 'Product not found' }, { status: 404 });
    return NextResponse.json({ success: true, data: product });
  } catch (error) {
    console.error('Get product error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch product' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const body = await request.json();

    if (body.stock_quantity !== undefined || body.buffer_quantity !== undefined) {
      const existing = await getProductById(id);
      if (existing) {
        const stock = body.stock_quantity !== undefined ? parseInt(body.stock_quantity) : existing.stock_quantity;
        const buffer = body.buffer_quantity !== undefined ? parseInt(body.buffer_quantity) : existing.buffer_quantity;
        body.status = calculateProductStatus(stock, buffer);
      }
    }

    const product = await updateProduct(id, body);
    if (!product) return NextResponse.json({ success: false, error: 'Product not found' }, { status: 404 });

    // Broadcast to customers via Pusher
    // await pusherServer.trigger('queue-channel', 'product_update', {
    //   type: 'product_update',
    //   product_id: id,
    //   product_status: product.status,
    //   timestamp: new Date().toISOString(),
    // });

    return NextResponse.json({ success: true, data: product, message: 'Product updated' });
  } catch (error) {
    console.error('Update product error:', error);
    return NextResponse.json({ success: false, error: 'Failed to update product' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    await softDeleteProduct(id);
    return NextResponse.json({ success: true, message: 'Product deleted' });
  } catch (error) {
    console.error('Delete product error:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete product' }, { status: 500 });
  }
}
