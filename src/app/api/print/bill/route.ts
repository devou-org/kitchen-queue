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
  sendRawPrintToWindowsPrinter,
  BillPrintData,
} from '@/lib/escpos';
import { generateBillTemplateHTML } from '@/lib/bill-template-html';

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
    const { orderId, printerName, orderData, slug } = body;

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

    const targetPrinter = printerName?.trim() || process.env.KOT_PRINTER_NAME || 'POS-80C';
    const isWindows = process.platform === 'win32';

    const restaurantInfo = {
      name: restaurant.name || (order as any).restaurant_name || 'Restaurant',
      logo_url: restaurant.logo_url || undefined,
      address: restaurant.address || undefined,
      phone: restaurant.phone || undefined,
      gst_number: restaurant.gst_number || undefined,
      primary_color: restaurant.primary_color || '#059669',
    };

    const billData: BillPrintData = {
      restaurantName: restaurantInfo.name,
      address: restaurantInfo.address,
      phone: restaurantInfo.phone,
      gstNumber: restaurantInfo.gst_number,
      ticketNumber: order.ticket_number,
      orderType: order.order_type,
      tableNumber: order.table_number,
      customerName: order.customer_name,
      customerPhone: order.phone,
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

    // 1. Direct hardware print on Windows (Local dev / Cashier PC) — exactly like KOT!
    if (isWindows) {
      const printResult = await sendRawPrintToWindowsPrinter(
        targetPrinter,
        buffer,
        `Bill #${order.ticket_number}`
      );

      if (printResult.success) {
        return NextResponse.json({
          success: true,
          mode: 'server',
          message: `Bill #${String(order.ticket_number).padStart(3, '0')} printed to ${targetPrinter}!`,
          printer: targetPrinter,
          base64Bytes,
          billHtml,
        });
      }
      console.warn(`[Windows] Direct raw bill print to "${targetPrinter}" failed:`, printResult.error);
    }

    // 2. Queue for Cloud Print Agent on Cashier PC
    await createPrintJob(restaurant.id, {
      order_id: order.id,
      ticket_number: Number(order.ticket_number) || undefined,
      counter_name: 'BILL',
      printer_name: targetPrinter,
      raw_base64: base64Bytes,
    });

    const agentHeartbeat = await getAgentHeartbeat(restaurant.id);
    const isAgentOnline = Boolean(agentHeartbeat?.is_online);

    if (isAgentOnline) {
      return NextResponse.json({
        success: true,
        mode: 'agent',
        message: `Bill #${String(order.ticket_number).padStart(3, '0')} sent to Cashier ${targetPrinter}!`,
        printer: targetPrinter,
        base64Bytes,
        billHtml,
      });
    }

    // 3. Fallback to client browser / local bridge
    return NextResponse.json({
      success: true,
      mode: 'client',
      message: `Bill ready for ${targetPrinter}`,
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
