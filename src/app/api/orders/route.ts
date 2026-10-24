import { NextRequest, NextResponse, after } from 'next/server';
import { getOrders, getOrderStats, createOrder, createUser, getRestaurantBySlug } from '@/lib/db';
import { verifyToken, requireAdmin } from '@/lib/auth';
import { validatePhone } from '@/lib/validators';
import { pusherServer } from '@/lib/pusher';
import { autoQueueAndBroadcastKot } from '@/lib/kot-auto-print';

export async function GET(request: NextRequest) {
  try {
    const slug = request.headers.get('x-restaurant-slug') || 'demo';
    const restaurant = await getRestaurantBySlug(slug);
    
    if (!restaurant) {
       return NextResponse.json({ success: false, error: 'Restaurant not found' }, { status: 404 });
    }

    const admin = await requireAdmin(request);
    if (!admin) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    if (admin.isStaff && admin.restaurantId !== restaurant.id) {
      return NextResponse.json({ success: false, error: 'Forbidden: Wrong restaurant' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const filters = {
      status: searchParams.get('status') || undefined,
      status_in: searchParams.get('status_in') || undefined,
      date_from: searchParams.get('date_from') || undefined,
      date_to: searchParams.get('date_to') || undefined,
      phone: searchParams.get('phone') || undefined,
      payment_method: searchParams.get('payment_method') || undefined,
      order_type: searchParams.get('order_type') || undefined,
      sort: (searchParams.get('sort') as 'ASC' | 'DESC') || undefined,
      page: parseInt(searchParams.get('page') || '1'),
      per_page: parseInt(searchParams.get('per_page') || '50'),
    };

    const orders = await getOrders(restaurant.id, filters);
    const statsResult = await getOrderStats(restaurant.id, filters);
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
        paidCount: Number(stats.paid_orders),
        totalRegularSubtotal: Number(stats.total_regular_subtotal || 0),
        totalRegularGst: Number(stats.total_regular_gst || 0),
        totalCompositionRevenue: Number(stats.total_composition_revenue || 0),
        totalCompositionGst: Number(stats.total_composition_gst || 0),
        totalNoneRevenue: Number(stats.total_none_revenue || 0)
      }
    });
  } catch (error) {
    console.error('Get orders error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch orders' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const slug = request.headers.get('x-restaurant-slug') || 'demo';
    const restaurant = await getRestaurantBySlug(slug);
    
    if (!restaurant) {
       return NextResponse.json({ success: false, error: 'Restaurant not found' }, { status: 404 });
    }

    const admin = await requireAdmin(request);
    if (admin && !admin.isSuperAdmin && admin.restaurantId && admin.restaurantId !== restaurant.id) {
      return NextResponse.json({ success: false, error: 'Forbidden: Wrong restaurant' }, { status: 403 });
    }

    const hasAdminRights = !!admin && (admin.isStaff || admin.isAdmin);

    // 1. Check Service Status FIRST
    const { default: sql } = await import('@/lib/db');
    const settings = await sql`SELECT is_service_active, service_message FROM restaurants WHERE id = ${restaurant.id} LIMIT 1` as {is_service_active: boolean, service_message: string}[];
    
    if (settings[0] && !settings[0].is_service_active) {
      return NextResponse.json({
        success: false,
        error: settings[0].service_message || 'Service is not started'
      }, { status: 403 });
    }

    const body = await request.json();
    const { customer_name, phone, items, notes, party_size, table_number, order_type, is_paid, payment_method, payment_split } = body;
    const isPos = hasAdminRights || body.is_pos === true;

    const cleanedPhone = typeof phone === 'string' ? phone.trim() : '';
    const hasPhone = cleanedPhone !== '';
    const customerName = (typeof customer_name === 'string' ? customer_name.trim() : '') || (isPos ? 'Walk-in' : '');

    // Validation:
    // Items are required for everyone (must be a non-empty array).
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'At least one valid item is required'
      }, { status: 400 });
    }

    // Customers (!isPos) must provide name AND phone, otherwise 400.
    if (!isPos && (!customerName || !hasPhone)) {
      return NextResponse.json({
        success: false,
        error: 'Customer name and phone number are required'
      }, { status: 400 });
    }

    // If a phone is provided (any caller), validate it with validatePhone.
    if (hasPhone) {
      const phoneValidation = validatePhone(cleanedPhone);
      if (!phoneValidation.valid) {
        return NextResponse.json({
          success: false,
          error: phoneValidation.message || 'Invalid phone number'
        }, { status: 400 });
      }
    }

    const cleanPhone = hasPhone ? cleanedPhone.replace(/\D/g, '').slice(-10) : '';

    let effectiveTableNumber = table_number;
    if (order_type !== 'TAKEAWAY' && table_number) {
      const { TablesRepository } = await import('@/modules/tables/tables.repository');
      const { checkTableAssignment } = await import('@/lib/table-capacity');
      const tables = await TablesRepository.getTablesByRestaurant(restaurant.id);
      const leadPart = String(table_number).split('+')[0].trim().toLowerCase();
      const targetTable = tables.find(t =>
        String(t.table_number).trim().toLowerCase() === String(table_number).trim().toLowerCase() ||
        String(t.table_number).trim().toLowerCase() === leadPart
      );
      if (targetTable) {
        // If secondary merged table, map order to primary table
        const parentTable = targetTable.merged_into_table_id
          ? (tables.find(t => t.id === targetTable.merged_into_table_id) || targetTable)
          : targetTable;

        if (String(table_number).includes('+')) {
          effectiveTableNumber = String(table_number).trim();
        } else if (parentTable.merged_table_numbers && parentTable.merged_table_numbers.length > 0) {
          effectiveTableNumber = `${parentTable.table_number}+${parentTable.merged_table_numbers.join('+')}`;
        } else if (targetTable.merged_into_table_id && parentTable) {
          effectiveTableNumber = parentTable.table_number;
        }

        const check = checkTableAssignment(parentTable, party_size || 1, {
          phone: hasPhone ? cleanedPhone : undefined,
          customerName,
        });
        if (!check.allowed) {
          return NextResponse.json({
            success: false,
            error: check.reason || 'Table capacity exceeded.'
          }, { status: 400 });
        }
      }
    }

    // Calculate total and GST
    let subtotal = 0;
    for (const item of items) {
      subtotal += item.price_at_purchase * item.quantity;
    }
    subtotal = Math.round(subtotal * 100) / 100;

    const discount_amount = Math.max(0, Number(body.discount_amount) || 0);

    const gst_type = restaurant.gst_type || 'NONE';
    const gst_rate = Number(restaurant.gst_rate) || 0;
    let gst_amount = 0;
    let total_price = subtotal;

    if (gst_type === 'REGULAR') {
      gst_amount = Math.round((subtotal * gst_rate / 100) * 100) / 100;
      total_price = subtotal + gst_amount;
    }

    total_price = Math.max(0, total_price - discount_amount);

    let splitTotal: number | null = null;
    if (payment_split && typeof payment_split === 'object') {
      const sum = Object.values(payment_split).reduce((acc: number, val: any) => {
        const num = parseFloat(val as string);
        return !isNaN(num) ? acc + num : acc;
      }, 0);
      if (sum > 0) {
        splitTotal = Math.round(sum * 100) / 100;
        total_price = splitTotal;
        if (gst_type !== 'REGULAR') {
          subtotal = splitTotal;
        }
      }
    }

    const isPaid = isPos && Boolean(is_paid);
    const paymentMethod = isPaid ? (payment_method ? String(payment_method) : 'CASH') : (isPos && payment_method ? String(payment_method) : undefined);

    // 🛡️ ANTI-DUPLICATE CHECK: Prevent identical rapid duplicate orders within 15s (runs ONLY when !isPos)
    if (!isPos && hasPhone) {
      const recentDuplicate = await sql`
        SELECT id, ticket_number, status, total_price, created_at, customer_name, phone, table_number
        FROM orders
        WHERE restaurant_id = ${restaurant.id}
          AND (
            phone = ${cleanedPhone}
            OR phone = ${'+91' + cleanPhone}
            OR phone = ${cleanPhone}
            OR RIGHT(REGEXP_REPLACE(COALESCE(phone, ''), '\D', '', 'g'), 10) = ${cleanPhone}
          )
          AND created_at > NOW() - INTERVAL '15 seconds'
        ORDER BY created_at DESC
        LIMIT 1
      ` as any[];

      if (recentDuplicate[0]) {
        console.log(`⚠️ Prevented duplicate order for ticket #${recentDuplicate[0].ticket_number}`);
        return NextResponse.json({
          success: true,
          data: recentDuplicate[0],
          message: 'Order already placed',
          duplicate_prevented: true,
        });
      }
    }

    const { getCurrentBusinessDate } = require('@/lib/format');
    const business_date = getCurrentBusinessDate(restaurant.timezone, restaurant.rollover_time);

    // 🛡️ ACTIVE ORDER ENFORCEMENT:
    // PENDING / PREPARING / READY -> ❌ Don't create a new order (Append it)
    // CLOSED / EXPIRED / CANCELLED -> ✅ Create a new order
    // No previous order -> ✅ Create a new order
    if (!isPos) {
      const previousOrderRes = await sql`
        SELECT id, ticket_number, status, table_number, created_at, business_date
        FROM orders
        WHERE restaurant_id = ${restaurant.id}
          AND (
            phone = ${phone}
            OR phone = ${'+91' + cleanPhone}
            OR phone = ${cleanPhone}
            OR RIGHT(REGEXP_REPLACE(COALESCE(phone, ''), '\D', '', 'g'), 10) = ${cleanPhone}
          )
        ORDER BY created_at DESC
        LIMIT 1
      ` as any[];

      const previousOrder = previousOrderRes[0];
      if (previousOrder) {
        const prevStatus = String(previousOrder.status || '').toUpperCase().trim();
        const orderDateStr = previousOrder.business_date
          ? String(previousOrder.business_date).split('T')[0]
          : new Intl.DateTimeFormat('en-CA', { timeZone: restaurant.timezone || 'Asia/Kolkata' }).format(new Date(previousOrder.created_at));
        const isToday = orderDateStr === business_date;

        const APPEND_STATUSES = ['PENDING', 'PREPARING', 'READY'];
        if (isToday && APPEND_STATUSES.includes(prevStatus)) {
          return NextResponse.json({
            success: false,
            error: `You already have an active order (#${String(previousOrder.ticket_number).padStart(3, '0')}). Please add items to your existing order.`,
            active_order: previousOrder,
            active_order_id: previousOrder.id,
            active_ticket_number: previousOrder.ticket_number,
          }, { status: 409 });
        }
      }
    }

    const isUuid = (str?: string) => Boolean(str && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str));
    const staffId = (isPos && admin?.isStaff && isUuid(admin?.userId)) ? admin.userId : undefined;

    const isTableOrder = Boolean(table_number && String(table_number).trim() !== '');
    // Orders from POS or table QR scans must always go directly to PREPARING state
    const determinedStatus = (isPos || isTableOrder || body.status === 'PREPARING') ? 'PREPARING' : (body.status || 'PENDING');

    const order = await createOrder({
      restaurant_id: restaurant.id,
      customer_name: customerName,
      phone: hasPhone ? cleanedPhone : null,
      total_price,
      subtotal,
      discount_amount,
      gst_amount,
      gst_rate,
      gst_type,
      notes,
      party_size: order_type === 'TAKEAWAY' ? 0 : (party_size || 1),
      table_number: order_type === 'TAKEAWAY' ? null : effectiveTableNumber,
      order_type: order_type || 'DINE_IN',
      is_pos: isPos,
      is_paid: isPaid,
      status: determinedStatus,
      payment_method: paymentMethod,
      payment_split: payment_split || null,
      staff_id: staffId,
      business_date,
      loyalty_reward_id: (body.selected_reward_id || body.loyalty_reward_id)?.toString().trim() || null,
      items,
    });

    // Persist the customer name back to the users table only for customer orders with phone
    if (hasPhone && !isPos) {
      try {
        await createUser(cleanedPhone, customerName);
      } catch {
        // Non-critical — don't fail the order if this upsert fails
      }
    }

    try {
      const sseData = {
        type: 'new_order',
        order_id: order.id,
        ticket_number: order.ticket_number,
        restaurant_id: restaurant.id,
        timestamp: new Date().toISOString()
      };
      console.log('🚀 About to trigger new_order event...');
      // Use a room specific to the restaurant
      await pusherServer.trigger(`queue-channel-${restaurant.id}`, 'new_order', sseData);
    } catch (pushErr) {
      console.error('Pusher trigger failed, but order was created:', pushErr);
    }

    // 🖨️ AUTO-PRINT KOT PER COUNTER: Run in after() so the waiter receives response immediately
    if (order && order.status === 'PREPARING') {
      after(async () => {
        try {
          await autoQueueAndBroadcastKot(restaurant.id, order.id);
        } catch (kotErr) {
          console.error('❌ Automatic KOT print error on order creation:', kotErr);
        }
      });
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