import { NextRequest, NextResponse } from 'next/server';
import { getOrderByTicket, getRestaurantBySlug } from '@/lib/db';
import { getAuthContext } from '@/lib/auth';

export async function GET(request: NextRequest, { params }: { params: Promise<{ number: string }> }) {
  try {
    const slug = request.headers.get('x-restaurant-slug') || 'demo';
    const restaurant = await getRestaurantBySlug(slug);
    
    if (!restaurant) {
       return NextResponse.json({ success: false, error: 'Restaurant not found' }, { status: 404 });
    }

    const { number } = await params;
    const ticketNumber = parseInt(number);

    if (isNaN(ticketNumber)) {
      return NextResponse.json({ success: false, error: 'Invalid ticket number' }, { status: 400 });
    }

    const order = await getOrderByTicket(restaurant.id, ticketNumber);
    if (!order) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
    }

    // Security: Verify user has permission to view this order
    const { admin, customer } = await getAuthContext(request);

    if (!admin && !customer) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // If not admin, the token's phone number must match the order's phone number
    if (!admin && customer?.phone !== order.phone) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
    }

    return NextResponse.json({
      success: true,
      data: order,
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to fetch order' }, { status: 500 });
  }
}
