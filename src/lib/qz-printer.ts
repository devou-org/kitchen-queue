/**
 * QZ Tray Integration Driver for QDine Kitchen Queue & POS
 * ============================================================
 * Provides direct, silent, raw ESC/POS printing to any Windows,
 * macOS, or Linux printer via local QZ Tray WebSocket.
 */

import qz from 'qz-tray';

export interface QzConnectionState {
  connected: boolean;
  version: string | null;
  printers: string[];
  error: string | null;
}

let isConnecting = false;

/**
 * Check if the current environment can support QZ Tray (client-side only)
 */
export function isQzSupported(): boolean {
  return typeof window !== 'undefined';
}

/**
 * Check if QZ Tray WebSocket connection is currently active
 */
export function isQzConnected(): boolean {
  if (!isQzSupported()) return false;
  try {
    return qz.websocket.isActive();
  } catch {
    return false;
  }
}

/**
 * Get current connected QZ Tray version if available
 */
export function getQzVersion(): string {
  try {
    return (qz as any).version || (qz.api && typeof (qz.api as any).getVersion === 'function' ? (qz.api as any).getVersion() : '2.2');
  } catch {
    return '2.2';
  }
}

/**
 * Connect to local QZ Tray instance (wss://localhost:8182 or ws://localhost:8181)
 */
export async function connectQzTray(retries = 1): Promise<{ success: boolean; version?: string; error?: string }> {
  if (!isQzSupported()) {
    return { success: false, error: 'QZ Tray is only supported in browser environments' };
  }

  if (qz.websocket.isActive()) {
    return { success: true, version: getQzVersion() };
  }

  if (isConnecting) {
    await new Promise(r => setTimeout(r, 600));
    if (qz.websocket.isActive()) {
      return { success: true, version: getQzVersion() };
    }
  }

  isConnecting = true;
  try {
    await qz.websocket.connect({
      retries,
      delay: 1,
    });

    return {
      success: true,
      version: getQzVersion(),
    };
  } catch (err: any) {
    const msg = err.message || 'Unable to connect to local QZ Tray';
    return {
      success: false,
      error: msg.includes('WebSocket') || msg.includes('Failed to fetch')
        ? 'QZ Tray is not running on this PC. Please launch QZ Tray.'
        : msg,
    };
  } finally {
    isConnecting = false;
  }
}

/**
 * Disconnect from QZ Tray WebSocket
 */
export async function disconnectQzTray(): Promise<void> {
  if (!isQzSupported()) return;
  try {
    if (qz.websocket.isActive()) {
      await qz.websocket.disconnect();
    }
  } catch {}
}

/**
 * Discover all OS-level printers recognized by the system spooler
 */
export async function getQzPrinters(): Promise<{ success: boolean; printers: string[]; error?: string }> {
  const conn = await connectQzTray();
  if (!conn.success) {
    return { success: false, printers: [], error: conn.error };
  }

  try {
    const list = await qz.printers.find();
    const printers = Array.isArray(list) ? list : [list].filter(Boolean);
    return { success: true, printers };
  } catch (err: any) {
    return { success: false, printers: [], error: err.message || 'Failed to list printers' };
  }
}

/**
 * Print raw base64 ESC/POS buffer directly to target printer name via QZ Tray
 */
export async function printRawEscposViaQz(
  printerName: string,
  base64Bytes: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  if (!printerName?.trim()) {
    return { success: false, error: 'Printer name is required for QZ Tray' };
  }

  if (!base64Bytes) {
    return { success: false, error: 'No print data provided' };
  }

  const conn = await connectQzTray();
  if (!conn.success) {
    return { success: false, error: conn.error || 'QZ Tray connection failed' };
  }

  try {
    const targetPrinter = printerName.trim();
    
    // Create raw print config
    const config = qz.configs.create(targetPrinter, {
      spool: {
        size: null,
      },
    } as any);

    const data: qz.PrintData[] = [
      {
        type: 'raw' as const,
        format: 'command' as const,
        flavor: 'base64' as const,
        data: base64Bytes,
      },
    ];

    await qz.print(config, data);

    return {
      success: true,
      message: `Printed raw ticket to "${targetPrinter}" via QZ Tray`,
    };
  } catch (err: any) {
    console.error('QZ Tray print failed:', err);
    return {
      success: false,
      error: err.message || 'QZ Tray failed to print raw buffer',
    };
  }
}
