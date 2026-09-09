import path from 'path';
import { spawn } from 'child_process';

/**
 * Standard ESC/POS commands
 */
const ESC = 0x1b;
const GS = 0x1d;

export const ESCPOS = {
  INIT: Buffer.from([ESC, 0x40]),
  ALIGN_LEFT: Buffer.from([ESC, 0x61, 0x00]),
  ALIGN_CENTER: Buffer.from([ESC, 0x61, 0x01]),
  ALIGN_RIGHT: Buffer.from([ESC, 0x61, 0x02]),
  BOLD_ON: Buffer.from([ESC, 0x45, 0x01]),
  BOLD_OFF: Buffer.from([ESC, 0x45, 0x00]),
  TEXT_NORMAL: Buffer.from([GS, 0x21, 0x00]),
  TEXT_DOUBLE_HEIGHT: Buffer.from([GS, 0x21, 0x01]),
  TEXT_DOUBLE_WIDTH: Buffer.from([GS, 0x21, 0x10]),
  TEXT_DOUBLE_SIZE: Buffer.from([GS, 0x21, 0x11]),
  FEED_LINES: (n: number) => Buffer.from([ESC, 0x64, Math.max(1, Math.min(n, 10))]),
  PAPER_CUT_FULL: Buffer.from([GS, 0x56, 0x00]),
  PAPER_CUT_PARTIAL: Buffer.from([GS, 0x56, 0x01]),
};

const LINE_WIDTH = 42; // Standard 80mm thermal receipt line length

function padTwoCols(left: string, right: string, width = LINE_WIDTH): string {
  const leftStr = left || '';
  const rightStr = right || '';
  const spaceNeeded = width - leftStr.length - rightStr.length;
  if (spaceNeeded >= 1) {
    return leftStr + ' '.repeat(spaceNeeded) + rightStr;
  }
  // If left string is too long, wrap it
  const maxLeft = Math.max(1, width - rightStr.length - 1);
  const truncatedLeft = leftStr.slice(0, maxLeft);
  return truncatedLeft + ' ' + rightStr;
}

export interface KotPrintItem {
  name?: string;
  product_name?: string;
  quantity: number;
  counter?: string;
  notes?: string;
}

export interface KotPrintData {
  restaurantName?: string;
  ticketNumber: number | string;
  orderType?: string;
  tableNumber?: string;
  customerName?: string;
  phone?: string;
  staffName?: string;
  createdAt?: string | Date;
  counterName?: string;
  items: KotPrintItem[];
  notes?: string;
}

/**
 * Format and build raw ESC/POS byte buffer for a Kitchen Order Ticket (KOT)
 */
