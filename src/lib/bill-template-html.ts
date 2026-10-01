import { Order } from '@/types';
import { formatPrice } from './format';

export interface BillRestaurantInfo {
  name: string;
  logo_url?: string;
  address?: string;
  phone?: string;
  gst_number?: string;
  primary_color?: string;
}

export function formatInvoiceDate(dateStr?: string | Date): string {
  try {
    const d = dateStr ? new Date(dateStr) : new Date();
    if (isNaN(d.getTime())) return new Date().toLocaleDateString('en-IN');
    return new Intl.DateTimeFormat('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Asia/Kolkata',
    }).format(d);
  } catch {
    return String(dateStr || '');
  }
}

export function escapeHtml(str: string): string {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function generateBillTemplateContentHTML(order: Order, restaurant?: BillRestaurantInfo): string {
  const pc = restaurant?.primary_color || '#059669';
  const rawTicket = String(order.ticket_number ?? '');
  const ticketNum = /^\d+$/.test(rawTicket) ? rawTicket.padStart(3, '0') : (rawTicket || '000');
  const invoiceDate = formatInvoiceDate(order.created_at);
  const items = (order.items || []).filter((i: any) => (i.quantity || 0) > 0);
  
  const computedSubtotal = items.reduce((s: number, item: any) => {
    const price = Number(item.price_at_purchase ?? item.price ?? 0);
    const qty = Number(item.quantity || 1);
    return s + (price * qty);
  }, 0);
  const subtotal = order.subtotal !== undefined && order.subtotal !== null ? Number(order.subtotal) : computedSubtotal;

  const getOrderTypeLabel = () => {
    if (order.table_number) return 'Dine-in';
    const rawType = (order as any).order_type;
    if (rawType) {
      const t = String(rawType).toLowerCase().replace(/_/g, '-');
      return t.charAt(0).toUpperCase() + t.slice(1);
    }
    return 'Dine-in';
  };

  const restName = restaurant?.name || (order as any).restaurant_name || 'Restaurant';
  const firstChar = escapeHtml(restName.charAt(0).toUpperCase());

  // Circular logo matching Starbucks layout
  const logoOrInitial = restaurant?.logo_url
    ? `<img src="${escapeHtml(restaurant.logo_url)}" alt="${escapeHtml(restName)}" style="width: 52px; height: 52px; border-radius: 50%; object-fit: cover; margin-bottom: 8px; display: block;" />`
    : `<div style="width: 52px; height: 52px; border-radius: 50%; background: ${pc}; color: #fff; display: inline-flex; align-items: center; justify-content: center; font-weight: 900; font-size: 22px; margin-bottom: 8px;">${firstChar}</div>`;

  let addressAndContact = '';
  if (restaurant?.address || restaurant?.phone || restaurant?.gst_number) {
    addressAndContact = `<p style="font-size: 11px; color: #6b7280; line-height: 1.5; margin: 0; text-align: center;">
      ${restaurant.address ? `<span>${escapeHtml(restaurant.address)}</span><br />` : ''}
      ${restaurant.phone ? `<span style="margin-top: 2px; display: inline-block;">Tel: ${escapeHtml(restaurant.phone)}</span><br />` : ''}
      ${restaurant.gst_number ? `<span style="margin-top: 2px; display: inline-block;">GSTIN: <strong style="font-weight: 800; color: #1f2937;">${escapeHtml(restaurant.gst_number)}</strong></span>` : ''}
    </p>`;
  }

  const itemsHtml = items.map((item: any) => {
    const name = escapeHtml(item.product_name || item.name || 'Item');
    const qty = item.quantity || 1;
    const unitPrice = Number(item.price_at_purchase ?? item.price ?? 0);
    const lineTotal = unitPrice * qty;
    const noteHtml = item.notes ? `<div style="grid-column: 1 / -1; font-size: 10px; font-style: italic; color: #6b7280; padding: 1px 0 2px 0;">★ ${escapeHtml(item.notes)}</div>` : '';

    return `
      <div style="display: grid; grid-template-columns: minmax(0, 1.8fr) 26px 56px 64px; gap: 4px; padding: 6px 0; border-bottom: 1px solid #f3f4f6; box-sizing: border-box; align-items: center;">
        <span style="font-size: 11px; font-weight: 800; color: #111827; text-transform: uppercase; overflow-wrap: break-word; word-break: break-word; line-height: 1.25;">
          ${name}
        </span>
        <span style="font-size: 11px; font-weight: 500; color: #6b7280; text-align: center; white-space: nowrap;">
          ${qty}
        </span>
        <span style="font-size: 11px; font-weight: 500; color: #6b7280; text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums;">
          ${formatPrice(unitPrice)}
        </span>
        <span style="font-size: 11px; font-weight: 800; color: #111827; text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums;">
          ${formatPrice(lineTotal)}
        </span>
        ${noteHtml}
      </div>
    `;
  }).join('');

  let gstHtml = '';
  if ((order as any).gst_type === 'REGULAR') {
    const rate = Number((order as any).gst_rate) || 0;
    const amount = Number((order as any).gst_amount) || 0;
    const halfRate = rate / 2;
    const halfAmount = Math.round((amount / 2) * 100) / 100;
    gstHtml = `
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 3px 0; color: #4b5563;">
        <span style="font-size: 12px; font-weight: 500;">CGST ${halfRate}%</span>
        <span style="font-size: 12px; font-weight: 600; white-space: nowrap; font-variant-numeric: tabular-nums;">${formatPrice(halfAmount)}</span>
      </div>
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 3px 0; color: #4b5563;">
        <span style="font-size: 12px; font-weight: 500;">SGST ${halfRate}%</span>
        <span style="font-size: 12px; font-weight: 600; white-space: nowrap; font-variant-numeric: tabular-nums;">${formatPrice(halfAmount)}</span>
      </div>
      <hr style="border: none; border-top: 1px dashed #d1d5db; margin: 4px 0;" />
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 3px 0; color: #1a1a1a;">
        <span style="font-size: 13px; font-weight: 600;">Total GST ${rate}%</span>
        <span style="font-size: 13px; font-weight: 700; white-space: nowrap; font-variant-numeric: tabular-nums;">${formatPrice(amount)}</span>
      </div>
    `;
  }

  const customerDisplay = order.customer_name || 'Guest';
  const rawTable = order.table_number ? String(order.table_number).trim() : '';
  const tableDisplay = rawTable
    ? (rawTable.toLowerCase().startsWith('table') ? rawTable : `Table ${rawTable}`)
    : (ticketNum ? `#${ticketNum}` : '-');

  const grandTotal = order.total_price !== undefined && order.total_price !== null
    ? Number(order.total_price)
    : (subtotal + Number((order as any).gst_amount || 0) - Number((order as any).discount_amount || 0));

  const paymentMethod = (order as any).payment_method || ((order as any).is_paid ? 'PAID' : '');

  return `
    <div class="bill-container" style="max-width: 380px; margin: 0 auto; padding: 24px 20px 20px; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #fff; color: #1a1a1a;">
      <!-- Header: Logo, Name, Address, Tel, GSTIN -->
      <div style="display: flex; flex-direction: column; align-items: center; text-align: center; margin-bottom: 16px;">
        ${logoOrInitial}
        <h2 style="font-size: 20px; font-weight: 900; color: #111827; margin: 0 0 4px 0; letter-spacing: -0.01em;">
          ${escapeHtml(restName)}
        </h2>
        ${addressAndContact}
      </div>

      <!-- Solid Top Divider -->
      <hr style="border: none; border-top: 1.5px solid #e5e7eb; margin: 14px 0;" />

      <!-- 2x2 Meta Grid -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px 16px; margin-bottom: 4px;">
        <div>
          <p style="font-size: 10px; font-weight: 800; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 2px 0;">DATE &amp; TIME</p>
          <p style="font-size: 12.5px; font-weight: 700; color: #1f2937; margin: 0;">${invoiceDate}</p>
        </div>
        <div>
          <p style="font-size: 10px; font-weight: 800; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 2px 0;">ORDER TYPE</p>
          <p style="font-size: 12.5px; font-weight: 700; color: #1f2937; margin: 0;">${getOrderTypeLabel()}</p>
        </div>
        <div>
          <p style="font-size: 10px; font-weight: 800; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 2px 0;">CUSTOMER</p>
          <p style="font-size: 12.5px; font-weight: 700; color: #1f2937; margin: 0;">${escapeHtml(customerDisplay)}</p>
        </div>
        <div>
          <p style="font-size: 10px; font-weight: 800; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 2px 0;">TABLE NO.</p>
          <p style="font-size: 12.5px; font-weight: 700; color: #1f2937; margin: 0;">${escapeHtml(tableDisplay)}</p>
        </div>
      </div>

      <!-- Dashed Mid Divider -->
      <hr style="border: none; border-top: 1.5px dashed #d1d5db; margin: 14px 0;" />

      <!-- Itemized Table -->
      <div>
        <div style="display: grid; grid-template-columns: minmax(0, 1.8fr) 26px 56px 64px; gap: 4px; padding: 4px 0 6px 0; border-bottom: 1px solid #e5e7eb; box-sizing: border-box;">
          <span style="font-size: 10px; font-weight: 800; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.05em;">ITEM</span>
          <span style="font-size: 10px; font-weight: 800; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.05em; text-align: center; white-space: nowrap;">QTY</span>
          <span style="font-size: 10px; font-weight: 800; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.05em; text-align: right; white-space: nowrap;">PRICE</span>
          <span style="font-size: 10px; font-weight: 800; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.05em; text-align: right; white-space: nowrap;">TOTAL</span>
        </div>
        ${itemsHtml}
      </div>

      <!-- Dashed Divider before Subtotal -->
      <hr style="border: none; border-top: 1.5px dashed #d1d5db; margin: 12px 0;" />

      <!-- Subtotal -->
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 4px 0;">
        <span style="font-size: 13.5px; font-weight: 700; color: #374151;">Subtotal</span>
        <span style="font-size: 13.5px; font-weight: 800; color: #111827; white-space: nowrap; font-variant-numeric: tabular-nums;">${formatPrice(subtotal)}</span>
      </div>

      ${gstHtml}
      ${(order as any).discount_amount && Number((order as any).discount_amount) > 0 ? `
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 4px 0; color: #16a34a;">
        <span style="font-size: 13.5px; font-weight: 700;">Discount</span>
        <span style="font-size: 13.5px; font-weight: 800; white-space: nowrap; font-variant-numeric: tabular-nums;">-${formatPrice((order as any).discount_amount)}</span>
      </div>
      ` : ''}

      ${paymentMethod ? `
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 4px 0; color: #4b5563;">
        <span style="font-size: 12.5px; font-weight: 600;">Payment</span>
        <span style="font-size: 11px; font-weight: 800; color: #166534; background: #dcfce7; border: 1px solid #86efac; border-radius: 4px; padding: 1px 6px; text-transform: uppercase;">✓ ${escapeHtml(paymentMethod)}</span>
      </div>
      ` : ''}

      <!-- Solid Brand Color Line before Grand Total -->
      <div style="height: 2px; background: ${pc}; margin: 8px 0 4px 0;"></div>

      <!-- Grand Total -->
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0 4px 0;">
        <span style="font-size: 15.5px; font-weight: 900; color: #111827;">Grand Total</span>
        <span style="font-size: 18px; font-weight: 900; color: ${pc}; white-space: nowrap; font-variant-numeric: tabular-nums;">${formatPrice(grandTotal)}</span>
      </div>

      ${order.notes && order.notes.trim() ? `
      <div style="margin-top: 10px; padding: 6px 8px; background: #f9fafb; border-left: 3px solid ${pc}; font-size: 11px; border-radius: 0 4px 4px 0;">
        <div style="font-weight: 800; color: #374151; font-size: 10px; text-transform: uppercase; margin-bottom: 2px;">Note:</div>
        <div style="color: #4b5563; font-style: italic;">"${escapeHtml(order.notes.trim())}"</div>
      </div>
      ` : ''}

      <!-- Dashed Divider before Footer -->
      <hr style="border: none; border-top: 1.5px dashed #d1d5db; margin: 18px 0 14px 0;" />

      <!-- Footer Message -->
      <div style="text-align: center; padding-top: 4px;">
        <p style="font-size: 13.5px; font-weight: 800; color: #374151; margin: 0 0 4px 0;">Thank you for your visit!</p>
        <p style="font-size: 11px; color: #9ca3af; line-height: 1.5; margin: 0;">
          We hope you enjoyed your meal.<br />
          Please visit us again!
        </p>
      </div>
    </div>
  `;
}

export function generateBillTemplateHTML(order: Order, restaurant?: BillRestaurantInfo): string {
  const content = generateBillTemplateContentHTML(order, restaurant);
  const rawTicket = String(order.ticket_number ?? '');
  const ticketNum = /^\d+$/.test(rawTicket) ? rawTicket.padStart(3, '0') : (rawTicket || '000');
  const restName = restaurant?.name || (order as any).restaurant_name || 'Restaurant';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Bill #${ticketNum} - ${escapeHtml(restName)}</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #1a1a1a; background: #fff; -webkit-font-smoothing: antialiased;
    }
    .bill-container { max-width: 380px; margin: 0 auto; padding: 24px 20px 20px; }
    @page {
      margin: 0;
      size: 80mm auto;
    }
    @media print {
      html, body {
        width: 100% !important;
        background: #fff !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      .bill-container {
        width: 100% !important;
        max-width: 80mm !important;
        padding: 4mm 6mm 10mm 6mm !important;
        margin: 0 auto !important;
        box-shadow: none !important;
        border: none !important;
        box-sizing: border-box !important;
      }
    }
  </style>
</head>
<body>
  ${content}
</body>
</html>`;
}

export function printBillTemplateDirectly(order: Order, restaurant?: BillRestaurantInfo): void {
  try {
    const html = generateBillTemplateHTML(order, restaurant);
    const iframeId = 'bill-print-direct-iframe';
    let iframe = document.getElementById(iframeId) as HTMLIFrameElement | null;
    if (iframe) {
      try { iframe.remove(); } catch {}
    }

    iframe = document.createElement('iframe');
    iframe.id = iframeId;
    // CRITICAL for Chromium: Non-zero size with opacity: 0 ensures layout engine paginates properly
    iframe.style.position = 'fixed';
    iframe.style.top = '0';
    iframe.style.left = '0';
    iframe.style.width = '80mm';
    iframe.style.height = '100vh';
    iframe.style.opacity = '0.01';
    iframe.style.pointerEvents = 'none';
    iframe.style.border = 'none';
    iframe.style.zIndex = '-9999';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) throw new Error('Cannot access iframe document');
    doc.open();
    doc.write(html);
    doc.close();

    let printed = false;
    const triggerPrint = () => {
      if (printed) return;
      printed = true;
      try {
        iframe?.contentWindow?.focus();
        iframe?.contentWindow?.print();
      } catch (err) {
        console.error('Direct bill print error:', err);
      } finally {
        setTimeout(() => {
          try { iframe?.remove(); } catch {}
        }, 60000);
      }
    };

    // If an image is in the iframe, wait for it to load before triggering print
    const img = iframe.contentWindow?.document?.querySelector('img');
    if (img && !img.complete) {
      img.onload = () => setTimeout(triggerPrint, 80);
      img.onerror = () => setTimeout(triggerPrint, 80);
    }

    iframe.onload = () => {
      setTimeout(triggerPrint, 150);
    };

    setTimeout(triggerPrint, 350);
  } catch (err) {
    console.error('printBillTemplateDirectly error:', err);
    throw err;
  }
}
