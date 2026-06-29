import { NextRequest, NextResponse } from 'next/server';
import { getProducts, getProductById, updateProduct, softDeleteProduct, getRestaurantBySlug } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { calculateProductStatus } from '@/lib/validators';
import { pusherServer } from '@/lib/pusher';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const slug = request.headers.get('x-restaurant-slug') || 'demo';
    const restaurant = await getRestaurantBySlug(slug);
    
    if (!restaurant) {
       return NextResponse.json({ success: false, error: 'Restaurant not found' }, { status: 404 });
    }

    const { id } = await params;
    const product = await getProductById(restaurant.id, id);
    if (!product) return NextResponse.json({ success: false, error: 'Product not found' }, { status: 404 });
    return NextResponse.json({ success: true, data: product });
  } catch (error) {
    console.error('Get product error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch product' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const slug = request.headers.get('x-restaurant-slug') || 'demo';
    const restaurant = await getRestaurantBySlug(slug);
    
    if (!restaurant) {
       return NextResponse.json({ success: false, error: 'Restaurant not found' }, { status: 404 });
    }

    const admin = await requireAdmin(request);
    if (!admin) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const body = await request.json();

    // Re-verify existing product to handle atomic status calculation
    const existing = await getProductById(restaurant.id, id);
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Product not found' }, { status: 404 });
    }

    if (body.name) {
      const trimmedName = body.name.trim();
      const existingProducts = await getProducts(restaurant.id);
      const isDuplicate = existingProducts.some(
        (p: any) => p.name.toLowerCase() === trimmedName.toLowerCase() && p.id !== id
      );
      if (isDuplicate) {
        return NextResponse.json({ success: false, error: 'A product with this name already exists' }, { status: 400 });
      }
      body.name = trimmedName;
    }

    // Ensure numeric types and prevent negative values
    if (body.stock_quantity !== undefined) {
      body.stock_quantity = parseInt(body.stock_quantity.toString());
      if (body.stock_quantity < 0) return NextResponse.json({ success: false, error: 'Stock cannot be negative' }, { status: 400 });
    }
    if (body.buffer_quantity !== undefined) {
      body.buffer_quantity = parseInt(body.buffer_quantity.toString());
      if (body.buffer_quantity < 0) return NextResponse.json({ success: false, error: 'Buffer cannot be negative' }, { status: 400 });
    }
    if (body.price !== undefined) {
      body.price = parseFloat(body.price.toString());
      if (body.price < 0) return NextResponse.json({ success: false, error: 'Price cannot be negative' }, { status: 400 });
    }

    // Recalculate status if stock or buffer changed
    if (body.stock_quantity !== undefined || body.buffer_quantity !== undefined) {
      const stock = body.stock_quantity ?? existing.stock_quantity;
      const buffer = body.buffer_quantity ?? existing.buffer_quantity;
      body.status = calculateProductStatus(stock, buffer);
    }

    const product = await updateProduct(restaurant.id, id, body);
    if (!product) return NextResponse.json({ success: false, error: 'Failed to update product record' }, { status: 500 });

    const channelName = `queue-channel-${restaurant.id}`;
    await pusherServer.trigger(channelName, 'product_updated', product);

    return NextResponse.json({ success: true, data: product, message: 'Product updated' });
  } catch (error) {
    console.error('Update product error:', error);
    return NextResponse.json({ success: false, error: 'Failed to update product' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const slug = request.headers.get('x-restaurant-slug') || 'demo';
    const restaurant = await getRestaurantBySlug(slug);
    
    if (!restaurant) {
       return NextResponse.json({ success: false, error: 'Restaurant not found' }, { status: 404 });
    }

    const admin = await requireAdmin(request);
    if (!admin) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    await softDeleteProduct(restaurant.id, id);
    
    const channelName = `queue-channel-${restaurant.id}`;
    await pusherServer.trigger(channelName, 'product_deleted', { id });

    return NextResponse.json({ success: true, message: 'Product deleted' });
  } catch (error) {
    console.error('Delete product error:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete product' }, { status: 500 });
  }
}
