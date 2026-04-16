import { NextRequest, NextResponse } from 'next/server';
import { getOrderById, updateOrderStatus, setOrderPaymentStatus } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { STATUS_TRANSITIONS } from '@/lib/constants';
import { pusherServer } from '@/lib/pusher';

async function requireAdmin(request: NextRequest) {
  const adminToken = request.cookies.get('admin_token')?.value;
  const authHeader = request.headers.get('Authorization')?.replace('Bearer ', '');
  const token = adminToken || authHeader;
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload?.isAdmin) return null;
  return payload;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const order = await getOrderById(id);
    if (!order) return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
    return NextResponse.json({ success: true, data: order });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to fetch order' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const body = await request.json();
    const { status, is_paid, table_number } = body;

    const existing = await getOrderById(id);
    if (!existing) return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });

    let order = existing;

    // ✅ UPDATE STATUS & TABLE NUMBER
    if (status || table_number) {
      if (status && status !== existing.status) {
        const validTransitions = STATUS_TRANSITIONS[existing.status] || [];
        if (!validTransitions.includes(status)) {
          return NextResponse.json({
            success: false,
            error: `Cannot transition from ${existing.status} to ${status}`,
          }, { status: 400 });
        }
      }

      // Update in DB
      order = await updateOrderStatus(id, status || existing.status, table_number);

      // ✅ AUTO-MARK AS PAID: If status is 'PAID', ensure is_paid is true
      if (status === 'PAID') {
        order = await setOrderPaymentStatus(id, true);
        console.log(`💰 Auto-marked Order #${existing.ticket_number} as PAID due to status change.`);
      }

      console.log(`✅ Order Updated: Order #${existing.ticket_number} → Status: ${status || order.status}, Table: ${table_number || order.table_number}`);

      // 🔔 BROADCAST UPDATE
      try {
        await pusherServer.trigger('queue-channel', 'order_update', {
          type: 'order_update',
          order_id: id,
          ticket_number: existing.ticket_number,
          new_status: status || order.status,
          table_number: table_number || order.table_number,
          is_paid: (status === 'PAID' || order.is_paid),
          timestamp: new Date().toISOString(),
        });
        console.log(`📤 Pusher event sent: order_update for ticket #${existing.ticket_number}`);
      } catch (pushErr) {
        console.error('❌ Pusher trigger failed (order update):', pushErr);
      }
    }

    // ✅ UPDATE PAYMENT STATUS
    if (typeof is_paid === 'boolean') {
      order = await setOrderPaymentStatus(id, is_paid);

      console.log(`✅ Payment updated: Order #${existing.ticket_number} → is_paid: ${is_paid}`);

      // 🔔 BROADCAST PAYMENT CHANGE
      try {
        await pusherServer.trigger('queue-channel', 'order_update', {
          type: 'payment_update',
          order_id: id,
          ticket_number: existing.ticket_number,
          is_paid: is_paid,
          timestamp: new Date().toISOString(),
        });
        console.log(`📤 Pusher event sent: payment_update for ticket #${existing.ticket_number}`);
      } catch (pushErr) {
        console.error('❌ Pusher trigger failed (payment update):', pushErr);
        // Continue anyway - order was updated in DB
      }
    }

    return NextResponse.json({ success: true, data: order, message: 'Order updated' });
  } catch (error) {
    console.error("❌ Order Update Runtime Error:", error);
    return NextResponse.json({ success: false, error: 'Failed to update order' }, { status: 500 });
  }
}