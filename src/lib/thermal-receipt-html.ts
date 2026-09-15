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
  ticketNumber: number | string;
  orderType?: string;
  tableNumber?: string;
  customerName?: string;
  phone?: string;
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
 * Uses the EXACT same template and CSS as generateThermalReceiptHtml (KOT),
 * adapted for customer bill output with prices, subtotal, GST, and total.
 * Always prints in colour mode (-webkit-print-color-adjust: exact).
 */
export function generateBillReceiptHtml(data: BillPrintData): string {
  const restaurantName = data.restaurantName || 'QDINE';
  const ticketPadded = `#${String(data.ticketNumber).padStart(3, '0')}`;
  const orderType = (data.orderType || 'DINE_IN').replace(/_/g, '-').toUpperCase();

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

  const currencySymbol = '₹';

  let computedSubtotal = 0;
  const itemsHtml = data.items
    .filter((item) => (item.quantity || 0) > 0)
    .map((item) => {
      const name = (item.product_name || item.name || 'Item').trim();
      const qty = Number(item.quantity) || 1;
      const unitPrice = Number(item.price_at_purchase) || 0;
      const lineTotal = unitPrice * qty;
      computedSubtotal += lineTotal;
      return `
        <div class="item-row">
          <div class="item-name">${escapeHtml(name)}</div>
          <div class="item-price-row">
            <span class="item-qty-price">${qty}&times;&nbsp;${currencySymbol}${unitPrice.toFixed(2)}</span>
            <span class="item-total">${currencySymbol}${lineTotal.toFixed(2)}</span>
          </div>
        </div>
        ${item.notes ? `<div class="item-note">* Note: ${escapeHtml(item.notes)}</div>` : ''}
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
  <title>BILL ${ticketPadded} - ${escapeHtml(restaurantName)}</title>
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
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        color-adjust: exact !important;
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
      color-adjust: exact;
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
      margin: 5px 0 1px 0;
      font-size: 14px;
      font-weight: 800;
    }
    .item-name {
      word-break: break-word;
    }
    .item-price-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 13px;
      font-weight: 700;
      padding-left: 4px;
      color: #222;
    }
    .item-qty-price {
      font-weight: 600;
      font-size: 12px;
      color: #555;
    }
    .item-total {
      font-weight: 900;
      font-size: 13px;
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
    .subtotal-row {
      display: flex;
      justify-content: space-between;
      font-size: 13px;
      font-weight: 700;
      margin-top: 3px;
    }
    .gst-row {
      display: flex;
      justify-content: space-between;
      font-size: 12px;
      font-weight: 600;
      margin-top: 2px;
    }
    .payment-row {
      margin-top: 5px;
      text-align: center;
      font-size: 12px;
      font-weight: 900;
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
    .thank-you {
      text-align: center;
      font-size: 12px;
      font-weight: 900;
      margin-top: 8px;
    }
  </style>
</head>
<body>
  <div class="receipt-container">
    <div class="center">
      <div class="title">${escapeHtml(restaurantName)}</div>
      <div class="subtitle">*** CUSTOMER BILL ***</div>
    </div>

    <div class="counter-banner">
      [ BILL: ${ticketPadded} ]
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
    ${data.phone ? `<div class="meta-row"><span>PHONE: ${escapeHtml(data.phone)}</span></div>` : ''}
    ${data.staffName ? `<div class="meta-row"><span>SERVER: ${escapeHtml(data.staffName)}</span></div>` : ''}

    <div class="divider"></div>
    <div class="header-row">
      <span>ITEM</span>
      <span>AMOUNT</span>
    </div>
    <div class="divider"></div>

    <div class="items-list">
      ${itemsHtml}
    </div>

    <div class="divider"></div>

    <div class="subtotal-row">
      <span>SUBTOTAL:</span>
      <span>${currencySymbol}${displaySubtotal.toFixed(2)}</span>
    </div>

    ${showGst ? `
    <div class="gst-row">
      <span>GST (${Number(data.gstRate || 0).toFixed(0)}%):</span>
      <span>${currencySymbol}${gstAmount.toFixed(2)}</span>
    </div>` : ''}

    <div class="divider"></div>
    <div class="total-row">
      <span>TOTAL:</span>
      <span>${currencySymbol}${totalPrice.toFixed(2)}</span>
    </div>

    ${payMethod ? `
    <div class="divider"></div>
    <div class="payment-row">PAID VIA: ${escapeHtml(payMethod)}</div>` : ''}

    ${data.notes && data.notes.trim()
      ? `
      <div class="notes-box">
        <div class="notes-title">SPECIAL INSTRUCTIONS:</div>
        <div class="notes-content">"${escapeHtml(data.notes.trim())}"</div>
      </div>
      `
      : ''}

    <div class="divider"></div>
    <div class="thank-you">** THANK YOU, VISIT AGAIN! **</div>
    <div class="cut-guide">&nbsp;</div>
  </div>
</body>
</html>`;
}

export function generateModernBillReceiptHtml(data: BillPrintData): string {
  const restaurantName = data.restaurantName || 'QDINE';
  const ticketPadded = `#${String(data.ticketNumber).padStart(3, '0')}`;
  const orderType = (data.orderType || 'DINE_IN').replace(/_/g, ' ');

  const now = data.createdAt ? new Date(data.createdAt) : new Date();
  const dateStr = now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

  const rawTable = data.tableNumber ? String(data.tableNumber).trim() : '';
  const tableDisplay = rawTable
    ? rawTable.toLowerCase().startsWith('table') ? rawTable : `Table ${rawTable}`
    : '';

  const currencySymbol = '₹';

  let subtotal = 0;
  const itemsHtml = data.items
    .filter((item) => (item.quantity || 0) > 0)
    .map((item) => {
      const name = (item.product_name || item.name || 'Item').trim();
      const qty = Number(item.quantity) || 1;
      const unitPrice = Number(item.price_at_purchase) || 0;
      const lineTotal = unitPrice * qty;
      subtotal += lineTotal;
      return `
        <div class="item-row">
          <div class="item-name">${escapeHtml(name)}</div>
          <div class="item-meta">
            <span class="item-qty">${qty} × ${currencySymbol}${unitPrice.toFixed(2)}</span>
            <span class="item-total">${currencySymbol}${lineTotal.toFixed(2)}</span>
          </div>
        </div>
        ${item.notes ? `<div class="item-note">★ ${escapeHtml(item.notes)}</div>` : ''}
      `;
    })
    .join('');

  const displaySubtotal = data.subtotal !== undefined ? Number(data.subtotal) : subtotal;
  const gstAmount = Number(data.gstAmount) || 0;
  const totalPrice = Number(data.totalPrice) || displaySubtotal + gstAmount;
  const showGst = gstAmount > 0 && data.gstType && data.gstType !== 'NONE';
  const payMethod = data.paymentMethod ? data.paymentMethod.toUpperCase() : '';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>BILL ${ticketPadded} - ${escapeHtml(restaurantName)}</title>
  <style>
    @page {
      size: 72mm auto;
      margin: 0;
    }
    @media print {
      html, body {
        width: 72mm !important;
        margin: 0 !important;
        padding: 0 !important;
        background: #fff !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        color-adjust: exact !important;
      }
      .receipt-container {
        width: 68mm !important;
        margin: 0 auto !important;
        padding: 5mm 2mm 18mm 2mm !important;
      }
    }
    html, body {
      background: #f0f0f0;
      font-family: 'Courier New', Courier, monospace;
      color: #111;
      line-height: 1.3;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      color-adjust: exact;
    }
    .receipt-container {
      width: 68mm;
      margin: 16px auto;
      background: #fff;
      padding: 12px 8px 22px 8px;
      box-sizing: border-box;
    }
    .header-section {
      text-align: center;
      border-bottom: 2px solid #1a56db;
      padding-bottom: 8px;
      margin-bottom: 8px;
    }
    .restaurant-name {
      font-size: 18px;
      font-weight: 900;
      letter-spacing: 0.04em;
      color: #1a56db;
      margin: 0 0 2px 0;
    }
    .bill-label {
      font-size: 11px;
      font-weight: 700;
      color: #64748b;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .ticket-banner {
      background: #1a56db;
      color: #fff;
      text-align: center;
      padding: 5px 4px;
      margin: 6px 0;
      border-radius: 4px;
      font-size: 15px;
      font-weight: 900;
      letter-spacing: 0.04em;
    }
    .meta-grid {
      display: flex;
      justify-content: space-between;
      font-size: 11px;
      color: #334155;
      margin: 3px 0;
    }
    .meta-label { color: #64748b; }
    .meta-value { font-weight: 700; }
    .type-badge {
      display: inline-block;
      background: #eff6ff;
      color: #1a56db;
      border: 1px solid #bfdbfe;
      border-radius: 3px;
      padding: 1px 5px;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.04em;
    }
    .section-divider {
      border: none;
      border-top: 1px dashed #94a3b8;
      margin: 7px 0;
    }
    .section-divider-bold {
      border: none;
      border-top: 2px solid #1a56db;
      margin: 7px 0;
    }
    .col-headers {
      display: flex;
      justify-content: space-between;
      font-size: 10px;
      font-weight: 700;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 4px;
    }
    .item-row {
      margin: 5px 0 2px 0;
    }
    .item-name {
      font-size: 12px;
      font-weight: 800;
      color: #0f172a;
      word-break: break-word;
    }
    .item-meta {
      display: flex;
      justify-content: space-between;
      font-size: 11px;
      color: #475569;
      margin-top: 1px;
    }
    .item-qty { }
    .item-total { font-weight: 700; color: #0f172a; }
    .item-note {
      font-size: 10px;
      font-style: italic;
      color: #64748b;
      padding-left: 6px;
      margin-bottom: 3px;
    }
    .totals-section {
      margin-top: 4px;
    }
    .total-row {
      display: flex;
      justify-content: space-between;
      font-size: 12px;
      margin: 3px 0;
    }
    .total-label { color: #475569; }
    .total-value { font-weight: 700; }
    .grand-total-row {
      display: flex;
      justify-content: space-between;
      background: #1a56db;
      color: #fff;
      border-radius: 4px;
      padding: 6px 8px;
      font-size: 14px;
      font-weight: 900;
      margin-top: 6px;
    }
    .payment-badge {
      text-align: center;
      margin-top: 6px;
      font-size: 11px;
      font-weight: 700;
      color: #16a34a;
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      border-radius: 4px;
      padding: 3px 8px;
    }
    .notes-box {
      margin-top: 6px;
      padding: 5px 6px;
      border-left: 3px solid #1a56db;
      background: #eff6ff;
      font-size: 11px;
      border-radius: 0 4px 4px 0;
    }
    .notes-title { font-weight: 900; color: #1e40af; margin-bottom: 2px; font-size: 10px; text-transform: uppercase; }
    .notes-content { font-style: italic; color: #334155; }
    .footer {
      text-align: center;
      margin-top: 12px;
      font-size: 10px;
      color: #94a3b8;
    }
    .footer-thanks {
      font-size: 12px;
      font-weight: 700;
      color: #1a56db;
      margin-bottom: 2px;
    }
  </style>
</head>
<body>
  <div class="receipt-container">

    <div class="header-section">
      <div class="restaurant-name">${escapeHtml(restaurantName)}</div>
      <div class="bill-label">Customer Bill / Receipt</div>
    </div>

    <div class="ticket-banner">
      BILL ${ticketPadded} &nbsp;|&nbsp; <span class="type-badge" style="color:#fff;background:rgba(255,255,255,0.2);border-color:rgba(255,255,255,0.3)">${escapeHtml(orderType)}</span>
    </div>

    <div class="meta-grid">
      <span class="meta-label">Date:</span>
      <span class="meta-value">${dateStr}</span>
    </div>
    <div class="meta-grid">
      <span class="meta-label">Time:</span>
      <span class="meta-value">${timeStr}</span>
    </div>
    ${tableDisplay ? `<div class="meta-grid"><span class="meta-label">Table:</span><span class="meta-value">${escapeHtml(tableDisplay)}</span></div>` : ''}
    ${data.customerName && data.customerName !== 'Guest' ? `<div class="meta-grid"><span class="meta-label">Customer:</span><span class="meta-value">${escapeHtml(data.customerName)}</span></div>` : ''}
    ${data.phone ? `<div class="meta-grid"><span class="meta-label">Phone:</span><span class="meta-value">${escapeHtml(data.phone)}</span></div>` : ''}
    ${data.staffName ? `<div class="meta-grid"><span class="meta-label">Served by:</span><span class="meta-value">${escapeHtml(data.staffName)}</span></div>` : ''}

    <hr class="section-divider-bold">

    <div class="col-headers">
      <span>Item</span>
      <span>Amt</span>
    </div>

    <div class="items-list">
      ${itemsHtml}
    </div>

    <hr class="section-divider">

    <div class="totals-section">
      <div class="total-row">
        <span class="total-label">Subtotal</span>
        <span class="total-value">${currencySymbol}${displaySubtotal.toFixed(2)}</span>
      </div>
      ${showGst ? `
      <div class="total-row">
        <span class="total-label">GST (${Number(data.gstRate || 0).toFixed(0)}%)</span>
        <span class="total-value">${currencySymbol}${gstAmount.toFixed(2)}</span>
      </div>` : ''}
      <div class="grand-total-row">
        <span>TOTAL</span>
        <span>${currencySymbol}${totalPrice.toFixed(2)}</span>
      </div>
    </div>

    ${payMethod ? `<div class="payment-badge">✓ Paid via ${escapeHtml(payMethod)}</div>` : ''}

    ${data.notes && data.notes.trim() ? `
    <div class="notes-box">
      <div class="notes-title">Note</div>
      <div class="notes-content">"${escapeHtml(data.notes.trim())}"</div>
    </div>` : ''}

    <div class="footer">
      <div class="footer-thanks">Thank You! Visit Again 🙏</div>
      <div>Powered by QDine</div>
    </div>

    <div style="border-top:1px solid #e2e8f0;margin-top:18px;padding-top:8px;text-align:center;font-size:9px;color:#cbd5e1">&nbsp;</div>
  </div>
</body>
</html>`;
}
