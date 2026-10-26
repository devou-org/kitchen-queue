import { NextRequest, NextResponse } from 'next/server';
import sql, {
  getRestaurantBySlug,
  getOrderById,
  createPrintJob,
  getAgentHeartbeat,
  getCounterByName,
  getCounters,
} from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { buildKotEscposBuffer, KotPrintData } from '@/lib/escpos';
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
    const { orderId, counterName, printerName, orderData, separateSlips, slug, isStation, isTest } = body;
    const isTestPrint = Boolean(
      isTest ||
      orderData?.ticket_number === 999 ||
      orderData?.ticket_number === '999' ||
      String(orderId || '').startsWith('test-') ||
      String(orderData?.id || '').startsWith('test-') ||
      String(orderData?.customer_name || '').toLowerCase().includes('test')
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
        { success: false, error: 'No items in this order to print' },
        { status: 400 }
      );
    }

    const targetPrinter = printerName?.trim() || process.env.KOT_PRINTER_NAME || 'POS-80C';
    const restaurantName = restaurant.name || 'QDINE';
    const timezone = restaurant.timezone || 'Asia/Kolkata';

    // Check if cloud print agent is active on the cashier PC
    const agentHeartbeat = await getAgentHeartbeat(restaurant.id);
    const isAgentOnline = Boolean(agentHeartbeat?.is_online);

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

      // Check if counter has dedicated configuration in database
      let counterRecord: any = null;
      let counterTargetPrinter = '';
      let counterPrinterType = 'DEFAULT';
      try {
        counterRecord = await getCounterByName(restaurant.id, counterName);
        if (counterRecord?.printer_name && counterRecord.printer_name.trim()) {
          counterTargetPrinter = counterRecord.printer_name.trim();
          counterPrinterType = counterRecord.printer_type || 'DEFAULT';
        }
      } catch { }
      if (!counterTargetPrinter) {
        counterTargetPrinter = (printerName && printerName.trim() !== 'POS-80C') ? printerName.trim() : targetPrinter;
      }

      const kotData: KotPrintData = {
        restaurantName,
        timezone,
        ticketNumber: order.ticket_number,
        orderType: order.order_type,
        tableNumber: order.table_number,
        customerName: order.customer_name || 'Walk-in',
        phone: order.phone || undefined,
        staffName: order.staff_name,
        createdAt: order.created_at,
        counterName: counterName,
        items: filteredItems,
        notes: order.notes,
      };

      const buffer = buildKotEscposBuffer(kotData);
      const base64Bytes = buffer.toString('base64');

      // For station or test prints, return compiled buffer directly to caller without queuing or Pusher broadcast
      if (isStation || isTestPrint) {
        return NextResponse.json({
          success: true,
          mode: 'client',
          message: `KOT buffer ready for ${counterName}`,
          printer: counterTargetPrinter,
          printerType: counterPrinterType,
          printerAddress: counterRecord?.printer_address,
          counterId: counterRecord?.id,
          counterName,
          itemCount: filteredItems.length,
          kotData,
          base64Bytes,
        });
      }

      // 2. Queue for Cloud Print Agent
      await createPrintJob(restaurant.id, {
        order_id: order.id,
        ticket_number: Number(order.ticket_number) || undefined,
        counter_name: counterName,
        printer_name: counterTargetPrinter,
        raw_base64: base64Bytes,
      });

      // 3. Broadcast to designated Print Station via realtime socket
      try {
        await pusherServer.trigger(`queue-channel-${restaurant.id}`, 'kot_auto_print', {
          order_id: order.id,
          ticket_number: order.ticket_number,
          counter_id: counterRecord?.id,
          counter_name: counterName,
          printer_name: counterTargetPrinter,
          printer_type: counterPrinterType,
          printer_address: counterRecord?.printer_address,
          kotData,
          base64Bytes,
          is_manual: true,
          timestamp: new Date().toISOString(),
        });
      } catch (pushErr) {
        console.error('Pusher manual kot_auto_print error:', pushErr);
      }

      // If print agent is online on cashier PC, it will print in < 1 second!
      if (isAgentOnline) {
        return NextResponse.json({
          success: true,
          mode: 'agent',
          broadcasted: true,
          message: `KOT sent to ${counterTargetPrinter} for ${counterName}!`,
          printer: counterTargetPrinter,
          itemCount: filteredItems.length,
          kotData,
          base64Bytes,
        });
      }

      // 4. Return to caller with broadcasted flag
      return NextResponse.json({
        success: true,
        mode: 'station',
        broadcasted: true,
        message: `KOT sent to Print Station for ${counterName}!`,
        printer: counterTargetPrinter,
        kotData,
        base64Bytes,
        itemCount: filteredItems.length,
      });
    }

    // Printing ALL counters
    if (separateSlips) {
      const counterMap: Record<string, any[]> = {};
      for (const item of allItems) {
        const c = (item.counter || 'Unassigned').trim();
        if (!counterMap[c]) counterMap[c] = [];
        counterMap[c].push(item);
      }

      const slips: Array<{
        kotData: KotPrintData;
        base64Bytes: string;
        printerName: string;
        counterId?: string;
        printerAddress?: string;
        printerType?: string;
      }> = [];

      // Look up all counter printer configurations
      const counterPrinterMap: Record<
        string,
        { id?: string; printerName: string; printerAddress?: string; printerType?: string }
      > = {};
      try {
        const countersList = await getCounters(restaurant.id);
        for (const c of countersList) {
          if (c.name) {
            const isNetwork = (c.printer_type || '').toUpperCase() === 'NETWORK';
            counterPrinterMap[c.name.trim().toLowerCase()] = {
              id: c.id,
              printerName: (c.printer_name || targetPrinter).trim(),
              printerAddress: isNetwork ? (c.printer_address?.trim() || undefined) : undefined,
              printerType: c.printer_type || 'DEFAULT',
            };
          }
        }
      } catch { }

      for (const [cName, cItems] of Object.entries(counterMap)) {
        const conf = counterPrinterMap[cName.trim().toLowerCase()] || {
          id: undefined,
          printerName: targetPrinter,
          printerAddress: undefined,
          printerType: 'DEFAULT',
        };
        const slipPrinter = conf.printerName;

        const kotData: KotPrintData = {
          restaurantName,
          timezone,
          ticketNumber: order.ticket_number,
          orderType: order.order_type,
          tableNumber: order.table_number,
          customerName: order.customer_name || 'Walk-in',
          phone: order.phone || undefined,
          staffName: order.staff_name,
          createdAt: order.created_at,
          counterName: cName,
          items: cItems,
          notes: order.notes,
        };

        const buffer = buildKotEscposBuffer(kotData);
        const base64Bytes = buffer.toString('base64');
        slips.push({
          kotData,
          base64Bytes,
          printerName: slipPrinter,
          counterId: conf.id,
          printerAddress: conf.printerAddress,
          printerType: conf.printerType,
        });

        if (!isTestPrint) {
          // Queue each slip to its dedicated counter printer
          await createPrintJob(restaurant.id, {
            order_id: order.id,
            ticket_number: Number(order.ticket_number) || undefined,
            counter_name: cName,
            printer_name: slipPrinter,
            raw_base64: base64Bytes,
          });
        }
      }

      // For station or test prints, return compiled slips directly to caller without Pusher broadcast
      if (isStation || isTestPrint) {
        return NextResponse.json({
          success: true,
          mode: 'client',
          message: `${slips.length} KOT slips ready for print`,
          slips,
        });
      }

      // Broadcast all counter slips to Print Station
      for (const slip of slips) {
        try {
          await pusherServer.trigger(`queue-channel-${restaurant.id}`, 'kot_auto_print', {
            order_id: order.id,
            ticket_number: order.ticket_number,
            counter_id: slip.counterId,
            counter_name: slip.kotData.counterName,
            printer_name: slip.printerName,
            printer_address: slip.printerAddress,
            printer_type: slip.printerType,
            kotData: slip.kotData,
            base64Bytes: slip.base64Bytes,
            is_manual: true,
            timestamp: new Date().toISOString(),
          });
        } catch (pushErr) {
          console.error('Pusher manual separate slips error:', pushErr);
        }
      }

      if (isAgentOnline) {
        return NextResponse.json({
          success: true,
          mode: 'agent',
          broadcasted: true,
          message: `${slips.length} KOT slips sent to Cashier ${targetPrinter}!`,
          printer: targetPrinter,
        });
      }

      return NextResponse.json({
        success: true,
        mode: 'station',
        broadcasted: true,
        message: `${slips.length} KOT slips sent to Print Station!`,
        printer: targetPrinter,
        slips,
      });
    }

    // Default: Single unified Master KOT with all items
    let masterPrinterAddress: string | undefined = undefined;
    let masterPrinterType: string = 'DEFAULT';
    let masterPrinterName: string = targetPrinter;

    if (restaurant.bill_printer_name && restaurant.bill_printer_name.trim()) {
      masterPrinterName = restaurant.bill_printer_name.trim();
    }
    if (restaurant.bill_printer_type) {
      masterPrinterType = restaurant.bill_printer_type.toUpperCase();
    }
    // Only attach masterPrinterAddress if the master printer is explicitly in NETWORK mode!
    if (masterPrinterType === 'NETWORK' && restaurant.bill_printer_address && restaurant.bill_printer_address.trim()) {
      masterPrinterAddress = restaurant.bill_printer_address.trim();
    }

    const kotData: KotPrintData = {
      restaurantName,
      timezone,
      ticketNumber: order.ticket_number,
      orderType: order.order_type,
      tableNumber: order.table_number,
      customerName: order.customer_name || 'Walk-in',
      phone: order.phone || undefined,
      staffName: order.staff_name,
      createdAt: order.created_at,
      counterName: 'ALL ITEMS',
      items: allItems,
      notes: order.notes,
    };

    const buffer = buildKotEscposBuffer(kotData);
    const base64Bytes = buffer.toString('base64');

    if (!isTestPrint) {
      // ALWAYS queue Master KOT into print_jobs table so it appears in Print Job Queue!
      await createPrintJob(restaurant.id, {
        order_id: order.id,
        ticket_number: Number(order.ticket_number) || undefined,
        counter_name: 'ALL',
        printer_name: masterPrinterName,
        raw_base64: base64Bytes,
      });
    }

    // For station or test prints, return buffer directly for client printing without Pusher broadcast
    if (isStation || isTestPrint) {
      return NextResponse.json({
        success: true,
        mode: 'client',
        message: `Master KOT buffer ready`,
        printer: masterPrinterName,
        printerAddress: masterPrinterAddress,
        printerType: masterPrinterType,
        itemCount: allItems.length,
        kotData,
        base64Bytes,
      });
    }

    // Broadcast Master KOT to Print Station
    try {
      await pusherServer.trigger(`queue-channel-${restaurant.id}`, 'kot_auto_print', {
        order_id: order.id,
        ticket_number: order.ticket_number,
        counter_name: 'ALL',
        printer_name: masterPrinterName,
        printer_address: masterPrinterAddress,
        printer_type: masterPrinterType,
        kotData,
        base64Bytes,
        is_manual: true,
        timestamp: new Date().toISOString(),
      });
    } catch (pushErr) {
      console.error('Pusher manual master KOT error:', pushErr);
    }

    if (isAgentOnline) {
      return NextResponse.json({
        success: true,
        mode: 'agent',
        broadcasted: true,
        message: `Master KOT sent to Cashier ${targetPrinter}!`,
        printer: targetPrinter,
        itemCount: allItems.length,
        kotData,
        base64Bytes,
      });
    }

    return NextResponse.json({
      success: true,
      mode: 'station',
      broadcasted: true,
      message: `Master KOT sent to Print Station!`,
      printer: targetPrinter,
      kotData,
      base64Bytes,
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
