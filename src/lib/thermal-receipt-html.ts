import { KotPrintData } from './escpos';

/**
 * Generate 80mm Thermal Receipt HTML for browser printing.
 * Formatted specifically for 80mm (3-inch) POS thermal roll printers like POS-80C.
 */
export function generateThermalReceiptHtml(data: KotPrintData): string {
  const restaurantName = data.restaurantName || 'QDINE';
  const counterTitle = (data.counterName || 'ALL COUNTERS').toUpperCase();
  const ticketPadded = `#${String(data.ticketNumber).padStart(3, '0')}`;
  const orderType = (data.orderType || 'DINE_IN').replace('_', '-').toUpperCase();

  const now = data.createdAt ? new Date(data.createdAt) : new Date();
  const dateStr = now.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const timeStr = now.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  const rawTable = data.tableNumber ? String(data.tableNumber).trim() : '';
  const tableDisplay = rawTable
    ? rawTable.toLowerCase().startsWith('table')
      ? rawTable
      : `Table ${rawTable}`
    : '';

  let totalQty = 0;
  const itemsHtml = data.items
    .map((item) => {
      const name = (item.product_name || item.name || 'Item').trim();
      const qty = Number(item.quantity) || 1;
      totalQty += qty;
      return `
        <div class="item-row">
          <div class="item-name">${escapeHtml(name)}</div>
          <div class="item-qty">&times;&nbsp;${qty}</div>
        </div>
        ${item.notes ? `<div class="item-note">* Note: ${escapeHtml(item.notes)}</div>` : ''}
      `;
    })
    .join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>KOT ${ticketPadded} - ${counterTitle}</title>
  <style>
    @page {
      size: 80mm auto;
      margin: 0;
    }
    @media print {
      html, body {
        width: 80mm !important;
        margin: 0 !important;
        padding: 0 !important;
        background: #fff !important;
      }
      .receipt-container {
        width: 72mm !important;
        margin: 0 auto !important;
        padding: 6mm 2mm 15mm 2mm !important;
      }
    }
    html, body {
      background: #f4f4f5;
      font-family: 'Courier New', Courier, monospace;
      color: #000;
      line-height: 1.25;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .receipt-container {
      width: 72mm;
      margin: 20px auto;
      background: #fff;
      padding: 14px 10px 24px 10px;
      box-sizing: border-box;
      font-size: 13px;
    }
    .center {
      text-align: center;
    }
    .bold {
      font-weight: 900;
    }
    .title {
      font-size: 20px;
      font-weight: 900;
      letter-spacing: 0.05em;
      margin: 0 0 2px 0;
    }
    .subtitle {
      font-size: 13px;
      font-weight: 800;
      margin: 0 0 6px 0;
    }
    .counter-banner {
      border-top: 2px dashed #000;
      border-bottom: 2px dashed #000;
      padding: 6px 2px;
      margin: 8px 0;
      text-align: center;
      font-size: 16px;
      font-weight: 900;
      letter-spacing: 0.03em;
    }
    .meta-row {
      display: flex;
      justify-content: space-between;
      margin: 2px 0;
      font-size: 13px;
    }
    .meta-ticket {
      font-size: 16px;
      font-weight: 900;
    }
    .divider {
      border-top: 1px dashed #000;
      margin: 6px 0;
    }
    .header-row {
      display: flex;
      justify-content: space-between;
      font-size: 12px;
      font-weight: 900;
      margin-bottom: 4px;
    }
    .item-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin: 5px 0;
      font-size: 14px;
      font-weight: 800;
    }
    .item-name {
      flex: 1;
      padding-right: 8px;
      word-break: break-word;
    }
    .item-qty {
      font-size: 15px;
      font-weight: 900;
      white-space: nowrap;
    }
    .item-note {
      font-size: 11px;
      font-style: italic;
      padding-left: 8px;
      margin-bottom: 4px;
    }
    .total-row {
      display: flex;
      justify-content: space-between;
      font-size: 14px;
      font-weight: 900;
      margin-top: 4px;
    }
    .notes-box {
      margin-top: 6px;
      padding-top: 6px;
      border-top: 1px dashed #000;
      font-size: 12px;
    }
    .notes-title {
      font-weight: 900;
      margin-bottom: 2px;
    }
    .notes-content {
      font-style: italic;
    }
    .cut-guide {
      border-top: 1px solid #ccc;
      margin-top: 20px;
      padding-top: 10px;
      text-align: center;
      font-size: 10px;
      color: #888;
    }
  </style>
</head>
<body>
  <div class="receipt-container">
    <div class="center">
      <div class="title">${escapeHtml(restaurantName)}</div>
      <div class="subtitle">*** KITCHEN ORDER TICKET ***</div>
    </div>

    <div class="counter-banner">
      [ COUNTER: ${escapeHtml(counterTitle)} ]
    </div>

    <div class="meta-row">
      <span class="meta-ticket">TICKET: ${ticketPadded}</span>
      <span class="bold">TYPE: ${orderType}</span>
    </div>

    ${tableDisplay ? `<div class="meta-row"><span class="bold">TABLE: ${escapeHtml(tableDisplay)}</span></div>` : ''}

    <div class="meta-row">
      <span>DATE: ${dateStr}</span>
      <span>${timeStr}</span>
    </div>

    ${data.customerName && data.customerName !== 'Guest' ? `<div class="meta-row"><span>CUSTOMER: ${escapeHtml(data.customerName)}</span></div>` : ''}
    ${data.staffName ? `<div class="meta-row"><span>SERVER: ${escapeHtml(data.staffName)}</span></div>` : ''}

    <div class="divider"></div>
    <div class="header-row">
      <span>ITEM</span>
      <span>QTY</span>
    </div>
    <div class="divider"></div>

    <div class="items-list">
      ${itemsHtml}
    </div>

    <div class="divider"></div>
    <div class="total-row">
      <span>TOTAL ITEMS:</span>
      <span>${totalQty}</span>
    </div>

    ${
      data.notes && data.notes.trim()
        ? `
        <div class="notes-box">
          <div class="notes-title">SPECIAL INSTRUCTIONS:</div>
          <div class="notes-content">"${escapeHtml(data.notes.trim())}"</div>
        </div>
        `
        : ''
    }

    <div class="divider"></div>
    <div class="cut-guide">&nbsp;</div>
  </div>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export interface BillPrintData {
  restaurantName?: string;
  logoUrl?: string;
  address?: string;
  phone?: string;
  restaurantPhone?: string;
  gstNumber?: string;
  primaryColor?: string;
  ticketNumber: number | string;
  orderType?: string;
  tableNumber?: string;
  customerName?: string;
  customerPhone?: string;
  staffName?: string;
  createdAt?: string | Date;
  items: Array<{
    name?: string;
    product_name?: string;
    quantity: number;
    price_at_purchase?: number;
    notes?: string;
  }>;
  subtotal?: number;
  gstAmount?: number;
  gstRate?: number;
  gstType?: string;
  totalPrice: number;
  paymentMethod?: string;
  notes?: string;
}

/**
 * Generate 80mm (3-inch) Thermal BILL / Receipt HTML for browser printing.
 * Formatted to exactly match the modern BillTemplate with crisp typography,
 * restaurant branding, clear itemized table, and full-width 3-inch roll utilization.
 * Always prints in colour mode (-webkit-print-color-adjust: exact).
 */
export function generateBillReceiptHtml(data: BillPrintData): string {
  const restaurantName = (data.restaurantName || 'QDINE').trim();
  const ticketPadded = String(data.ticketNumber).padStart(3, '0');
  const orderTypeFormatted = (data.orderType || 'DINE_IN').replace(/_/g, ' ').toUpperCase();
  const primaryColor = data.primaryColor || '#059669';

  const now = data.createdAt ? new Date(data.createdAt) : new Date();
  const dateStr = now.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  });
  const timeStr = now.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata',
  });

  const rawTable = data.tableNumber ? String(data.tableNumber).trim() : '';
  const tableDisplay = rawTable
    ? rawTable.toLowerCase().startsWith('table')
      ? rawTable
      : `Table ${rawTable}`
    : '';

  const customerName = data.customerName && data.customerName.trim() !== '' ? data.customerName.trim() : '';
  const customerPhone = data.customerPhone || data.phone || '';
  const restaurantPhone = data.restaurantPhone || (data.phone && !customerPhone ? data.phone : '');

  const currencySymbol = '₹';

  let computedSubtotal = 0;
  const itemsHtml = (data.items || [])
    .filter((item) => (item.quantity || 0) > 0)
    .map((item) => {
      const name = (item.product_name || item.name || 'Item').trim();
      const qty = Number(item.quantity) || 1;
      const unitPrice = Number(item.price_at_purchase) || 0;
      const lineTotal = unitPrice * qty;
      computedSubtotal += lineTotal;
      return `
        <div style="display: grid; grid-template-columns: minmax(0, 1.8fr) 22px 46px 52px; gap: 4px; padding: 5px 6px; border-bottom: 1px solid #f1f5f9; align-items: center; box-sizing: border-box;">
          <span style="font-size: 11px; font-weight: 600; color: #0f172a; overflow-wrap: break-word; word-break: break-word; line-height: 1.25;">${escapeHtml(name)}</span>
          <span style="font-size: 11px; font-weight: 500; color: #475569; text-align: center; white-space: nowrap;">${qty}</span>
          <span style="font-size: 11px; font-weight: 500; color: #475569; text-align: right; white-space: nowrap !important; font-variant-numeric: tabular-nums;">${currencySymbol}${unitPrice.toFixed(2)}</span>
          <span style="font-size: 11px; font-weight: 700; color: #0f172a; text-align: right; white-space: nowrap !important; font-variant-numeric: tabular-nums;">${currencySymbol}${lineTotal.toFixed(2)}</span>
        </div>
        ${item.notes ? `<div style="font-size: 9.5px; font-style: italic; color: #64748b; padding-left: 2px; margin-top: 1px; margin-bottom: 3px;">★ ${escapeHtml(item.notes)}</div>` : ''}
      `;
    })
    .join('');

  const displaySubtotal = data.subtotal !== undefined ? Number(data.subtotal) : computedSubtotal;
  const gstAmount = Number(data.gstAmount) || 0;
  const totalPrice = Number(data.totalPrice) || displaySubtotal + gstAmount;
  const showGst = gstAmount > 0 && data.gstType && data.gstType !== 'NONE';
  const payMethod = data.paymentMethod ? data.paymentMethod.toUpperCase() : '';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Bill #${ticketPadded} - ${escapeHtml(restaurantName)}</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
  <style>
    @page {
      margin: 0;
    }
    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      color-adjust: exact !important;
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
      }
      .bill-container {
        width: 100% !important;
        max-width: 100% !important;
        margin: 0 !important;
        padding: 4mm 12mm 16mm 10mm !important;
        box-sizing: border-box !important;
      }
    }
    .bill-container {
      width: 100%;
      max-width: 80mm;
      margin: 0 auto;
      padding: 4mm 12mm 16mm 10mm;
      box-sizing: border-box;
    }
  </style>
