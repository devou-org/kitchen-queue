import { NextRequest, NextResponse } from 'next/server';
import sql, {
  getRestaurantBySlug,
  getOrderById,
  createPrintJob,
  getAgentHeartbeat,
} from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import {
  buildBillEscposBuffer,
  BillPrintData,
} from '@/lib/escpos';
import { generateBillTemplateHTML } from '@/lib/bill-template-html';
import { pusherServer } from '@/lib/pusher';

async function resolveRestaurant(request: NextRequest, bodySlug?: string) {
  const admin = await requireAdmin(request);
  if (admin?.restaurantId) {
    const rows = await sql`SELECT * FROM restaurants WHERE id = ${admin.restaurantId} LIMIT 1`;
    if (rows && rows[0]) return rows[0];
  }

  const headerSlug = request.headers.get('x-restaurant-slug');
  const { searchParams } = new URL(request.url);
  const querySlug = searchParams.get('slug');
  const slug = bodySlug?.trim() || querySlug?.trim() || headerSlug?.trim() || admin?.restaurantSlug;

  if (slug) {
    return await getRestaurantBySlug(slug);
  }
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { orderId, printerName, printerType, orderData, slug, isStation, isTest } = body;
    const isTestPrint = Boolean(
      isTest ||
      orderData?.ticket_number === 999 ||
      orderData?.ticket_number === '999' ||
      String(orderId || '').startsWith('test-') ||
      String(orderData?.id || '').startsWith('test-') ||
      String(orderData?.customer_name || '').toLowerCase().includes('verification')
    );

    const restaurant = await resolveRestaurant(request, slug);
    if (!restaurant) {
      return NextResponse.json(
        { success: false, error: 'Restaurant not found or unauthorized' },
        { status: 401 }
      );
    }

    let order = orderData;
    if (!order && orderId) {
      order = await getOrderById(restaurant.id, orderId);
    }

    if (!order) {
      return NextResponse.json(
        { success: false, error: 'Order not found' },
        { status: 404 }
      );
    }

    const allItems = (order.items || []).filter((i: any) => (i.quantity || 0) > 0);
    if (allItems.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No items in this order to print bill' },
        { status: 400 }
      );
    }

    const targetPrinter = printerName?.trim() || restaurant.bill_printer_name?.trim() || process.env.BILL_PRINTER_NAME || process.env.KOT_PRINTER_NAME || 'POS-80C';
    const effPrinterType = (printerType || restaurant.bill_printer_type || 'DEFAULT').toUpperCase();
    const isClientDirectHardware = effPrinterType === 'BLUETOOTH' || effPrinterType === 'USB';

    const restaurantInfo = {
      name: restaurant.name || (order as any).restaurant_name || 'Restaurant',
      logo_url: restaurant.logo_url || undefined,
      address: restaurant.address || undefined,
      phone: restaurant.phone || undefined,
      gst_number: restaurant.gst_number || undefined,
      primary_color: restaurant.primary_color || '#059669',
      timezone: restaurant.timezone || 'Asia/Kolkata',
    };

    const billData: BillPrintData = {
      restaurantName: restaurantInfo.name,
      timezone: restaurant.timezone || 'Asia/Kolkata',
      address: restaurantInfo.address,
      phone: restaurantInfo.phone,
      gstNumber: restaurantInfo.gst_number,
      ticketNumber: order.ticket_number,
      orderType: order.order_type,
      tableNumber: order.table_number,
      customerName: order.customer_name || 'Walk-in',
      customerPhone: order.phone || undefined,
      staffName: order.staff_name,
      createdAt: order.created_at,
      items: allItems,
      subtotal: order.subtotal,
      gstType: (order as any).gst_type,
      gstRate: (order as any).gst_rate,
      gstAmount: (order as any).gst_amount,
      totalPrice: order.total_price,
      paymentMethod: order.payment_method,
      isPaid: order.is_paid,
      notes: order.notes,
    };

    // Build raw ESC/POS binary buffer
    const buffer = buildBillEscposBuffer(billData);
    const base64Bytes = buffer.toString('base64');

    // Also generate HTML representation for client preview/dialog
    const billHtml = generateBillTemplateHTML(order, restaurantInfo);

    // 1. If caller IS the Print Station itself, or this is a test print, return bytes directly for local print
    if (isStation || isTestPrint) {
      return NextResponse.json({
        success: true,
        mode: 'client',
        message: `Bill #${String(order.ticket_number).padStart(3, '0')} ready for local print!`,
        printer: targetPrinter,
        printerType: effPrinterType,
        base64Bytes,
        billData,
        billHtml,
      });
    }

    // 3. Remote caller (e.g. Waiter Phone): Queue for Cloud Print Agent on Cashier PC
    await createPrintJob(restaurant.id, {
      order_id: order.id,
      ticket_number: Number(order.ticket_number) || undefined,
      counter_name: 'BILL',
      printer_name: targetPrinter,
      raw_base64: base64Bytes,
    });

    // 4. Remote caller: Broadcast Bill to designated Print Station via realtime socket
    try {
      await pusherServer.trigger(`queue-channel-${restaurant.id}`, 'bill_print', {
        order_id: order.id,
        ticket_number: order.ticket_number,
        printer_name: targetPrinter,
        printer_type: effPrinterType,
        printer_address: (printerType === 'NETWORK' ? (printerName || (restaurant as any).bill_printer_address) : undefined),
        base64Bytes,
        billData,
        billHtml,
        is_manual: true,
        timestamp: new Date().toISOString(),
      });
    } catch (pushErr) {
      console.error('Pusher manual bill_print error:', pushErr);
    }

    const agentHeartbeat = await getAgentHeartbeat(restaurant.id);
    const isAgentOnline = Boolean(agentHeartbeat?.is_online);

    if (isAgentOnline) {
      return NextResponse.json({
        success: true,
        mode: 'agent',
        broadcasted: true,
        message: `Bill #${String(order.ticket_number).padStart(3, '0')} sent to Cashier ${targetPrinter}!`,
        printer: targetPrinter,
        base64Bytes,
        billHtml,
      });
    }

    // 5. Return to remote caller (waiter phone) with broadcasted flag
    return NextResponse.json({
      success: true,
      mode: 'station',
      broadcasted: true,
      message: `Bill #${String(order.ticket_number).padStart(3, '0')} sent to Print Station!`,
      printer: targetPrinter,
      base64Bytes,
      billData,
      billHtml,
    });
  } catch (error: any) {
    console.error('Bill print API error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to print bill' },
      { status: 500 }
    );
  }
}