export function buildKotEscposBuffer(data: KotPrintData): Buffer {
  const parts: Buffer[] = [];

  const addRaw = (b: Buffer) => parts.push(b);
  const addText = (text: string) => parts.push(Buffer.from(text, 'utf-8'));
  const addLine = (text: string) => addText(text + '\n');

  // 1. Initialize printer
  addRaw(ESCPOS.INIT);

  // 2. Header
  addRaw(ESCPOS.ALIGN_CENTER);
  addRaw(ESCPOS.BOLD_ON);
  addRaw(ESCPOS.TEXT_DOUBLE_SIZE);
  addLine(data.restaurantName || 'QDINE');

  addRaw(ESCPOS.TEXT_NORMAL);
  addRaw(ESCPOS.BOLD_ON);
  addLine('*** KITCHEN ORDER TICKET ***');
  addRaw(ESCPOS.BOLD_OFF);

  // 3. Counter Banner (Prominent)
  const counterTitle = (data.counterName || 'ALL COUNTERS').toUpperCase();
  addLine('==========================================');
  addRaw(ESCPOS.BOLD_ON);
  addRaw(ESCPOS.TEXT_DOUBLE_HEIGHT);
  addLine(`[ COUNTER: ${counterTitle} ]`);
  addRaw(ESCPOS.TEXT_NORMAL);
  addRaw(ESCPOS.BOLD_OFF);
  addLine('==========================================');

  // 4. Ticket and Order Metadata
  addRaw(ESCPOS.ALIGN_LEFT);
  const ticketPadded = `#${String(data.ticketNumber).padStart(3, '0')}`;
  const orderType = (data.orderType || 'DINE_IN').replace('_', '-').toUpperCase();

  addRaw(ESCPOS.BOLD_ON);
  addLine(padTwoCols(`TICKET: ${ticketPadded}`, `TYPE: ${orderType}`));
  addRaw(ESCPOS.BOLD_OFF);

  if (data.tableNumber) {
    const rawTable = String(data.tableNumber).trim();
    const tableDisplay = rawTable.toLowerCase().startsWith('table') ? rawTable : `Table ${rawTable}`;
    addRaw(ESCPOS.BOLD_ON);
    addLine(`TABLE: ${tableDisplay}`);
    addRaw(ESCPOS.BOLD_OFF);
  }

  // Format date
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
  addLine(padTwoCols(`DATE: ${dateStr}`, timeStr));

  if (data.customerName && data.customerName !== 'Guest') {
    addLine(`CUSTOMER: ${data.customerName}`);
  }
  if (data.staffName) {
    addLine(`SERVER: ${data.staffName}`);
  }

  // 5. Items Section
  addLine('------------------------------------------');
  addRaw(ESCPOS.BOLD_ON);
  addLine(padTwoCols('ITEM', 'QTY'));
  addRaw(ESCPOS.BOLD_OFF);
  addLine('------------------------------------------');

  let totalQty = 0;
  for (const item of data.items) {
    const itemName = (item.product_name || item.name || 'Item').trim();
    const qty = Number(item.quantity) || 1;
    totalQty += qty;

    addRaw(ESCPOS.BOLD_ON);
    addLine(padTwoCols(itemName, `x ${qty}`));
    addRaw(ESCPOS.BOLD_OFF);

    if (item.notes) {
      addLine(`  * Note: ${item.notes}`);
    }
  }

  addLine('------------------------------------------');
  addRaw(ESCPOS.BOLD_ON);
  addLine(padTwoCols('TOTAL ITEMS:', String(totalQty)));
  addRaw(ESCPOS.BOLD_OFF);

  // 6. Special Instructions (Order level notes)
  if (data.notes && data.notes.trim()) {
    addLine('------------------------------------------');
    addRaw(ESCPOS.BOLD_ON);
    addLine('SPECIAL INSTRUCTIONS:');
    addRaw(ESCPOS.BOLD_OFF);
    addLine(`"${data.notes.trim()}"`);
  }

  addLine('==========================================');

  // 7. Feed lines and cut paper
  addRaw(ESCPOS.FEED_LINES(4));
  addRaw(ESCPOS.PAPER_CUT_FULL);

  return Buffer.concat(parts);
}

/**
 * Send raw ESC/POS bytes directly to Windows Thermal Printer via winspool.drv PowerShell script
 */
export async function sendRawPrintToWindowsPrinter(
  printerName: string,
  bytes: Buffer,
  docName = 'QDINE KOT'
): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolve) => {
    try {
      const scriptPath = path.resolve(process.cwd(), 'scripts', 'print-kot.ps1');
      const base64Bytes = bytes.toString('base64');

      const args = [
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        scriptPath,
        '-PrinterName',
        printerName,
        '-Base64Bytes',
        base64Bytes,
        '-DocName',
        docName,
      ];

      const ps = spawn('powershell.exe', args, {
        windowsHide: true,
      });

      let stdout = '';
      let stderr = '';

      ps.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      ps.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      ps.on('close', (code) => {
        if (code !== 0 && !stdout.trim()) {
          resolve({
            success: false,
            error: stderr.trim() || `PowerShell exited with code ${code}`,
          });
          return;
        }

        try {
          const lines = stdout.trim().split(/\r?\n/).filter(Boolean);
          const lastJsonLine = lines[lines.length - 1];
          const parsed = JSON.parse(lastJsonLine);
          resolve(parsed);
        } catch (e: any) {
          if (stdout.includes('"success":true')) {
            resolve({ success: true });
          } else {
            resolve({
              success: false,
              error: stdout.trim() || stderr.trim() || 'Unknown printing error',
            });
          }
        }
      });

      ps.on('error', (err) => {
        resolve({
          success: false,
          error: `Failed to launch PowerShell: ${err.message}`,
        });
      });
    } catch (err: any) {
      resolve({
        success: false,
        error: err.message || 'Error initiating print job',
      });
    }
  });
}

