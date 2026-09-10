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

import { getOrderById, getRestaurantById, getCounters, createPrintJob } from '@/lib/db';
import { buildKotEscposBuffer, KotPrintData } from '@/lib/escpos';
import { pusherServer } from '@/lib/pusher';

export async function autoQueueAndBroadcastKot(restaurantId: string, orderId: string) {
  try {
    const order = await getOrderById(restaurantId, orderId);
    if (!order) return;

    const allItems = (order.items || []).filter((i: any) => (i.quantity || 0) > 0);
    if (allItems.length === 0) return;

    const restaurant = await getRestaurantById(restaurantId);
    const restaurantName = restaurant?.name || 'QDINE';

    // Group items by counter
    const counterMap: Record<string, any[]> = {};
    for (const item of allItems) {
      const c = (item.counter || 'Unassigned').trim();
      if (!counterMap[c]) counterMap[c] = [];
      counterMap[c].push(item);
    }

    // Look up all counter printer configurations
    const countersList = await getCounters(restaurantId);
    const counterPrinterMap: Record<string, { printerName: string; printerType: string; printerAddress?: string }> = {};
    for (const c of countersList) {
      if (c.name) {
        counterPrinterMap[c.name.trim().toLowerCase()] = {
          printerName: (c.printer_name || 'POS-80C').trim(),
          printerType: c.printer_type || 'DEFAULT',
          printerAddress: c.printer_address || undefined,
        };
      }
    }

    // Process each counter slip
    for (const [cName, cItems] of Object.entries(counterMap)) {
      const conf = counterPrinterMap[cName.trim().toLowerCase()] || {
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
        createdAt: order.created_at || new Date().toISOString(),
        counterName: cName,
        items: cItems,
        notes: order.notes,
      };

      const buffer = buildKotEscposBuffer(kotData);
      const base64Bytes = buffer.toString('base64');

      // 1. Queue into database print_jobs (for Windows PC / Cloud Print Agent)
      await createPrintJob(restaurantId, {
        order_id: order.id,
        ticket_number: Number(order.ticket_number) || undefined,
        counter_name: cName,
        printer_name: conf.printerName,
        raw_base64: base64Bytes,
      });

      // 2. Broadcast realtime Pusher event for Android Phones / Tablets
      try {
        await pusherServer.trigger(`queue-channel-${restaurantId}`, 'kot_auto_print', {
          order_id: order.id,
          ticket_number: order.ticket_number,
          counter_name: cName,
          printer_name: conf.printerName,
          printer_type: conf.printerType,
          printer_address: conf.printerAddress,
          kotData,
          base64Bytes,
          itemCount: cItems.length,
          timestamp: new Date().toISOString(),
        });
      } catch (pushErr) {
        console.error('Pusher kot_auto_print trigger error:', pushErr);
      }
    }

    console.log(`🖨️ Auto-queued KOT print slips for Order #${order.ticket_number} across ${Object.keys(counterMap).length} counter(s)`);
  } catch (err) {
    console.error('autoQueueAndBroadcastKot error:', err);
  }
}

