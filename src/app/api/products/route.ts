import { NextRequest, NextResponse } from 'next/server';
import { getProducts, createProduct, getRestaurantBySlug } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { calculateProductStatus } from '@/lib/validators';

export async function GET(request: NextRequest) {
  try {
    let slug = request.headers.get('x-restaurant-slug') || 'demo';
    if (['admin', 'staff', 'super-admin', 'api'].includes(slug)) {
      slug = 'demo';
    }
    let restaurant = await getRestaurantBySlug(slug);
    if (!restaurant) {
      restaurant = await getRestaurantBySlug('demo');
    }
    
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
    const admin = await requireAdmin(request);
    if (!admin || (!admin.isAdmin && !admin.isStaff)) {
      return NextResponse.json({ success: false, error: 'Forbidden - Admin or Staff only' }, { status: 403 });
    }

    let slug = request.headers.get('x-restaurant-slug');
    if (!slug || ['admin', 'staff', 'super-admin', 'api'].includes(slug)) {
      slug = admin.restaurantSlug || 'demo';
    }

    let restaurant = await getRestaurantBySlug(slug);
    if (!restaurant && admin.restaurantId) {
      const { getRestaurantById } = await import('@/lib/db');
      restaurant = await getRestaurantById(admin.restaurantId);
    }
    if (!restaurant) {
      restaurant = await getRestaurantBySlug('demo');
    }

    if (!restaurant) {
       return NextResponse.json({ success: false, error: 'Restaurant not found' }, { status: 404 });
    }

    const body = await request.json();
    const { name, description, price, image_url, stock_quantity, buffer_quantity, category, dietary_preference, status: bodyStatus } = body;

    if (!name || price === undefined || price === null || price === '' || !category) {
      return NextResponse.json({ success: false, error: 'Name, price, and category are required' }, { status: 400 });
    }

    const parsedPrice = parseFloat(price);
    if (isNaN(parsedPrice) || parsedPrice < 0) {
      return NextResponse.json({ success: false, error: 'Price must be a non-negative number' }, { status: 400 });
    }

    const stock = stock_quantity !== undefined && stock_quantity !== '' ? parseInt(stock_quantity) : 0;
    const buffer = buffer_quantity !== undefined && buffer_quantity !== '' ? parseInt(buffer_quantity) : 0;

    if (stock < 0 || buffer < 0) {
      return NextResponse.json({ success: false, error: 'Stock and buffer quantities cannot be negative' }, { status: 400 });
    }

    const trimmedName = name.trim();
    const existingProducts = await getProducts(restaurant.id);
    const isDuplicate = existingProducts.some((p: any) => p.name.toLowerCase() === trimmedName.toLowerCase());
    
    if (isDuplicate) {
      return NextResponse.json({ success: false, error: 'A product with this name already exists' }, { status: 400 });
    }

    // Default status handling: if untracked (stock=0, buffer=0) or body.status is explicit, respect it
    let status = bodyStatus || 'AVAILABLE';
    if (stock_quantity !== undefined || buffer_quantity !== undefined) {
      status = calculateProductStatus(stock, buffer);
    }

    const product = await createProduct({
      restaurant_id: restaurant.id,
      name: trimmedName,
      description: description?.trim() || '',
      price: parsedPrice,
      image_url: image_url?.trim() || '',
      stock_quantity: stock,
      buffer_quantity: buffer,
      status,
      category: category.trim(),
      dietary_preference: dietary_preference?.trim() || 'NON_VEG',
    });

    return NextResponse.json({
      success: true,
      data: product,
      message: 'Product created successfully',
    }, { status: 201 });
  } catch (error: any) {
    console.error('Create product error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Failed to create product' }, { status: 500 });
  }
}
