import { NextRequest, NextResponse } from 'next/server';
import sql, { getRestaurantBySlug, getOrderById } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { generateBillReceiptHtml } from '@/lib/thermal-receipt-html';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';

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

function findBrowserExecutable(): string | null {
  const candidates = [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
  ];

  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
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

    const targetPrinter = printerName?.trim() || process.env.KOT_PRINTER_NAME || 'POS-80C';
    const isWindows = process.platform === 'win32';

    const billHtml = generateBillReceiptHtml({
      restaurantName: restaurant.name || (order as any).restaurant_name || undefined,
      logoUrl: restaurant.logo_url || undefined,
      address: restaurant.address || undefined,
      phone: restaurant.phone || undefined,
      gstNumber: restaurant.gst_number || undefined,
      primaryColor: restaurant.primary_color || '#16a34a',
      ticketNumber: order.ticket_number,
      orderType: order.order_type || 'DINE_IN',
      tableNumber: order.table_number || undefined,
      customerName: order.customer_name || undefined,
      customerPhone: order.phone || undefined,
      staffName: order.staff_name || undefined,
      createdAt: order.created_at,
      items: (order.items || []).map((i: any) => ({
        name: i.product_name || i.name,
        product_name: i.product_name,
        quantity: i.quantity,
        price_at_purchase: i.price_at_purchase,
        notes: i.notes,
      })),
      subtotal: order.subtotal,
      gstAmount: order.gst_amount,
      gstRate: order.gst_rate,
      gstType: order.gst_type,
      totalPrice: order.total_price,
      paymentMethod: order.payment_method || undefined,
      notes: order.notes || undefined,
    });

    // 1. If Windows host: Print directly to Windows printer via headless Edge/Chrome (zero popups!)
    if (isWindows) {
      const browserPath = findBrowserExecutable();
      if (browserPath) {
        const tempPath = path.join(os.tmpdir(), `bill-${Date.now()}-${order.ticket_number || '0'}.html`);
        fs.writeFileSync(tempPath, billHtml, 'utf8');

        try {
          await new Promise<void>((resolve, reject) => {
            const child = spawn(
              browserPath,
              [
                '--headless=old',
                '--disable-gpu',
                `--print-to-printer=${targetPrinter}`,
                tempPath,
              ],
              { windowsHide: true }
            );

            const timer = setTimeout(() => {
              try { child.kill(); } catch {}
              resolve(); // Don't block forever if it takes long
            }, 6000);

            child.on('close', () => {
              clearTimeout(timer);
              resolve();
            });

            child.on('error', (err) => {
              clearTimeout(timer);
              reject(err);
            });
          });

          // Clean up temp file
          try { fs.unlinkSync(tempPath); } catch {}

          return NextResponse.json({
            success: true,
            mode: 'server',
            message: `Bill printed directly to ${targetPrinter}!`,
            printer: targetPrinter,
          });
        } catch (printErr: any) {
          console.warn('Server headless print failed, falling back to browser:', printErr.message);
          try { fs.unlinkSync(tempPath); } catch {}
        }
      }
    }

    // 2. Client fallback (e.g. Cloud deployment or fallback)
    return NextResponse.json({
      success: true,
      mode: 'client',
      billHtml,
      printer: targetPrinter,
    });
  } catch (error: any) {
    console.error('Bill print API error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to print bill' },
      { status: 500 }
    );
  }
}

