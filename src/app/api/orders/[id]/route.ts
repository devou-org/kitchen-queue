import { NextRequest, NextResponse } from 'next/server';
import { getOrderById, updateOrderStatus, setOrderPaymentStatus, updateOrderDetails } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { STATUS_TRANSITIONS } from '@/lib/constants';
import { pusherServer } from '@/lib/pusher';
import { validatePhone } from '@/lib/validators';

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
    const { status, is_paid, table_number, customer_name, phone, notes, party_size, items } = body;

    const existing = await getOrderById(id);
    if (!existing) return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });

    let order = existing;

    const shouldUpdateDetails =
      typeof customer_name === 'string'
      || typeof phone === 'string'
      || typeof notes === 'string'
      || notes === null
      || typeof party_size === 'number'
      || Array.isArray(items);

    if (shouldUpdateDetails) {
      const payload: {
        customer_name?: string;
        phone?: string;
        notes?: string | null;
        party_size?: number;
        table_number?: string | null;
        items?: { product_id: string; quantity: number }[];
      } = {};

      if (typeof customer_name === 'string') {
        const nextName = customer_name.trim();
        if (!nextName) {
          return NextResponse.json({ success: false, error: 'Customer name cannot be empty' }, { status: 400 });
        }
        payload.customer_name = nextName;
      }

      if (typeof phone === 'string') {
        const phoneValidation = validatePhone(phone);
        if (!phoneValidation.valid) {
          return NextResponse.json({ success: false, error: phoneValidation.message || 'Invalid phone number' }, { status: 400 });
        }
        payload.phone = phone.trim();
      }

      if (typeof notes === 'string' || notes === null) {
        payload.notes = notes;
      }

      if (typeof party_size === 'number') {
        if (!Number.isInteger(party_size) || party_size <= 0) {
          return NextResponse.json({ success: false, error: 'Party size must be a positive whole number' }, { status: 400 });
        }
        payload.party_size = party_size;
      }

      if (Array.isArray(items)) {
        payload.items = items;
      }

      order = await updateOrderDetails(id, payload);

      try {
        await pusherServer.trigger('queue-channel', 'order_update', {
          type: 'order_update',
          order_id: id,
          ticket_number: existing.ticket_number,
          new_status: order.status,
          table_number: order.table_number,
          is_paid: order.is_paid,
          timestamp: new Date().toISOString(),
        });
      } catch (pushErr) {
        console.error('❌ Pusher trigger failed (order details update):', pushErr);
      }
    }

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

      // ✅ STOCK RESTORATION: If transitioning TO 'CANCELLED' from anything else
      if (status === 'CANCELLED' && existing.status !== 'CANCELLED') {
        try {
          // 1. Get database instance (import sql from lib/db) or use a helper
          // Actually, let's use a helper in db.ts to keep this clean
          const { restoreOrderStock } = await import('@/lib/db');
          await restoreOrderStock(id);
          console.log(`📦 Restored stock for Cancelled Order #${existing.ticket_number}`);
        } catch (stockErr) {
          console.error("❌ Failed to restore stock during cancellation:", stockErr);
          // We don't fail the status update, but we log the error
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