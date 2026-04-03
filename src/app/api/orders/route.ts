import { NextRequest, NextResponse } from 'next/server';
import { getOrders, createOrder } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { sseManager } from '@/lib/sse';

async function requireAdmin(request: NextRequest) {
  const adminToken = request.cookies.get('admin_token')?.value;
  const authHeader = request.headers.get('Authorization')?.replace('Bearer ', '');
  const token = adminToken || authHeader;
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload?.isAdmin) return null;
  return payload;
}

export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const filters = {
      status: searchParams.get('status') || undefined,
      date_from: searchParams.get('date_from') || undefined,
      date_to: searchParams.get('date_to') || undefined,
      phone: searchParams.get('phone') || undefined,
      page: parseInt(searchParams.get('page') || '1'),
      per_page: parseInt(searchParams.get('per_page') || '50'),
    };

    const orders = await getOrders(filters);
    return NextResponse.json({ success: true, data: orders, total: orders.length });
  } catch (error) {
    console.error('Get orders error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch orders' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { customer_name, phone, items, notes, party_size } = body;

    if (!customer_name || !phone || !items || !items.length) {
      return NextResponse.json({
        success: false,
        error: 'Customer name, phone, and items are required'
      }, { status: 400 });
    }

    // Calculate total
    let total_price = 0;
    for (const item of items) {
      total_price += item.price_at_purchase * item.quantity;
    }
    // Add 10% tax
    total_price = Math.round(total_price * 1.10 * 100) / 100;

    const order = await createOrder({
      customer_name: customer_name.trim(),
      phone,
      total_price,
      notes,
      party_size: party_size || 1,
      items,
    });

    const sseData = {
      type: 'new_order',
      order_id: order.id,
      ticket_number: order.ticket_number,
      timestamp: new Date().toISOString()
    };
    sseManager.broadcast(sseData);

    return NextResponse.json({
      success: true,
      data: order,
      message: 'Order placed successfully!',
    }, { status: 201 });
  } catch (error) {
    console.error('Create order error:', error);
    return NextResponse.json({ success: false, error: 'Failed to create order' }, { status: 500 });
  }
}