</head>
<body>
  <div class="bill-container">

    <!-- Header: Logo & Restaurant Info -->
    <div style="display: flex; flex-direction: column; align-items: center; text-align: center; margin-bottom: 8px;">
      ${data.logoUrl ? `
        <img src="${escapeHtml(data.logoUrl)}" alt="${escapeHtml(restaurantName)}" style="width: 44px; height: 44px; border-radius: 12px; object-fit: cover; margin-bottom: 6px; border: 2px solid ${primaryColor}20; box-shadow: 0 4px 10px ${primaryColor}25;" />
      ` : `
        <div style="width: 42px; height: 42px; border-radius: 12px; background: linear-gradient(135deg, ${primaryColor}, #0f766e); color: #ffffff; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 20px; margin-bottom: 6px; box-shadow: 0 4px 10px ${primaryColor}30;">
          ${escapeHtml(restaurantName.charAt(0).toUpperCase())}
        </div>
      `}
      <h2 style="font-size: 16px; font-weight: 900; color: #0f172a; margin: 0 0 2px 0; line-height: 1.2;">
        ${escapeHtml(restaurantName)}
      </h2>
      <div style="display: inline-block; background: ${primaryColor}15; color: ${primaryColor}; border: 1px solid ${primaryColor}35; border-radius: 9999px; padding: 2px 10px; font-size: 9.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; margin: 3px 0 5px 0;">
        TAX INVOICE / BILL
      </div>
      ${(data.address || restaurantPhone || data.gstNumber) ? `
        <div style="font-size: 10px; color: #64748b; line-height: 1.35; margin: 0;">
          ${data.address ? `<div>${escapeHtml(data.address)}</div>` : ''}
          ${restaurantPhone ? `<div style="margin-top: 1px;">Tel: ${escapeHtml(restaurantPhone)}</div>` : ''}
          ${data.gstNumber ? `<div style="margin-top: 1px; color: ${primaryColor}; font-weight: 700;">GSTIN: <strong style="font-weight: 800; color: #0f172a;">${escapeHtml(data.gstNumber)}</strong></div>` : ''}
        </div>
      ` : ''}
    </div>

    <!-- Divider -->
    <hr style="border: none; border-top: 1.5px solid #e2e8f0; margin: 8px 0;" />

    <!-- Order Meta (Stylized colored card) -->
    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 7px 9px; margin: 6px 0 10px 0; display: grid; grid-template-columns: 1fr 1fr; gap: 6px 8px;">
      <div>
        <p style="font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 2px;">
          Date & Time
        </p>
        <p style="font-size: 11px; font-weight: 700; color: #0f172a;">${dateStr}, ${timeStr}</p>
      </div>
      <div>
        <p style="font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 2px;">
          Order Type
        </p>
        <span style="display: inline-block; background: ${primaryColor}18; color: ${primaryColor}; border: 1px solid ${primaryColor}40; padding: 1px 6px; border-radius: 4px; font-size: 10px; font-weight: 800; text-transform: uppercase; white-space: nowrap;">
          ${escapeHtml(orderTypeFormatted)}
        </span>
      </div>
      ${customerName && customerName !== 'Guest' ? `
      <div>
        <p style="font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 2px;">
          Customer
        </p>
        <p style="font-size: 11px; font-weight: 700; color: #0f172a;">${escapeHtml(customerName)}</p>
      </div>` : ''}
      ${tableDisplay ? `
      <div>
        <p style="font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 2px;">
          Table No.
        </p>
        <span style="display: inline-block; background: #fef3c7; color: #92400e; border: 1px solid #fde68a; padding: 1px 6px; border-radius: 4px; font-size: 10px; font-weight: 800; white-space: nowrap;">
          ${escapeHtml(tableDisplay)}
        </span>
      </div>` : ''}
      <div>
        <p style="font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 2px;">
          Token
        </p>
        <span style="display: inline-block; background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; padding: 1px 6px; border-radius: 4px; font-size: 10px; font-weight: 800; white-space: nowrap;">
          #${ticketPadded}
        </span>
      </div>
      ${data.staffName ? `
      <div>
        <p style="font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 2px;">
          Server
        </p>
        <p style="font-size: 11px; font-weight: 700; color: #0f172a;">${escapeHtml(data.staffName)}</p>
      </div>` : ''}
    </div>

    <!-- Itemized Table with Colored Header -->
    <div>
      <div style="display: grid; grid-template-columns: minmax(0, 1.8fr) 22px 46px 52px; gap: 4px; padding: 5px 6px; background: ${primaryColor}; color: #ffffff !important; border-radius: 6px; box-sizing: border-box; margin-bottom: 4px;">
        <span style="font-size: 9px; font-weight: 800; color: #ffffff !important; text-transform: uppercase; letter-spacing: 0.05em;">ITEM</span>
        <span style="font-size: 9px; font-weight: 800; color: #ffffff !important; text-transform: uppercase; letter-spacing: 0.05em; text-align: center; white-space: nowrap;">QTY</span>
        <span style="font-size: 9px; font-weight: 800; color: #ffffff !important; text-transform: uppercase; letter-spacing: 0.05em; text-align: right; white-space: nowrap;">PRICE</span>
        <span style="font-size: 9px; font-weight: 800; color: #ffffff !important; text-transform: uppercase; letter-spacing: 0.05em; text-align: right; white-space: nowrap;">TOTAL</span>
      </div>

      ${itemsHtml}
    </div>

    <!-- Divider -->
    <hr style="border: none; border-top: 1px dashed #cbd5e1; margin: 8px 0;" />

    <!-- Subtotal & GST Summary Card -->
    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 7px 9px; margin-top: 6px;">
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 2px 0;">
        <span style="font-size: 12px; font-weight: 600; color: #334155;">Subtotal</span>
        <span style="font-size: 12px; font-weight: 700; color: #0f172a; white-space: nowrap !important; font-variant-numeric: tabular-nums;">${currencySymbol}${displaySubtotal.toFixed(2)}</span>
      </div>

      ${showGst ? `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 2px 0; font-size: 10.5px; color: #64748b;">
          <span>CGST ${(Number(data.gstRate || 0) / 2).toFixed(1).replace(/\.0$/, '')}%</span>
          <span style="white-space: nowrap !important; font-variant-numeric: tabular-nums;">${currencySymbol}${(gstAmount / 2).toFixed(2)}</span>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 2px 0; font-size: 10.5px; color: #64748b;">
          <span>SGST ${(Number(data.gstRate || 0) / 2).toFixed(1).replace(/\.0$/, '')}%</span>
          <span style="white-space: nowrap !important; font-variant-numeric: tabular-nums;">${currencySymbol}${(gstAmount / 2).toFixed(2)}</span>
        </div>
        <hr style="border: none; border-top: 1px dashed #cbd5e1; margin: 3px 0;" />
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 2px 0; font-size: 11px; font-weight: 700; color: #334155;">
          <span>Total GST ${Number(data.gstRate || 0).toFixed(2)}%</span>
          <span style="white-space: nowrap !important; font-variant-numeric: tabular-nums; color: ${primaryColor};">${currencySymbol}${gstAmount.toFixed(2)}</span>
        </div>
      ` : ''}

      ${payMethod ? `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 3px 0 1px 0; font-size: 10.5px;">
          <span style="color: #64748b; font-weight: 600;">Payment</span>
          <span style="background: #dcfce7; color: #166534; border: 1px solid #86efac; border-radius: 4px; padding: 1px 6px; font-weight: 800; text-transform: uppercase;">✓ ${escapeHtml(payMethod)}</span>
        </div>
      ` : ''}
    </div>

    <!-- Grand Total Banner -->
    <div style="display: flex; justify-content: space-between; align-items: center; padding: 9px 12px; margin-top: 8px; background: linear-gradient(135deg, ${primaryColor}, #047857); border-radius: 8px; color: #ffffff !important; box-shadow: 0 2px 8px ${primaryColor}35;">
      <span style="font-size: 13px; font-weight: 800; color: #ffffff !important; text-transform: uppercase; letter-spacing: 0.06em;">Grand Total</span>
      <span style="font-size: 16.5px; font-weight: 900; color: #ffffff !important; white-space: nowrap !important; font-variant-numeric: tabular-nums;">${currencySymbol}${totalPrice.toFixed(2)}</span>
    </div>

    <!-- Notes -->
    ${data.notes && data.notes.trim() ? `
    <div style="margin-top: 8px; padding: 5px 8px; border-left: 3px solid ${primaryColor}; background: #f8fafc; font-size: 10.5px; border-radius: 0 4px 4px 0;">
      <div style="font-weight: 700; color: #334155; font-size: 9.5px; text-transform: uppercase;">Note:</div>
      <div style="color: #475569; font-style: italic;">"${escapeHtml(data.notes.trim())}"</div>
    </div>` : ''}

    <!-- Footer -->
    <div style="text-align: center; margin-top: 14px; padding-top: 10px; border-top: 1px dashed #cbd5e1;">
      <p style="font-size: 11.5px; font-weight: 700; color: #334155; margin-bottom: 2px;">Thank you for your visit!</p>
      <p style="font-size: 10px; color: #94a3b8; line-height: 1.4; margin: 0;">We hope you enjoyed your meal.<br />Please visit us again!</p>
      <div style="margin-top: 6px; font-size: 9px; color: #cbd5e1; letter-spacing: 0.05em; text-transform: uppercase;">Powered by QDine</div>
    </div>

  </div>
</body>
</html>`;
}
