import { KotPrintData } from './escpos';
import { printUnifiedThermalTicket } from './hardware-printer';

export interface ClientPrintOptions {
  kotData: KotPrintData;
  base64Bytes?: string;
  printerName?: string;
  localBridgeUrl?: string; // fallback if local bridge is running
}

/**
 * Print KOT thermal ticket from the client browser.
 * 1. Direct Web Bluetooth (if paired)
 * 2. Direct Web Serial / USB (if connected)
 * 3. Local bridge endpoint (if active)
 * 4. 80mm hidden iframe thermal print (Compatible with Chrome Kiosk mode)
 */
export async function printKotFromBrowser(options: ClientPrintOptions): Promise<{
  success: boolean;
  method: 'bluetooth' | 'serial' | 'bridge' | 'browser';
  message?: string;
}> {
  const { kotData, base64Bytes, printerName = 'POS-80C', localBridgeUrl = 'http://127.0.0.1:9123/print' } = options;

  // 1. Try Direct Hardware (Bluetooth or USB Serial)
  const hardwareResult = await printUnifiedThermalTicket({
    kotData,
    base64Bytes,
    printerName,
  });

  if (hardwareResult.method === 'bluetooth' || hardwareResult.method === 'serial') {
    return {
      success: true,
      method: hardwareResult.method,
      message: hardwareResult.message,
    };
  }

  // 2. Try local bridge if bytes available
  if (base64Bytes) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 800);

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
            message: `KOT sent to ${printerName} via local bridge!`,
          };
        }
      }
    } catch {
      // Local bridge not running, fallback to browser thermal print
    }
  }

  return {
    success: hardwareResult.success,
    method: 'browser',
    message: hardwareResult.message,
  };
}
