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

