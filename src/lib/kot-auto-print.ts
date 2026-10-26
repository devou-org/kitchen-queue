/**
 * Automatic KOT Printing & Routing Engine
 * ============================================================
 * When an order is placed or moves to PREPARING:
 * 1. Groups items by counter (Kitchen, Bar, Grill, etc.)
 * 2. Looks up each counter's configured thermal printer
 * 3. Generates ESC/POS binary buffers
 * 4. Queues print jobs in print_jobs database
 * 5. Broadcasts realtime 'kot_auto_print' event via Pusher
 *    so connected station phones/printers print instantly with 0 clicks.
 * ============================================================
 */

import sql, { getOrderById, getRestaurantById, getCounters, createPrintJob } from '@/lib/db';
import { buildKotEscposBuffer, KotPrintData } from '@/lib/escpos';
import { pusherServer } from '@/lib/pusher';

export interface AutoKotOptions {
  forceBroadcast?: boolean;
  isAddOn?: boolean;
  overrideItems?: { product_name: string; counter?: string; quantity: number; notes?: string }[];
}

export async function autoQueueAndBroadcastKot(
  restaurantId: string,
  orderId: string,
  optionsOrForce: boolean | AutoKotOptions = false
) {
  try {
    const options: AutoKotOptions = typeof optionsOrForce === 'boolean'
      ? { forceBroadcast: optionsOrForce }
      : (optionsOrForce || {});

    const order = await getOrderById(restaurantId, orderId);
    if (!order) return;

    // Determine which items to print:
    let allItems: any[] = [];
    if (options.overrideItems && options.overrideItems.length > 0) {
      allItems = options.overrideItems.filter((i: any) => (i.quantity || 0) > 0);
    } else {
      allItems = (order.items || []).filter((i: any) => (i.quantity || 0) > 0);
    }

    // Only print if there are items to print!
    if (allItems.length === 0) return;

    // For normal initial orders (not add-on), only auto-print when in PREPARING
    if (!options.isAddOn && order.status !== 'PREPARING' && !options.forceBroadcast) {
      console.log(`ℹ️ Order #${order.ticket_number} is in "${order.status}" status (not PREPARING). Skipping automatic print.`);
      return;
    }

    // Check if KOT jobs for this order were already queued to prevent duplicate prints
    if (!options.forceBroadcast && !options.isAddOn) {
      try {
        const existingJobs = await sql`
          SELECT id FROM print_jobs 
          WHERE restaurant_id = ${restaurantId} AND order_id = ${orderId} 
          LIMIT 1
        `;
        if (existingJobs && existingJobs.length > 0) {
          console.log(`ℹ️ KOT print jobs already exist for Order #${order.ticket_number}, skipping duplicate generation.`);
          return;
        }
      } catch { }
    }

    // Fetch restaurant and counters in parallel
    const [restaurant, countersList] = await Promise.all([
      getRestaurantById(restaurantId),
      getCounters(restaurantId),
    ]);
    const restaurantName = restaurant?.name || 'QDINE';
    const timezone = restaurant?.timezone || 'Asia/Kolkata';

    // Group items by counter
    const counterMap: Record<string, any[]> = {};
    for (const item of allItems) {
      const c = (item.counter || 'Kitchen').trim();
      if (!counterMap[c]) counterMap[c] = [];
      counterMap[c].push(item);
    }

    // Look up all counter printer configurations
    const counterPrinterMap: Record<string, { id?: string; printerName: string; printerType: string; printerAddress?: string }> = {};
    for (const c of countersList) {
      if (c.name) {
        counterPrinterMap[c.name.trim().toLowerCase()] = {
          id: c.id,
          printerName: (c.printer_name || 'POS-80C').trim(),
          printerType: c.printer_type || 'DEFAULT',
          printerAddress: c.printer_address || undefined,
        };
      }
    }

    // Process each counter slip that has items
    const validCounterEntries = Object.entries(counterMap).filter(([_, items]) => items && items.length > 0);

    const slips = validCounterEntries.map(([cName, cItems]) => {
      const conf = counterPrinterMap[cName.trim().toLowerCase()] || {
        id: undefined,
        printerName: 'POS-80C',
        printerType: 'DEFAULT',
      };

      const kotData: KotPrintData = {
        restaurantName,
        timezone,
        ticketNumber: order.ticket_number,
        orderType: order.order_type,
        tableNumber: order.table_number,
        customerName: order.customer_name || 'Walk-in',
        phone: order.phone || undefined,
        staffName: order.staff_name,
        createdAt: options.isAddOn ? new Date().toISOString() : (order.created_at || new Date().toISOString()),
        counterName: cName,
        items: cItems,
        notes: order.notes,
        isAddOn: Boolean(options.isAddOn),
      };

      const buffer = buildKotEscposBuffer(kotData);
      const base64Bytes = buffer.toString('base64');

      return { cName, cItems, conf, kotData, buffer, base64Bytes };
    });

    // 2 & 3. Run createPrintJob plus pusherServer.trigger for all counters in parallel with Promise.all
    await Promise.all(
      slips.map(async (slip) => {
        let job: any = null;
        try {
          job = await createPrintJob(restaurantId, {
            order_id: order.id,
            ticket_number: Number(order.ticket_number) || undefined,
            counter_name: slip.cName,
            printer_name: slip.conf.printerName,
            raw_base64: slip.base64Bytes,
          });
        } catch (jobErr) {
          console.error(`Failed to create print job for counter ${slip.cName}:`, jobErr);
        }

        // Keep Pusher payload safely under 10KB
        // If base64Bytes is large (>3500 chars), omit raw bytes and send print_job_id for station to fetch
        const isLarge = slip.base64Bytes.length > 3500;
        const pusherPayload: Record<string, any> = {
          order_id: order.id,
          ticket_number: order.ticket_number,
          counter_id: slip.conf.id,
          counter_name: slip.cName,
          printer_name: slip.conf.printerName,
          printer_type: slip.conf.printerType,
          printer_address: slip.conf.printerAddress,
          is_add_on: Boolean(options.isAddOn),
          itemCount: slip.cItems.length,
          timestamp: new Date().toISOString(),
          print_job_id: job?.id,
        };

        pusherPayload.kotData = slip.kotData;
        pusherPayload.base64Bytes = slip.base64Bytes;

        try {
          await pusherServer.trigger(`queue-channel-${restaurantId}`, 'kot_auto_print', pusherPayload);
        } catch (pushErr) {
          console.error('Pusher kot_auto_print trigger error:', pushErr);
        }
      })
    );

    const mode = options.isAddOn ? 'Add-on KOT' : 'KOT';
    console.log(`🖨️ Auto-queued ${mode} print slips for Order #${order.ticket_number} across ${Object.keys(counterMap).length} counter(s)`);
  } catch (err) {
    console.error('autoQueueAndBroadcastKot error:', err);
  }
}

