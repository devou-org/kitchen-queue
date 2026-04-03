import { NextRequest, NextResponse } from 'next/server';
import { getOrderByTicket } from '@/lib/db';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ number: string }> }) {
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

    // Return safe fields only
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
      },
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to fetch order' }, { status: 500 });
  }
}
