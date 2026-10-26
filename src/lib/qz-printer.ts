/**
 * QZ Tray Integration Driver for QDine Kitchen Queue & POS
 * ============================================================
 * Provides direct, silent, raw ESC/POS printing to any Windows,
 * macOS, or Linux printer via local QZ Tray WebSocket.
 * Supports:
 * - USB / Spooler Printers (e.g., "POS-80C", "POS-80C (copy 1)")
 * - Network (Wi-Fi / LAN) Printers (e.g., "192.168.1.100:9100")
 * ============================================================
 */

import qz from 'qz-tray';
import * as qzLna from 'qz-lna';

// Register LNA helper on browser globals so QZ Tray's getLna() detects it directly
if (typeof window !== 'undefined') {
  (window as any).lna = qzLna;
}
if (typeof globalThis !== 'undefined') {
  (globalThis as any).lna = qzLna;
}

export interface QzConnectionState {
  connected: boolean;
  version: string | null;
  printers: string[];
  error: string | null;
}

let isConnecting = false;
let securityConfigured = false;

/**
 * Configure digital certificate & signature handling for silent printing
 */
export function setupQzSecurity(): void {
  if (securityConfigured || typeof window === 'undefined') return;
  try {
    // Set certificate promise to fetch public certificate
    qz.security.setCertificatePromise((resolve) => {
      fetch('/api/print/qz-cert')
        .then((res) => {
          if (!res.ok) throw new Error('No certificate configured');
          return res.text();
        })
        .then(resolve)
        .catch(() => resolve('')); // Fallback gracefully if no cert uploaded yet
    });

    // Set signature algorithm and promise
    qz.security.setSignatureAlgorithm('SHA512');
    qz.security.setSignaturePromise((toSign: string) => {
      return (resolve, reject) => {
        fetch('/api/print/qz-sign', {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain' },
          body: toSign,
        })
          .then((res) => {
            if (!res.ok) throw new Error('Signing failed');
            return res.text();
          })
          .then(resolve)
          .catch(reject);
      };
    });

    securityConfigured = true;
  } catch (secErr) {
    console.warn('Failed to configure QZ Tray security signing:', secErr);
  }
}

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

  // Setup security signing handlers
  setupQzSecurity();

  if (qz.websocket.isActive()) {
    return { success: true, version: getQzVersion() };
  }

  if (isConnecting) {
    await new Promise((r) => setTimeout(r, 600));
    if (qz.websocket.isActive()) {
      return { success: true, version: getQzVersion() };
    }
  }

  isConnecting = true;
  try {
    if (typeof window !== 'undefined') {
      (window as any).lna = qzLna;
    }

    await qz.websocket.connect({
      retries,
      delay: 1,
    });

    return {
      success: true,
      version: getQzVersion(),
    };
  } catch (err: any) {
    const msg = err?.message || 'Unable to connect to local QZ Tray';
    const isOffline =
      msg.includes('WebSocket') ||
      msg.includes('Failed to fetch') ||
      msg.includes('Unable to establish connection') ||
      msg.includes('Connection attempt denied') ||
      msg.includes('ECONNREFUSED');

    return {
      success: false,
      error: isOffline
        ? 'QZ Tray is not running locally. Please launch QZ Tray on this PC.'
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
 * Print raw base64 ESC/POS buffer directly to target printer name or IP/host via QZ Tray
 */
export async function printRawEscposViaQz(
  printerTarget: string | { host: string; port?: number },
  base64Bytes: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  if (!printerTarget) {
    return { success: false, error: 'Printer target is required for QZ Tray' };
  }

  if (!base64Bytes) {
    return { success: false, error: 'No print data provided' };
  }

  const conn = await connectQzTray();
  if (!conn.success) {
    return { success: false, error: conn.error || 'QZ Tray connection failed' };
  }

  try {
    let targetConfig: any;
    let label = '';

    if (typeof printerTarget === 'object' && printerTarget?.host) {
      targetConfig = {
        host: printerTarget.host.trim(),
        port: printerTarget.port || 9100,
      };
      label = `${targetConfig.host}:${targetConfig.port}`;
    } else {
      const str = String(printerTarget).trim();
      // Check if string is an IP address format: "192.168.1.100" or "192.168.1.100:9100"
      const ipMatch = str.match(/^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})(?::(\d+))?$/);
      if (ipMatch) {
        targetConfig = {
          host: ipMatch[1],
          port: ipMatch[2] ? parseInt(ipMatch[2], 10) : 9100,
        };
        label = `${targetConfig.host}:${targetConfig.port}`;
      } else {
        // String printer name - smart lookup to handle "POS-80C (copy 1)" or similar variations
        let matchedName = str;
        try {
          const found = await qz.printers.find(str);
          if (found) {
            matchedName = Array.isArray(found) ? found[0] : found;
          }
        } catch {
          // If direct find failed, search all printers for best case-insensitive match
          try {
            const allList = await qz.printers.find();
            const list = Array.isArray(allList) ? allList : [allList].filter(Boolean);
            const lowerStr = str.toLowerCase();
            const foundMatch = list.find(
              (p: string) =>
                p.toLowerCase() === lowerStr ||
                p.toLowerCase().includes(lowerStr) ||
                lowerStr.includes(p.toLowerCase())
            );
            if (foundMatch) {
              matchedName = foundMatch;
            }
          } catch {}
        }

        targetConfig = matchedName;
        label = matchedName;
      }
    }

    // Create raw print config
    const config = qz.configs.create(targetConfig, {
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
      message: `Printed raw ticket to "${label}" via QZ Tray`,
    };
  } catch (err: any) {
    console.error('QZ Tray print failed:', err);
    return {
      success: false,
      error: err.message || 'QZ Tray failed to print raw buffer',
    };
  }
}
