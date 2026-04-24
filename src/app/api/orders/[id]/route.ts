import { NextRequest, NextResponse } from 'next/server';
import sql, { getOrderById, updateOrderStatus, setOrderPaymentStatus, updateOrderDetails } from '@/lib/db';
import { Order, OrderItem } from '@/types';
import { verifyToken } from '@/lib/auth';
import { STATUS_TRANSITIONS } from '@/lib/constants';
import { pusherServer } from '@/lib/pusher';
import { validatePhone } from '@/lib/validators';

const CUSTOMER_ADDABLE_STATUSES = ['PENDING', 'PREPARING', 'READY'];

async function requireAdmin(request: NextRequest) {
  // --- TEST BYPASS (Development only) ---
  if (process.env.NODE_ENV === 'development' && request.headers.get('x-test-bypass') === 'true') {
    return { isAdmin: true, userId: 'test-admin' };
  }

  const adminToken = request.cookies.get('admin_token')?.value;
  const authHeader = request.headers.get('Authorization')?.replace('Bearer ', '');
  const token = adminToken || authHeader;
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload?.isAdmin) return null;
  return payload;
}

async function getAuthContext(request: NextRequest) {
  // --- TEST BYPASS (Development only) ---
  if (process.env.NODE_ENV === 'development' && request.headers.get('x-test-bypass') === 'true') {
    return { admin: { isAdmin: true, userId: 'test-admin' }, customer: null };
  }

  const adminToken = request.cookies.get('admin_token')?.value;
  const authHeader = request.headers.get('Authorization')?.replace('Bearer ', '');
  const token = adminToken || authHeader;
  if (!token) return { admin: null, customer: null };
  const payload = await verifyToken(token);
  if (!payload) return { admin: null, customer: null };
  if (payload.isAdmin) return { admin: payload, customer: null };
  return { admin: null, customer: payload };
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
    const { id } = await params;
    const body = await request.json();
    const { status, is_paid, table_number, customer_name, phone, notes, party_size, items } = body;

    const existing = await getOrderById(id);
    if (!existing) return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });

    // ── AUTH: check who is calling ──────────────────────────────
    const { admin, customer } = await getAuthContext(request);

    if (!admin && !customer) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Customer may ONLY update items, and only when order is PENDING/PREPARING
    if (!admin && customer) {
      // 🛡️ CHECK SERVICE STATUS FOR CUSTOMERS
      const settings = await sql`SELECT is_service_active, service_message FROM queue_state WHERE id = 1 LIMIT 1` as {is_service_active: boolean, service_message: string}[];
      if (settings[0] && !settings[0].is_service_active) {
        return NextResponse.json({
          success: false,
          error: settings[0].service_message || 'Service is not started'
        }, { status: 403 });
      }

      // Customers can only touch `items`
      if (status || typeof is_paid !== 'undefined' || table_number || customer_name || phone || notes !== undefined || party_size) {
        return NextResponse.json({ success: false, error: 'Customers can only add items to an order' }, { status: 403 });
      }
      if (!Array.isArray(items)) {
        return NextResponse.json({ success: false, error: 'No items provided' }, { status: 400 });
      }
      
      // ... rest of the customer logic

      // 🛡️ SECURITY FIX: Enforce that customers CANNOT remove items or decrease quantities.
      // E.g., someone intercepting the API request to delete items after the kitchen started cooking.
      const existingQtyMap = new Map<string, number>();
      for (const item of (existing.items || [])) {
        existingQtyMap.set(item.product_id, (existingQtyMap.get(item.product_id) || 0) + Number(item.quantity));
      }
      const newQtyMap = new Map<string, number>();
      for (const item of items) {
        newQtyMap.set(item.product_id, (newQtyMap.get(item.product_id) || 0) + Number(item.quantity || 0));
      }
      for (const [productId, oldQty] of existingQtyMap.entries()) {
        const newQty = newQtyMap.get(productId) || 0;
        if (newQty < oldQty) {
          return NextResponse.json({ 
            success: false, 
            error: 'Customers cannot remove items or decrease quantities once an order is placed.' 
          }, { status: 403 });
        }
      }
      if (!CUSTOMER_ADDABLE_STATUSES.includes(existing.status)) {
        return NextResponse.json({
          success: false,
          error: `Cannot add items to an order in ${existing.status} state`,
        }, { status: 400 });
      }
      // Verify the order belongs to this customer (by phone)
      if (customer.phone && existing.phone !== customer.phone) {
        return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
      }
    }

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

      // 🔔 BROADCAST DETAILS UPDATE (With added items specific info)
      try {
        let addedItemsList: { product_name: string; quantity: number }[] = [];
        
        if (Array.isArray(items)) {
          const oldItemsMap = new Map((existing.items as OrderItem[] || []).map((i: OrderItem) => [i.product_id, i.quantity]));
          const productIdsToFetch = new Set<string>();
          
          const deltas: { product_id: string; quantity: number }[] = [];
          for (const item of items) {
            const oldQty = oldItemsMap.get(item.product_id) || 0;
            if (item.quantity > oldQty) {
              deltas.push({ product_id: item.product_id, quantity: item.quantity - oldQty });
              productIdsToFetch.add(item.product_id);
            }
          }

          if (deltas.length > 0) {
            const products = await sql`SELECT id, name FROM products WHERE id = ANY(${Array.from(productIdsToFetch)})` as {id: string, name: string}[];
            const nameMap = new Map<string, string>((products || []).map((p: {id: string, name: string}) => [p.id, p.name]));
            
            addedItemsList = deltas.map(d => ({
              product_name: (nameMap.get(d.product_id) || 'Unknown Item') as string,
              quantity: d.quantity
            }));
          }
        }

        await pusherServer.trigger('queue-channel', 'order_update', {
          type: 'order_update',
          items_updated: Array.isArray(payload.items),
          added_items: addedItemsList.length > 0 ? addedItemsList : undefined,
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
  } catch (error: any) {
    console.error("❌ Order Update Runtime Error:", error);
    const message = error?.message || 'Failed to update order';
    // Business-logic errors (stock, invalid transition, validation) → 400
    // Everything else (DB crash, etc.) → 500
    const isBusinessError = typeof message === 'string' && (
      message.startsWith('Insufficient stock') ||
      message.startsWith('Cannot transition') ||
      message.includes('required') ||
      message.includes('invalid') ||
      message.includes('not found') ||
      message.includes('Forbidden')
    );
    return NextResponse.json({ success: false, error: message }, { status: isBusinessError ? 400 : 500 });
  }
}