import { NextRequest, NextResponse } from 'next/server';
import { getOrders, getOrderStats, createOrder, createUser, getRestaurantBySlug } from '@/lib/db';
import { verifyToken, requireAdmin } from '@/lib/auth';
import { pusherServer } from '@/lib/pusher';

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
    const { customer_name, phone, items, notes, party_size, table_number, order_type } = body;

    if (!customer_name || !phone || !items || !items.length) {
      return NextResponse.json({
        success: false,
        error: 'Customer name, phone, and items are required'
      }, { status: 400 });
    }

    if (order_type !== 'TAKEAWAY' && table_number) {
      const { TablesRepository } = await import('@/modules/tables/tables.repository');
      const { checkTableAssignment } = await import('@/lib/table-capacity');
      const tables = await TablesRepository.getTablesByRestaurant(restaurant.id);
      const targetTable = tables.find(t => String(t.table_number).trim().toLowerCase() === String(table_number).trim().toLowerCase());
      if (targetTable) {
        const check = checkTableAssignment(targetTable, party_size || 1, {
          phone,
          customerName: customer_name
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

    const gst_type = restaurant.gst_type || 'NONE';
    const gst_rate = Number(restaurant.gst_rate) || 0;
    let gst_amount = 0;
    let total_price = subtotal;

    if (gst_type === 'REGULAR') {
      gst_amount = Math.round((subtotal * gst_rate / 100) * 100) / 100;
      total_price = subtotal + gst_amount;
    }

    const admin = await requireAdmin(request);
    const hasAdminRights = !!admin && (admin.isStaff || admin.isAdmin);
    // Only trust is_pos if the user is verified staff/admin. Prevents token leakage into customer UI.
    const isPos = hasAdminRights && body.is_pos === true;

    const { getCurrentBusinessDate } = require('@/lib/format');
    const business_date = getCurrentBusinessDate(restaurant.timezone, restaurant.rollover_time);

    const order = await createOrder({
      restaurant_id: restaurant.id,
      customer_name: customer_name.trim(),
      phone,
      total_price,
      subtotal,
      gst_amount,
      gst_rate,
      gst_type,
      notes,
      party_size: order_type === 'TAKEAWAY' ? 0 : (party_size || 1),
      table_number: order_type === 'TAKEAWAY' ? null : table_number,
      order_type: order_type || 'DINE_IN',
      is_pos: isPos,
      staff_id: isPos ? admin?.userId : undefined,
      business_date,
      items,
    });

    // Persist the customer name back to the users table so checkout can auto-fill it next time
    try {
      await createUser(phone, customer_name.trim());
    } catch {
      // Non-critical — don't fail the order if this upsert fails
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
