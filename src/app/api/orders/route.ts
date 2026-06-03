import { NextRequest, NextResponse } from 'next/server';
import { getOrders, getOrderStats, createOrder, createUser } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { pusherServer } from '@/lib/pusher';

async function requireAdmin(request: NextRequest) {
  const adminToken = request.cookies.get('admin_token')?.value;
  const staffToken = request.cookies.get('staff_token')?.value;
  const authHeader = request.headers.get('Authorization')?.replace('Bearer ', '');
  const token = adminToken || staffToken || authHeader;
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload?.isAdmin && !payload?.isStaff) return null;
  return payload;
}

export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const filters = {
      status: searchParams.get('status') || undefined,
      status_in: searchParams.get('status_in') || undefined,
      date_from: searchParams.get('date_from') || undefined,
      date_to: searchParams.get('date_to') || undefined,
      phone: searchParams.get('phone') || undefined,
      sort: (searchParams.get('sort') as 'ASC' | 'DESC') || undefined,
      page: parseInt(searchParams.get('page') || '1'),
      per_page: parseInt(searchParams.get('per_page') || '50'),
    };

    const orders = await getOrders(filters);
    const statsResult = await getOrderStats(filters);
    const stats = statsResult[0] || {
      total_orders: 0,
      paid_orders: 0,
      total_revenue: 0,
      total_paid_revenue: 0
    };

    return NextResponse.json({ 
      success: true, 
      data: orders, 
      total: orders.length,
      stats: {
        totalRevenue: Number(stats.total_revenue),
        totalPaidRevenue: Number(stats.total_paid_revenue),
        orderCount: Number(stats.total_orders),
        paidCount: Number(stats.paid_orders)
      }
    });
  } catch (error) {
    console.error('Get orders error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch orders' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // 1. Check Service Status FIRST
    const { default: sql } = await import('@/lib/db');
    const settings = await sql`SELECT is_service_active, service_message FROM queue_state WHERE id = 1 LIMIT 1` as {is_service_active: boolean, service_message: string}[];
    
    if (settings[0] && !settings[0].is_service_active) {
      return NextResponse.json({
        success: false,
        error: settings[0].service_message || 'Service is not started'
      }, { status: 403 });
    }

    const body = await request.json();
    let { customer_name, phone, items, notes, party_size, table_number } = body;

    // Standardize phone number
    if (phone && phone.startsWith('+91')) {
      phone = phone.replace('+91', '');
    }

    let targetStatus = 'PENDING';
    let targetSource = 'CUSTOMER';
    const adminToken = request.cookies.get('admin_token')?.value;
    const staffToken = request.cookies.get('staff_token')?.value;
    const authHeader = request.headers.get('Authorization')?.replace('Bearer ', '');
    const token = adminToken || staffToken || authHeader;
    if (token) {
      try {
        const payload = await verifyToken(token) as any;
        if (payload?.isStaff || payload?.isAdmin) {
          targetStatus = 'PREPARING';
          targetSource = 'STAFF';
        }
      } catch (e) {
        // Ignore
      }
    }

    if (!customer_name || !phone || !items || !items.length) {
      return NextResponse.json({
        success: false,
        error: 'Customer name, phone, and items are required'
      }, { status: 400 });
    }

    // Calculate total (Tax is 0 as per requirements)
    let total_price = 0;
    for (const item of items) {
      total_price += item.price_at_purchase * item.quantity;
    }
    total_price = Math.round(total_price * 100) / 100;

    // 2. Ensure user exists to link the order
    let user_id: string | undefined = undefined;
    try {
      const user = await createUser(phone, customer_name.trim());
      if (user && user.id) {
        user_id = user.id;
      }
    } catch {
      // Non-critical — don't fail the order if user creation fails
    }

    const order = await createOrder({
      customer_name: customer_name.trim(),
      phone,
      total_price,
      notes,
      party_size: party_size || 1,
      items,
      status: targetStatus,
      source: targetSource,
      user_id
    });

    if (table_number) {
      const { updateOrderStatus } = await import('@/lib/db');
      await updateOrderStatus(order.id, targetStatus, table_number);
      order.table_number = table_number;
    }

    try {
      const sseData = {
        type: 'new_order',
        order_id: order.id,
        ticket_number: order.ticket_number,
        timestamp: new Date().toISOString()
      };
      console.log('🚀 About to trigger new_order event...');
      await pusherServer.trigger('queue-channel', 'new_order', sseData);
    } catch (pushErr) {
      console.error('Pusher trigger failed, but order was created:', pushErr);
    }

    return NextResponse.json({
      success: true,
      data: order,
      message: 'Order placed successfully!',
    }, { status: 201 });
  } catch (error: any) {
    console.error('Create order error:', error);
    const message = error.message || 'Failed to create order';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
