import { KotPrintData } from './escpos';
import { generateThermalReceiptHtml } from './thermal-receipt-html';

export interface ClientPrintOptions {
  kotData: KotPrintData;
  base64Bytes?: string;
  printerName?: string;
  localBridgeUrl?: string; // default http://127.0.0.1:9123/print
}

/**
 * Print KOT thermal ticket from the client browser.
 * 1. Attempts to send raw ESC/POS bytes to a local printer bridge (if running on cashier PC for 1-click silent print).
 * 2. If no local bridge is running, prints directly via browser thermal print iframe targeting 80mm roll.
 */
export async function printKotFromBrowser(options: ClientPrintOptions): Promise<{ success: boolean; method: 'bridge' | 'browser'; message?: string }> {
  const { kotData, base64Bytes, printerName = 'POS-80C', localBridgeUrl = 'http://127.0.0.1:9123/print' } = options;

  // 1. Try local hardware bridge first (for instant silent ESC/POS print if the user runs the local bridge on Windows)
  if (base64Bytes) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1200);

      const res = await fetch(localBridgeUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          printerName,
          base64Bytes,
          docName: `KOT #${kotData.ticketNumber} - ${kotData.counterName || 'ALL'}`,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          return {
            success: true,
            method: 'bridge',
            message: `KOT sent directly to ${printerName} via local bridge!`,
          };
        }
      }
    } catch {
      // Local bridge not running, seamlessly fall back to browser thermal print
    }
  }

  // 2. Direct browser 80mm thermal print via hidden iframe
  return new Promise((resolve) => {
    try {
      const html = generateThermalReceiptHtml(kotData);

      // Create an invisible iframe for printing
      const iframeId = 'kot-print-iframe';
      let iframe = document.getElementById(iframeId) as HTMLIFrameElement;
      if (!iframe) {
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
      }

      const doc = iframe.contentWindow?.document;
      if (!doc) {
        throw new Error('Unable to access print frame');
      }

      doc.open();
      doc.write(html);
      doc.close();

      iframe.onload = () => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
          resolve({
            success: true,
            method: 'browser',
            message: `KOT opened for ${printerName}`,
          });
        } catch {
          resolve({
            success: true,
            method: 'browser',
          });
        }
      };

      // Fallback timeout in case onload doesn't trigger
      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
          resolve({
            success: true,
            method: 'browser',
          });
        } catch {
          // Handled
        }
      }, 500);
    } catch (err: any) {
      resolve({
        success: false,
        method: 'browser',
        message: err.message || 'Failed to trigger print dialog',
      });
    }
  });
}

