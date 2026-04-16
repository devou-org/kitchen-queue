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

    // ✅ ADD AUTHORIZATION
    const authHeader = request.headers.get('Authorization')?.replace('Bearer ', '');
    const cookieToken = request.cookies.get('auth_token')?.value;
    const adminToken = request.cookies.get('admin_token')?.value;
    const token = authHeader || cookieToken || adminToken;

    if (!token) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json({ success: false, error: 'Invalid or expired session' }, { status: 401 });
    }

    // Admin can see any ticket, customer can only see their own
    const isOwner = payload.phone === order.phone;
    const isAdmin = payload.isAdmin === true;

    if (!isOwner && !isAdmin) {
      return NextResponse.json({ success: false, error: 'You do not have permission to view this ticket' }, { status: 403 });
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
    console.error('Ticket fetch error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch order' }, { status: 500 });
  }
}
