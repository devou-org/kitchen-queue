import { NextRequest, NextResponse } from 'next/server';
import { getOrderByTicket } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

export async function GET(request: NextRequest, { params }: { params: Promise<{ number: string }> }) {
  try {
    const { number } = await params;
    const ticketNumber = parseInt(number);

    if (isNaN(ticketNumber)) {
      return NextResponse.json({ success: false, error: 'Invalid ticket number' }, { status: 400 });
    }

    const order = await getOrderByTicket(ticketNumber);
    if (!order) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
    }

    // Security: Verify user has permission to view this order
    const adminToken = request.cookies.get('admin_token')?.value;
    const authToken = request.cookies.get('auth_token')?.value;
    const authHeader = request.headers.get('Authorization')?.replace('Bearer ', '');
    const token = adminToken || authToken || authHeader;

    if (!token) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 });
    }

    // If not admin, the token's phone number must match the order's phone number
    if (!payload.isAdmin && payload.phone !== order.phone) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
    }

    return NextResponse.json({
      success: true,
      data: {
        id: order.id,
        ticket_number: order.ticket_number,
        customer_name: order.customer_name,
        status: order.status,
        total_price: order.total_price,
        items: order.items,
        created_at: order.created_at,
        party_size: order.party_size,
        notes: order.notes,
        queue_position: order.queue_position,
      },
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to fetch order' }, { status: 500 });
  }
}
