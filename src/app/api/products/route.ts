import { NextRequest, NextResponse } from 'next/server';
import { getProducts, createProduct, getRestaurantBySlug } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { calculateProductStatus } from '@/lib/validators';

export async function GET(request: NextRequest) {
  try {
    const slug = request.headers.get('x-restaurant-slug') || 'demo';
    const restaurant = await getRestaurantBySlug(slug);
    
    if (!restaurant) {
       return NextResponse.json({ success: false, error: 'Restaurant not found' }, { status: 404 });
    }

    const products = await getProducts(restaurant.id, true);
    return NextResponse.json({ success: true, data: products });
  } catch (error) {
    console.error('Get products error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch products' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const slug = request.headers.get('x-restaurant-slug') || 'demo';
    const restaurant = await getRestaurantBySlug(slug);
    
    if (!restaurant) {
       return NextResponse.json({ success: false, error: 'Restaurant not found' }, { status: 404 });
    }

    const admin = await requireAdmin(request);
    // Ideally, we should also check if the admin belongs to this restaurant_id
    if (!admin || !admin.isAdmin) {
      return NextResponse.json({ success: false, error: 'Forbidden - Admin only' }, { status: 403 });
    }

    const body = await request.json();
    const { name, description, price, image_url, stock_quantity, buffer_quantity, category, dietary_preference } = body;

    if (!name || !description || !price || !category) {
      return NextResponse.json({ success: false, error: 'Name, description, price, and category are required' }, { status: 400 });
    }

    const stock = parseInt(stock_quantity) || 0;
    const buffer = parseInt(buffer_quantity) || 5;
    const status = calculateProductStatus(stock, buffer);

    const product = await createProduct({
      restaurant_id: restaurant.id,
      name: name.trim(),
      description: description.trim(),
      price: parseFloat(price),
      image_url: image_url?.trim() || '',
      stock_quantity: stock,
      buffer_quantity: buffer,
      status,
      category: category.trim(),
      dietary_preference: dietary_preference?.trim(),
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
