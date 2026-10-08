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
import { buildKotEscposBuffer, KotPrintData, sendRawPrintToWindowsPrinter, sendRawPrintToNetworkPrinter } from '@/lib/escpos';
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
      } catch {}
    }

    const restaurant = await getRestaurantById(restaurantId);
    const restaurantName = restaurant?.name || 'QDINE';

    // Group items by counter
    const counterMap: Record<string, any[]> = {};
    for (const item of allItems) {
      const c = (item.counter || 'Kitchen').trim();
      if (!counterMap[c]) counterMap[c] = [];
      counterMap[c].push(item);
    }

    // Look up all counter printer configurations
    const countersList = await getCounters(restaurantId);
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

    const isWindows = process.platform === 'win32';

    // Process each counter slip that has items
    for (const [cName, cItems] of Object.entries(counterMap)) {
      if (!cItems || cItems.length === 0) continue;

      const conf = counterPrinterMap[cName.trim().toLowerCase()] || {
        id: undefined,
        printerName: 'POS-80C',
        printerType: 'DEFAULT',
      };

      const kotData: KotPrintData = {
        restaurantName,
        ticketNumber: order.ticket_number,
        orderType: order.order_type,
        tableNumber: order.table_number,
        customerName: order.customer_name,
        phone: order.phone,
        staffName: order.staff_name,
        createdAt: new Date().toISOString(),
        counterName: cName,
        items: cItems,
        notes: order.notes,
        isAddOn: Boolean(options.isAddOn),
      };

      const buffer = buildKotEscposBuffer(kotData);
      const base64Bytes = buffer.toString('base64');
      let printedDirectly = false;

      // 1. Direct hardware print: Wi-Fi / LAN Network printer FIRST
      if (conf.printerAddress && (conf.printerType === 'NETWORK' || conf.printerAddress.includes('.'))) {
        try {
          const netRes = await sendRawPrintToNetworkPrinter(conf.printerAddress, buffer);
          if (netRes.success) {
            printedDirectly = true;
            console.log(`🖨️ [Wi-Fi/LAN] Auto-printed KOT #${order.ticket_number} [${cName}] -> ${conf.printerAddress}`);
          } else {
            console.warn(`⚠️ [Wi-Fi/LAN] Print failed for ${cName} on ${conf.printerAddress}: ${netRes.error}`);
          }
        } catch (netErr) {
          console.error('Network print error:', netErr);
        }
      }

      // 2. Direct hardware print on Windows (Local Spooler / USB) if not already printed via network
      if (!printedDirectly && isWindows) {
        try {
          const slipTitle = options.isAddOn
            ? `RUNNING KOT #${order.ticket_number} - ${cName} (ADD-ON)`
            : `KOT #${order.ticket_number} - ${cName}`;
          const winRes = await sendRawPrintToWindowsPrinter(
            conf.printerName,
            buffer,
            slipTitle
          );
          if (winRes.success) {
            printedDirectly = true;
            console.log(`🖨️ [Windows] Printed ${slipTitle} to "${conf.printerName}"`);
          } else {
            console.warn(`⚠️ [Windows] Print failed for ${cName} on "${conf.printerName}": ${winRes.error}`);
          }
        } catch (winErr) {
          console.error('Windows direct print error:', winErr);
        }
      }

      // 3. Queue into database print_jobs
      await createPrintJob(restaurantId, {
        order_id: order.id,
        ticket_number: Number(order.ticket_number) || undefined,
        counter_name: cName,
        printer_name: conf.printerName,
        raw_base64: base64Bytes,
      });

      // 4. Broadcast realtime Pusher event for Android Phones / Tablets / Browser
      try {
        await pusherServer.trigger(`queue-channel-${restaurantId}`, 'kot_auto_print', {
          order_id: order.id,
          ticket_number: order.ticket_number,
          counter_id: conf.id,
          counter_name: cName,
          printer_name: conf.printerName,
          printer_type: conf.printerType,
          printer_address: conf.printerAddress,
          server_printed: Boolean(printedDirectly),
          is_add_on: Boolean(options.isAddOn),
          kotData,
          base64Bytes,
          itemCount: cItems.length,
          timestamp: new Date().toISOString(),
        });
      } catch (pushErr) {
        console.error('Pusher kot_auto_print trigger error:', pushErr);
      }
    }

    const mode = options.isAddOn ? 'Add-on KOT' : 'KOT';
    console.log(`🖨️ Auto-queued ${mode} print slips for Order #${order.ticket_number} across ${Object.keys(counterMap).length} counter(s)`);
  } catch (err) {
    console.error('autoQueueAndBroadcastKot error:', err);
  }
}

