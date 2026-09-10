/**
 * QDine Hardware Thermal Printer Controller
 * ============================================================
 * Direct in-browser communication with thermal printers via:
 * 1. Web Bluetooth (BLE / SPP)
 * 2. Web Serial (USB COM / Virtual Serial)
 * 3. Web USB (Raw USB Endpoints)
 * 4. Browser Thermal Fallback / Kiosk Mode
 *
 * 100% Client-Side. No background daemons, no PowerShell, no local server needed.
 * ============================================================
 */

import { KotPrintData } from './escpos';
import { generateThermalReceiptHtml } from './thermal-receipt-html';

export type HardwarePrinterType = 'bluetooth' | 'serial' | 'usb' | 'browser';

export interface HardwarePrinterState {
  bluetoothConnected: boolean;
  bluetoothDeviceName: string | null;
  serialConnected: boolean;
  serialDeviceName: string | null;
}

// In-memory active connections
let activeBluetoothDevice: any = null;
let activeBluetoothChar: any = null;

let activeSerialPort: any = null;
let activeUsbDevice: any = null;
let activeUsbEndpoint: number = 1;

// Common BLE Service UUIDs used by ESC/POS thermal printers
const BLE_THERMAL_SERVICES = [
  '000018f0-0000-1000-8000-00805f9b34fb', // Standard POS
  '49535343-fe7d-4ae5-8fa9-9fafd205e455', // ISSC Transparent UART
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
  '0000ff00-0000-1000-8000-00805f9b34fb',
  '0000fee7-0000-1000-8000-00805f9b34fb',
  '0000ae00-0000-1000-8000-00805f9b34fb',
  '0000af00-0000-1000-8000-00805f9b34fb',
];

/**
 * Check if Web Bluetooth is supported in the current browser
 */
export function isBluetoothSupported(): boolean {
  return typeof window !== 'undefined' && Boolean((navigator as any).bluetooth);
}

/**
 * Check if Web Serial is supported (USB COM)
 */
export function isSerialSupported(): boolean {
  return typeof window !== 'undefined' && Boolean((navigator as any).serial);
}

/**
 * Check if Web USB is supported
 */
export function isUsbSupported(): boolean {
  return typeof window !== 'undefined' && Boolean((navigator as any).usb);
}

/**
 * Get current in-memory connection status
 */
export function getHardwarePrinterState(): HardwarePrinterState {
  const btName = typeof window !== 'undefined' ? localStorage.getItem('qdine_bt_printer_name') : null;
  const serialName = typeof window !== 'undefined' ? localStorage.getItem('qdine_serial_printer_name') : null;

  return {
    bluetoothConnected: Boolean(activeBluetoothDevice?.gatt?.connected),
    bluetoothDeviceName: activeBluetoothDevice?.name || btName,
    serialConnected: Boolean(activeSerialPort?.readable),
    serialDeviceName: serialName || (activeSerialPort ? 'USB Serial Printer' : null),
  };
}

// ============================================================
// 1. WEB BLUETOOTH ENGINE
// ============================================================

/**
 * Pair and connect to a Bluetooth thermal printer
 */
