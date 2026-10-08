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
  const rawTicket = String(order.ticket_number ?? '');
  const ticketNum = /^\d+$/.test(rawTicket) ? rawTicket.padStart(3, '0') : (rawTicket || '000');
  const invoiceDate = formatInvoiceDate(order.created_at);
  const items = (order.items || []).filter((i: any) => (i.quantity || 0) > 0);
  const restName = restaurant?.name || (order as any).restaurant_name || 'Restaurant';

  const num = (n: any) => Number(n || 0).toFixed(2);

  const computedSubtotal = items.reduce((s: number, item: any) => {
    return s + Number(item.price_at_purchase ?? item.price ?? 0) * Number(item.quantity || 1);
  }, 0);
  const subtotal = order.subtotal !== undefined && order.subtotal !== null
    ? Number(order.subtotal)
    : computedSubtotal;

  const orderTypeRaw = (order as any).order_type;
  const orderType = order.table_number
    ? 'Dine-in'
    : orderTypeRaw
      ? (() => {
        const t = String(orderTypeRaw).toLowerCase().replace(/_/g, '-');
        return t.charAt(0).toUpperCase() + t.slice(1);
      })()
      : 'Takeaway';

  const customerDisplay = order.customer_name || 'Guest';
  const rawTable = order.table_number ? String(order.table_number).trim() : '';
  const tableDisplay = rawTable || (ticketNum ? `#${ticketNum}` : '-');

  const gstType = (order as any).gst_type;
  const gstRate = Number((order as any).gst_rate) || 0;
  const gstAmount = Number((order as any).gst_amount) || 0;
  const discount = Number((order as any).discount_amount) || 0;

  const grandTotal = order.total_price !== undefined && order.total_price !== null
    ? Number(order.total_price)
    : subtotal + gstAmount - discount;

  // ---- helpers (all black & white) ----
  const dashed = `<div style="border-top:1px dashed #000;margin:6px 0;"></div>`;
  const solid = `<div style="border-top:2px solid #000;margin:6px 0;"></div>`;
  const row = (l: string, r: string, bold = false, size = 12) =>
    `<div style="display:flex;justify-content:space-between;gap:8px;font-size:${size}px;${bold ? 'font-weight:700;' : ''}">
       <span>${l}</span><span style="white-space:nowrap;">${r}</span>
     </div>`;

  // ---- header ----
  const addressLines = (restaurant?.address || '')
    .split(/[\r\n]+/).map(s => s.trim()).filter(Boolean)
    .map(s => `<div>${escapeHtml(s)}</div>`).join('');

  const header = `
    <div style="text-align:center;">
      <div style="font-size:20px;font-weight:700;">${escapeHtml(restName)}</div>
      ${addressLines}
      ${restaurant?.phone ? `<div>Tel: ${escapeHtml(restaurant.phone)}</div>` : ''}
      ${restaurant?.gst_number ? `<div>GSTIN: ${escapeHtml(restaurant.gst_number)}</div>` : ''}
    </div>`;

  // ---- 2x2 meta ----
  const meta = `
    ${row('<b>DATE &amp; TIME</b>', '<b>ORDER TYPE</b>')}
    ${row(escapeHtml(invoiceDate), escapeHtml(orderType))}
    <div style="height:6px;"></div>
    ${row('<b>CUSTOMER</b>', '<b>TABLE NO.</b>')}
    ${row(escapeHtml(customerDisplay), escapeHtml(tableDisplay))}`;

  // ---- items ----
  const cols = 'minmax(0,1fr) 28px 54px 62px';
  const itemsHtml = items.map((item: any) => {
    const name = escapeHtml(String(item.product_name || item.name || 'Item').trim().toUpperCase());
    const qty = Number(item.quantity) || 1;
    const price = Number(item.price_at_purchase ?? item.price ?? 0);
    const isFree = price === 0;
    return `
      <div style="display:grid;grid-template-columns:${cols};gap:4px;font-weight:700;padding:2px 0;">
        <span style="overflow-wrap:anywhere;">${name}${isFree ? ' <span style="font-size:10px;font-weight:800;">[FREE]</span>' : ''}</span>
        <span style="text-align:right;">${qty}</span>
        <span style="text-align:right;">${num(price)}</span>
        <span style="text-align:right;">${num(price * qty)}</span>
      </div>
      ${item.notes ? `<div style="padding-left:8px;font-size:11px;">* Note: ${escapeHtml(String(item.notes).trim())}</div>` : ''}`;
  }).join('');

  // ---- totals ----
  const gstHtml = gstType === 'REGULAR' && (gstRate || gstAmount)
    ? (() => {
      const half = gstRate / 2;
      const halfAmt = Math.round((gstAmount / 2) * 100) / 100;
      return `
          ${row(`CGST ${half}%`, `Rs.${num(halfAmt)}`)}
          ${row(`SGST ${half}%`, `Rs.${num(halfAmt)}`)}
          ${row(`Total GST ${gstRate}%`, `Rs.${num(gstAmount)}`)}`;
    })()
    : '';

  const discountHtml = discount > 0 ? row('Discount', `-Rs.${num(discount)}`) : '';

  const notesHtml = order.notes && order.notes.trim()
    ? `<div>Note: "${escapeHtml(order.notes.trim())}"</div>${dashed}`
    : '';

  return `
    <div class="bill-container" style="max-width:380px;margin:0 auto;padding:16px 12px;font-family:'Courier New',Courier,monospace;font-size:12px;line-height:1.4;background:#fff;color:#000;">
      ${header}
      ${dashed}
      ${meta}
      ${dashed}

      <div style="display:grid;grid-template-columns:${cols};gap:4px;font-weight:700;">
        <span>ITEM</span>
        <span style="text-align:right;">QTY</span>
        <span style="text-align:right;">PRICE</span>
        <span style="text-align:right;">TOTAL</span>
      </div>
      ${dashed}
      ${itemsHtml}
      ${dashed}

      ${row('Subtotal', `Rs.${num(subtotal)}`)}
      ${gstHtml}
      ${discountHtml}

      ${solid}
      ${row('Grand Total', `Rs.${num(grandTotal)}`, true, 16)}
      ${solid}

      ${order.payment_method || order.is_paid ? row('Payment', escapeHtml(order.payment_method || 'PAID'), false, 11) : ''}
      ${notesHtml}

      <div style="text-align:center;margin-top:10px;">
        <div style="font-weight:700;">Thank you for your visit!</div>
        <div>We hope you enjoyed your meal.</div>
        <div>Please visit us again!</div>
      </div>
    </div>
  `;
}
export function generateBillTemplateHTML(order: Order, restaurant?: BillRestaurantInfo): string {
  const content = generateBillTemplateContentHTML(order, restaurant);
  const rawTicket = String(order.ticket_number ?? '');
  const ticketPadded = /^\d+$/.test(rawTicket) ? rawTicket.padStart(3, '0') : (rawTicket || '001');
  const restName = restaurant?.name || (order as any).restaurant_name || 'Restaurant';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Bill #${ticketPadded} - ${escapeHtml(restName)}</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
  <style>
    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      color-adjust: exact !important;
    }
    @page {
      margin: 0;
      size: 80mm auto;
    }
    html, body {
      width: 100%;
      margin: 0;
      padding: 0;
      background: #fff;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      -webkit-font-smoothing: antialiased;
    }
    @media print {
      html, body {
        width: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
        background: #fff !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        color-adjust: exact !important;
      }
      .bill-container {
        width: 100% !important;
        max-width: 80mm !important;
        margin: 0 auto !important;
        padding: 4mm 6mm 10mm 6mm !important;
        box-sizing: border-box !important;
        border: none !important;
        box-shadow: none !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        color-adjust: exact !important;
      }
    }
    .bill-container {
      width: 100%;
      max-width: 380px;
      margin: 0 auto;
      padding: 16px 14px 20px;
      box-sizing: border-box;
      background: #fff;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
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
      try { iframe.remove(); } catch { }
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
          try { iframe?.remove(); } catch { }
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
