import { NextRequest, NextResponse } from 'next/server';
import { getRestaurantBySlug, getOrderById, sql } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { buildKotEscposBuffer, sendRawPrintToWindowsPrinter } from '@/lib/escpos';

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
    const { orderId, counterName, printerName, orderData, separateSlips, slug } = body;

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
        { success: false, error: 'No items in this order to print' },
        { status: 400 }
      );
    }

    const targetPrinter = printerName?.trim() || process.env.KOT_PRINTER_NAME || 'POS-80C';
    const restaurantName = restaurant.name || 'QDINE';

    // Group items or filter by counter
    const isAllCounters = !counterName || counterName.toUpperCase() === 'ALL' || counterName === '*';

    if (!isAllCounters) {
      // Filter items for specific counter
      const isUnassigned = counterName.toLowerCase() === 'unassigned';
      const filteredItems = allItems.filter((item: any) => {
        const c = (item.counter || '').trim();
        if (isUnassigned) {
          return !c || c.toLowerCase() === 'unassigned';
        }
        return c.toLowerCase() === counterName.trim().toLowerCase();
      });

      if (filteredItems.length === 0) {
        return NextResponse.json(
          { success: false, error: `No items in order #${order.ticket_number} for counter "${counterName}"` },
          { status: 400 }
        );
      }

      const buffer = buildKotEscposBuffer({
        restaurantName,
        ticketNumber: order.ticket_number,
        orderType: order.order_type,
        tableNumber: order.table_number,
        customerName: order.customer_name,
        phone: order.phone,
        staffName: order.staff_name,
        createdAt: order.created_at,
        counterName: counterName,
        items: filteredItems,
        notes: order.notes,
      });

      const printResult = await sendRawPrintToWindowsPrinter(
        targetPrinter,
        buffer,
        `KOT #${order.ticket_number} - ${counterName}`
      );

      if (!printResult.success) {
        return NextResponse.json(
          {
            success: false,
            error: printResult.error || `Failed to print to ${targetPrinter}`,
            printer: targetPrinter,
          },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: `KOT printed for ${counterName}`,
        printer: targetPrinter,
        itemCount: filteredItems.length,
      });
    }

    // Printing ALL counters
    if (separateSlips) {
      // Group items by counter and print a separate slip for each counter
      const counterMap: Record<string, any[]> = {};
      for (const item of allItems) {
        const c = (item.counter || 'Unassigned').trim();
        if (!counterMap[c]) counterMap[c] = [];
        counterMap[c].push(item);
      }

      const printedCounters: string[] = [];
      const errors: string[] = [];

      for (const [cName, cItems] of Object.entries(counterMap)) {
        const buffer = buildKotEscposBuffer({
          restaurantName,
          ticketNumber: order.ticket_number,
          orderType: order.order_type,
          tableNumber: order.table_number,
          customerName: order.customer_name,
          phone: order.phone,
          staffName: order.staff_name,
          createdAt: order.created_at,
          counterName: cName,
          items: cItems,
          notes: order.notes,
        });

        const printResult = await sendRawPrintToWindowsPrinter(
          targetPrinter,
          buffer,
          `KOT #${order.ticket_number} - ${cName}`
        );

        if (printResult.success) {
          printedCounters.push(cName);
        } else {
          errors.push(`${cName}: ${printResult.error}`);
        }
      }

      if (printedCounters.length === 0 && errors.length > 0) {
        return NextResponse.json(
          { success: false, error: errors.join(', '), printer: targetPrinter },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: `KOT printed for ${printedCounters.length} counter(s): ${printedCounters.join(', ')}`,
        printer: targetPrinter,
        partialErrors: errors.length > 0 ? errors : undefined,
      });
    }

    // Default: Single unified Master KOT with all items
    const buffer = buildKotEscposBuffer({
      restaurantName,
      ticketNumber: order.ticket_number,
      orderType: order.order_type,
      tableNumber: order.table_number,
      customerName: order.customer_name,
      phone: order.phone,
      staffName: order.staff_name,
      createdAt: order.created_at,
      counterName: 'ALL ITEMS',
      items: allItems,
      notes: order.notes,
    });

    const printResult = await sendRawPrintToWindowsPrinter(
      targetPrinter,
      buffer,
      `KOT #${order.ticket_number} - ALL`
    );

    if (!printResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: printResult.error || `Failed to print to ${targetPrinter}`,
          printer: targetPrinter,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Master KOT printed for all items`,
      printer: targetPrinter,
      itemCount: allItems.length,
    });
  } catch (error: any) {
    console.error('KOT print error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal print error' },
      { status: 500 }
    );
  }
}