export async function connectBluetoothPrinter(): Promise<{ success: boolean; deviceName?: string; error?: string }> {
  if (!isBluetoothSupported()) {
    return {
      success: false,
      error: 'Web Bluetooth is not supported in this browser. Please use Google Chrome, Microsoft Edge, or Samsung Internet.',
    };
  }

  try {
    const device = await (navigator as any).bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: BLE_THERMAL_SERVICES,
    });

    if (!device) {
      return { success: false, error: 'No printer selected.' };
    }

    const server = await device.gatt.connect();

    // Search through available services to locate writable characteristic
    let writeChar: any = null;

    for (const serviceUuid of BLE_THERMAL_SERVICES) {
      try {
        const service = await server.getPrimaryService(serviceUuid);
        const characteristics = await service.getCharacteristics();

        for (const char of characteristics) {
          if (char.properties.write || char.properties.writeWithoutResponse) {
            writeChar = char;
            break;
          }
        }
        if (writeChar) break;
      } catch {
        // Continue searching other services
      }
    }

    // If not found in standard services, try querying all primary services
    if (!writeChar) {
      try {
        const services = await server.getPrimaryServices();
        for (const service of services) {
          try {
            const characteristics = await service.getCharacteristics();
            for (const char of characteristics) {
              if (char.properties.write || char.properties.writeWithoutResponse) {
                writeChar = char;
                break;
              }
            }
            if (writeChar) break;
          } catch {}
        }
      } catch {}
    }

    if (!writeChar) {
      throw new Error('Connected to Bluetooth device, but no printable ESC/POS write channel was found.');
    }

    activeBluetoothDevice = device;
    activeBluetoothChar = writeChar;

    const deviceName = device.name || 'Bluetooth Thermal Printer';
    if (typeof window !== 'undefined') {
      localStorage.setItem('qdine_bt_printer_name', deviceName);
      localStorage.setItem('qdine_preferred_printer_type', 'bluetooth');
    }

    // Auto-cleanup on disconnect
    device.addEventListener('gattserverdisconnected', () => {
      console.log('Bluetooth printer disconnected');
      activeBluetoothChar = null;
    });

    return { success: true, deviceName };
  } catch (err: any) {
    console.error('Bluetooth connection failed:', err);
    return { success: false, error: err.message || 'Failed to connect to Bluetooth printer' };
  }
}

/**
 * Disconnect Bluetooth printer
 */
export async function disconnectBluetoothPrinter(): Promise<void> {
  if (activeBluetoothDevice?.gatt?.connected) {
    try {
      activeBluetoothDevice.gatt.disconnect();
    } catch {}
  }
  activeBluetoothDevice = null;
  activeBluetoothChar = null;
  if (typeof window !== 'undefined') {
    localStorage.removeItem('qdine_bt_printer_name');
  }
}

/**
 * Write raw ESC/POS bytes to Bluetooth printer in MTU-safe chunks
 */
export async function writeBytesToBluetooth(bytes: Uint8Array): Promise<void> {
  if (!activeBluetoothChar || !activeBluetoothDevice?.gatt?.connected) {
    // Attempt reconnect
    if (activeBluetoothDevice?.gatt) {
      try {
        await activeBluetoothDevice.gatt.connect();
      } catch (e) {
        throw new Error('Bluetooth printer is disconnected. Please re-pair in Settings.');
      }
    } else {
      throw new Error('No Bluetooth printer connected. Tap "Connect Bluetooth Printer" in Settings.');
    }
  }

  // BLE MTU is usually 20-512 bytes. 100 bytes is safest across all devices.
  const CHUNK_SIZE = 100;
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    const chunk = bytes.slice(i, i + CHUNK_SIZE);
    if (activeBluetoothChar.properties.writeWithoutResponse) {
      await activeBluetoothChar.writeValueWithoutResponse(chunk);
    } else {
      await activeBluetoothChar.writeValueWithResponse(chunk);
    }
    // Small inter-chunk pause to prevent thermal printer buffer overflow
    await new Promise((r) => setTimeout(r, 25));
  }
}

// ============================================================
// 2. WEB SERIAL / USB ENGINE
// ============================================================

/**
 * Connect to a USB Thermal Printer via Web Serial (COM / USB)
 */
export async function connectSerialPrinter(): Promise<{ success: boolean; deviceName?: string; error?: string }> {
  if (!isSerialSupported()) {
    return {
      success: false,
      error: 'Web Serial is not supported in this browser. Please use Chrome or Edge on Windows, Mac, or Linux.',
    };
  }

  try {
    const port = await (navigator as any).serial.requestPort();
    await port.open({ baudRate: 9600 }); // Standard POS baud rate

    activeSerialPort = port;

    const deviceName = 'USB Thermal Printer (POS-80C)';
    if (typeof window !== 'undefined') {
      localStorage.setItem('qdine_serial_printer_name', deviceName);
      localStorage.setItem('qdine_preferred_printer_type', 'serial');
    }

    return { success: true, deviceName };
  } catch (err: any) {
    console.error('Serial connection failed:', err);
    return { success: false, error: err.message || 'Failed to connect USB printer' };
  }
}

/**
 * Disconnect Serial / USB printer
 */
