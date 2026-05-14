import { NextRequest, NextResponse } from 'next/server';
import { getOrdersByPhone, getRestaurantBySlug } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const slug = request.headers.get('x-restaurant-slug') || 'demo';
    const restaurant = await getRestaurantBySlug(slug);
    
    if (!restaurant) {
       return NextResponse.json({ success: false, error: 'Restaurant not found' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const queryPhone = searchParams.get('phone');
    
    // Get token from cookie or header
    const authHeader = request.headers.get('Authorization')?.replace('Bearer ', '');
    const token = request.cookies.get('auth_token')?.value || authHeader;
    
    let phoneToUse = queryPhone;

    if (token) {
      const payload = await verifyToken(token);
      if (payload && payload.phone) {
        phoneToUse = payload.phone;
      }
    }

    if (!phoneToUse) {
      return NextResponse.json({ success: false, error: 'Authentication or phone number required' }, { status: 401 });
    }

    const orders = await getOrdersByPhone(restaurant.id, phoneToUse);
    return NextResponse.json({ success: true, data: orders });
  } catch (error) {
    console.error('History fetch error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch history' }, { status: 500 });
  }
}
