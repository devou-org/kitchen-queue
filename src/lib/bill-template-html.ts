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

export function generateBillTemplateHTML(order: Order, restaurant?: BillRestaurantInfo): string {
  const pc = restaurant?.primary_color || '#059669';
  const ticketNum = String(order.ticket_number || '').padStart(3, '0');
  const invoiceDate = formatInvoiceDate(order.created_at);
  const items = order.items || [];
  const subtotal = items.reduce((s, item) => s + (item.price_at_purchase || 0) * (item.quantity || 1), 0);
  const getOrderTypeLabel = () => {
    if (order.table_number) return 'Dine-in';
    if ((order as any).order_type) return (order as any).order_type;
    return 'Dine-in';
  };
  const restName = restaurant?.name || (order as any).restaurant_name || 'Restaurant';
  const firstChar = escapeHtml(restName.charAt(0).toUpperCase());

  const logoOrInitial = restaurant?.logo_url
    ? `<img src="${restaurant.logo_url}" alt="${escapeHtml(restName)}" style="width: 48px; height: 48px; border-radius: 10px; object-fit: cover; margin-bottom: 8px;" />`
    : `<div style="width: 48px; height: 48px; border-radius: 10px; background: ${pc}; color: #fff; display: inline-flex; align-items: center; justify-content: center; font-weight: 900; font-size: 20px; margin-bottom: 8px;">${firstChar}</div>`;

  let addressAndContact = '';
  if (restaurant?.address || restaurant?.phone || restaurant?.gst_number) {
    addressAndContact = `<p style="font-size: 11px; color: #6b7280; line-height: 1.5; margin: 0;">
      ${restaurant.address ? `${escapeHtml(restaurant.address)}<br />` : ''}
      ${restaurant.phone ? `Tel: ${escapeHtml(restaurant.phone)}<br />` : ''}
      ${restaurant.gst_number ? `GSTIN: <span style="font-weight: 700;">${escapeHtml(restaurant.gst_number)}</span>` : ''}
    </p>`;
  }

  const itemsHtml = items.map((item) => `
    <div style="display: grid; grid-template-columns: minmax(0, 1.8fr) 24px 50px 58px; gap: 6px; padding: 6px 0; border-bottom: 1px solid #f3f4f6; box-sizing: border-box; align-items: center;">
      <span style="font-size: 11px; font-weight: 600; color: #1a1a1a; overflow-wrap: break-word; word-break: break-word; line-height: 1.25;">
        ${escapeHtml(item.product_name || (item as any).name || 'Item')}
      </span>
      <span style="font-size: 11px; font-weight: 500; color: #6b7280; text-align: center; white-space: nowrap;">
        ${item.quantity || 1}
      </span>
      <span style="font-size: 11px; font-weight: 500; color: #6b7280; text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums;">
        ${formatPrice(item.price_at_purchase || 0)}
      </span>
      <span style="font-size: 11px; font-weight: 700; color: #1a1a1a; text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums;">
        ${formatPrice((item.price_at_purchase || 0) * (item.quantity || 1))}
      </span>
    </div>
  `).join('');

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

  const content = `
    <div class="bill-container" style="max-width: 380px; margin: 0 auto; padding: 28px 24px 20px; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
      <div style="display: flex; flex-direction: column; align-items: center; text-align: center; margin-bottom: 20px;">
        ${logoOrInitial}
        <h2 style="font-size: 18px; font-weight: 800; color: #1a1a1a; margin-bottom: 2px;">
          ${escapeHtml(restName)}
        </h2>
        ${addressAndContact}
      </div>

      <hr style="border: none; border-top: 2px solid #e5e7eb; margin: 14px 0;" />

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin-bottom: 4px;">
        <div>
          <p style="font-size: 10px; font-weight: 700; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 2px 0;">Date & Time</p>
          <p style="font-size: 12px; font-weight: 600; color: #374151; margin: 0;">${invoiceDate}</p>
        </div>
        <div>
          <p style="font-size: 10px; font-weight: 700; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 2px 0;">Order Type</p>
          <p style="font-size: 12px; font-weight: 600; color: #374151; margin: 0;">${getOrderTypeLabel()}</p>
        </div>
        ${order.customer_name ? `
          <div>
            <p style="font-size: 10px; font-weight: 700; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 2px 0;">Customer</p>
            <p style="font-size: 12px; font-weight: 600; color: #374151; margin: 0;">${escapeHtml(order.customer_name)}</p>
          </div>
        ` : ''}
        ${order.table_number ? `
          <div>
            <p style="font-size: 10px; font-weight: 700; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 2px 0;">Table No.</p>
            <p style="font-size: 12px; font-weight: 600; color: #374151; margin: 0;">${escapeHtml(order.table_number)}</p>
          </div>
        ` : (!order.table_number && order.ticket_number ? `
          <div>
            <p style="font-size: 10px; font-weight: 700; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 2px 0;">Token</p>
            <p style="font-size: 12px; font-weight: 600; color: #374151; margin: 0;">#${ticketNum}</p>
          </div>
        ` : '')}
      </div>

      <hr style="border: none; border-top: 1px dashed #d1d5db; margin: 14px 0;" />

      <div>
        <div style="display: grid; grid-template-columns: minmax(0, 1.8fr) 24px 50px 58px; gap: 6px; padding: 6px 0; border-bottom: 1px solid #e5e7eb; box-sizing: border-box;">
          <span style="font-size: 10px; font-weight: 700; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.04em;">Item</span>
          <span style="font-size: 10px; font-weight: 700; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.04em; text-align: center; white-space: nowrap;">Qty</span>
          <span style="font-size: 10px; font-weight: 700; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.04em; text-align: right; white-space: nowrap;">Price</span>
          <span style="font-size: 10px; font-weight: 700; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.04em; text-align: right; white-space: nowrap;">Total</span>
        </div>
        ${itemsHtml}
      </div>

      <hr style="border: none; border-top: 1px dashed #d1d5db; margin: 12px 0;" />

      <div style="display: flex; justify-content: space-between; align-items: center; padding: 4px 0;">
        <span style="font-size: 13px; font-weight: 600; color: #374151;">Subtotal</span>
        <span style="font-size: 13px; font-weight: 700; color: #374151; white-space: nowrap; font-variant-numeric: tabular-nums;">${formatPrice(subtotal)}</span>
      </div>

      ${gstHtml}

      <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 0; margin-top: 4px; border-top: 2px solid ${pc};">
        <span style="font-size: 15px; font-weight: 800; color: #1a1a1a;">Grand Total</span>
        <span style="font-size: 17px; font-weight: 900; color: ${pc}; white-space: nowrap; font-variant-numeric: tabular-nums;">${formatPrice(order.total_price)}</span>
      </div>

      <div style="text-align: center; margin-top: 20px; padding-top: 16px; border-top: 1px dashed #d1d5db;">
        <p style="font-size: 13px; font-weight: 700; color: #374151; margin: 0 0 4px 0;">Thank you for your visit!</p>
        <p style="font-size: 11px; color: #9ca3af; line-height: 1.6; margin: 0;">
          We hope you enjoyed your meal.<br />
          Please visit us again!
        </p>
      </div>
    </div>
  `;

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
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      color: #1a1a1a; background: #fff; -webkit-font-smoothing: antialiased;
    }
    .bill-container { max-width: 380px; margin: 0 auto; padding: 28px 24px 20px; }
    @page {
      margin: 0;
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
        max-width: 100% !important;
        padding: 4mm 12mm 16mm 10mm !important;
        margin: 0 !important;
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
    const iframeId = `bill-print-direct-iframe-${Date.now()}`;
    let iframe = document.getElementById(iframeId) as HTMLIFrameElement | null;
    if (iframe) iframe.remove();
    iframe = document.createElement('iframe');
    iframe.id = iframeId;
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
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
        setTimeout(() => { try { iframe?.remove(); } catch {} }, 60000);
      } catch (err) {
        console.error('Direct bill print error:', err);
      }
    };

    iframe.onload = () => {
      setTimeout(triggerPrint, 250);
    };
    setTimeout(triggerPrint, 500);
  } catch (err) {
    console.error('printBillTemplateDirectly error:', err);
    throw err;
  }
}