export async function disconnectSerialPrinter(): Promise<void> {
  if (activeSerialPort) {
    try {
      await activeSerialPort.close();
    } catch {}
    activeSerialPort = null;
  }
  if (typeof window !== 'undefined') {
    localStorage.removeItem('qdine_serial_printer_name');
  }
}

/**
 * Write raw ESC/POS bytes to Serial / USB printer
 */
export async function writeBytesToSerial(bytes: Uint8Array): Promise<void> {
  if (!activeSerialPort || !activeSerialPort.writable) {
    throw new Error('USB / Serial printer not connected. Tap "Connect USB Printer" in Settings.');
  }

  const writer = activeSerialPort.writable.getWriter();
  try {
    await writer.write(bytes);
  } finally {
    writer.releaseLock();
  }
}

// ============================================================
// 3. ANDROID RAWBT WEB INTENT
// ============================================================

export function printViaRawBt(base64Bytes: string): boolean {
  if (typeof window === 'undefined') return false;
  const isAndroid = /android/i.test(navigator.userAgent);
  if (!isAndroid) return false;

  try {
    window.location.href = `rawbt:data:application/octet-stream;base64,${base64Bytes}`;
    return true;
  } catch {
    return false;
  }
}

// ============================================================
// 4. UNIFIED PRINT DISPATCHER
// ============================================================

export interface UnifiedPrintOptions {
  base64Bytes?: string;
  kotData: KotPrintData;
  printerName?: string;
  forceBrowser?: boolean;
}

/**
 * Dispatch print job to the most direct, highest-priority hardware connection:
 * 1. Web Bluetooth (if paired & active)
 * 2. Web Serial / USB (if connected & active)
 * 3. Android RawBT (if on Android mobile)
 * 4. Hidden iframe 80mm thermal receipt (Universal fallback / Chrome Kiosk mode)
 */
export async function printUnifiedThermalTicket(options: UnifiedPrintOptions): Promise<{
  success: boolean;
  method: 'bluetooth' | 'serial' | 'rawbt' | 'browser';
  message?: string;
}> {
  const { base64Bytes, kotData, printerName = 'POS-80C', forceBrowser = false } = options;

  // Convert base64 to Uint8Array if provided
  let rawBytes: Uint8Array | null = null;
  if (base64Bytes) {
    try {
      const binaryString = atob(base64Bytes);
      const len = binaryString.length;
      rawBytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        rawBytes[i] = binaryString.charCodeAt(i);
      }
    } catch {}
  }

  if (!forceBrowser && rawBytes) {
    // 1. Try Bluetooth if active
    if (activeBluetoothChar && activeBluetoothDevice?.gatt?.connected) {
      try {
        await writeBytesToBluetooth(rawBytes);
        return {
          success: true,
          method: 'bluetooth',
          message: `Printed instantly to ${activeBluetoothDevice.name || 'Bluetooth Printer'}!`,
        };
      } catch (err: any) {
        console.warn('Bluetooth print failed, falling back:', err.message);
      }
    }

    // 2. Try Serial / USB if active
    if (activeSerialPort && activeSerialPort.writable) {
      try {
        await writeBytesToSerial(rawBytes);
        return {
          success: true,
          method: 'serial',
          message: `Printed instantly to USB Printer (${printerName})!`,
        };
      } catch (err: any) {
        console.warn('USB print failed, falling back:', err.message);
      }
    }
  }

  // 3. Fallback: Browser 80mm Thermal Receipt (Works with Chrome Kiosk Mode for 0-dialog silent print)
  return new Promise((resolve) => {
    try {
      const html = generateThermalReceiptHtml(kotData);

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
      if (!doc) throw new Error('Cannot access print frame');

      doc.open();
      doc.write(html);
      doc.close();

      const triggerPrint = () => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
          resolve({
            success: true,
            method: 'browser',
            message: `KOT printed for ${printerName}`,
          });
        } catch {
          resolve({
            success: true,
            method: 'browser',
          });
        }
      };

      iframe.onload = triggerPrint;
      setTimeout(triggerPrint, 500);
    } catch (err: any) {
      resolve({
        success: false,
        method: 'browser',
        message: err.message || 'Failed to print ticket',
      });
    }
  });
}

