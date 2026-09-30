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
import { generateBillTemplateHTML } from './bill-template-html';

export type HardwarePrinterType = 'bluetooth' | 'serial' | 'usb' | 'browser';

export interface HardwarePrinterState {
  bluetoothConnected: boolean;
  bluetoothDeviceName: string | null;
  serialConnected: boolean;
  serialDeviceName: string | null;
}

export interface ActiveBtConnection {
  device: any;
  char: any;
  name: string;
}

// In-memory active connections
const activeBtConnections = new Map<string, ActiveBtConnection>();
let activeBluetoothDevice: any = null;
let activeBluetoothChar: any = null;

let activeSerialPort: any = null;
let activeUsbDevice: any = null;
let activeUsbEndpoint: number = 1;

// Deduplication map to prevent double-printing within 5 seconds
const recentPrintJobs = new Map<string, number>();

function checkAndMarkDuplicatePrint(ticketNumber?: string | number, counterId?: string, counterName?: string): boolean {
  if (!ticketNumber) return false;
  const key = `${ticketNumber}_${counterId || counterName || 'all'}`;
  const now = Date.now();
  const lastTime = recentPrintJobs.get(key);
  if (lastTime && now - lastTime < 5000) {
    return true;
  }
  recentPrintJobs.set(key, now);
  // Housekeep old entries
  if (recentPrintJobs.size > 100) {
    for (const [k, time] of recentPrintJobs.entries()) {
      if (now - time > 30000) {
        recentPrintJobs.delete(k);
      }
    }
  }
  return false;
}

// Common BLE Service UUIDs used by ESC/POS thermal printers
const BLE_THERMAL_SERVICES = [
  '000018f0-0000-1000-8000-00805f9b34fb', // Standard POS
  '0000ffe0-0000-1000-8000-00805f9b34fb', // HM-10 / CC2541 / Universal POS
  '49535343-fe7d-4ae5-8fa9-9fafd205e455', // ISSC Transparent UART
  '6e400001-b5a3-f393-e0a9-e50e24dcca9e', // Nordic UART Service (NUS)
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
  '0000ff00-0000-1000-8000-00805f9b34fb',
  '0000fee7-0000-1000-8000-00805f9b34fb', // Tencent/WeChat POS
  '0000fff0-0000-1000-8000-00805f9b34fb',
  '0000fe00-0000-1000-8000-00805f9b34fb',
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

/**
 * Check if Bluetooth is specifically connected for a counter
 */
export function isBluetoothConnectedForCounter(
  counterId?: string,
  printerName?: string,
  counterName?: string
): { connected: boolean; deviceName: string | null } {
  // 1. Direct match by counter ID
  if (counterId && activeBtConnections.has(counterId)) {
    const conn = activeBtConnections.get(counterId)!;
    if (conn.device?.gatt?.connected) {
      return { connected: true, deviceName: conn.name };
    }
  }

  // 2. Direct match by counter name
  if (counterName && activeBtConnections.has(counterName.trim().toLowerCase())) {
    const conn = activeBtConnections.get(counterName.trim().toLowerCase())!;
    if (conn.device?.gatt?.connected) {
      return { connected: true, deviceName: conn.name };
    }
  }

  // 3. Direct match by configured printer device name
  if (printerName && activeBtConnections.has(printerName)) {
    const conn = activeBtConnections.get(printerName)!;
    if (conn.device?.gatt?.connected) {
      return { connected: true, deviceName: conn.name };
    }
  }

  // 4. Counter ID stored preference
  if (counterId && typeof window !== 'undefined') {
    const savedName = localStorage.getItem(`qdine_bt_counter_${counterId}`);
    if (savedName && activeBtConnections.has(savedName)) {
      const conn = activeBtConnections.get(savedName)!;
      if (conn.device?.gatt?.connected) {
        return { connected: true, deviceName: conn.name };
      }
    }
  }

  // 5. Counter Name stored preference
  if (counterName && typeof window !== 'undefined') {
    const savedName = localStorage.getItem(`qdine_bt_counter_${counterName.trim().toLowerCase()}`);
    if (savedName && activeBtConnections.has(savedName)) {
      const conn = activeBtConnections.get(savedName)!;
      if (conn.device?.gatt?.connected) {
        return { connected: true, deviceName: conn.name };
      }
    }
  }

  // 6. Universal fallback: If a Bluetooth printer is connected, route tickets to it
  if (activeBluetoothDevice?.gatt?.connected) {
    return { connected: true, deviceName: activeBluetoothDevice.name };
  }

  return { connected: false, deviceName: null };
}

// ============================================================
// 1. WEB BLUETOOTH ENGINE
// ============================================================

/**
 * Pair and connect to a Bluetooth thermal printer (optionally mapped to counter)
 */
export async function connectBluetoothPrinter(counterId?: string, counterName?: string): Promise<{ success: boolean; deviceName?: string; error?: string }> {
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
    const conn: ActiveBtConnection = { device, char: writeChar, name: deviceName };
    activeBtConnections.set(deviceName, conn);
    if (counterId) {
      activeBtConnections.set(counterId, conn);
      if (typeof window !== 'undefined') {
        localStorage.setItem(`qdine_bt_counter_${counterId}`, deviceName);
      }
    }
    if (counterName) {
      activeBtConnections.set(counterName.trim().toLowerCase(), conn);
      if (typeof window !== 'undefined') {
        localStorage.setItem(`qdine_bt_counter_${counterName.trim().toLowerCase()}`, deviceName);
      }
    }

    if (typeof window !== 'undefined') {
      localStorage.setItem('qdine_bt_printer_name', deviceName);
      localStorage.setItem('qdine_preferred_printer_type', 'bluetooth');
    }

    // Auto-cleanup on disconnect
    device.addEventListener('gattserverdisconnected', () => {
      console.log(`Bluetooth printer disconnected: ${deviceName}`);
      activeBtConnections.delete(deviceName);
      if (counterId) activeBtConnections.delete(counterId);
      if (counterName) activeBtConnections.delete(counterName.trim().toLowerCase());
      if (activeBluetoothDevice === device) {
        activeBluetoothChar = null;
      }
    });

    return { success: true, deviceName };
  } catch (err: any) {
    console.error('Bluetooth connection failed:', err);
    return { success: false, error: err.message || 'Failed to connect to Bluetooth printer' };
  }
}

/**
 * Disconnect Bluetooth printer (optionally for specific counter)
 */
export async function disconnectBluetoothPrinter(counterId?: string, printerName?: string): Promise<void> {
  let targetConn: ActiveBtConnection | undefined;

  if (counterId && activeBtConnections.has(counterId)) {
    targetConn = activeBtConnections.get(counterId);
    activeBtConnections.delete(counterId);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(`qdine_bt_counter_${counterId}`);
    }
  } else if (printerName && activeBtConnections.has(printerName)) {
    targetConn = activeBtConnections.get(printerName);
    activeBtConnections.delete(printerName);
  } else {
    targetConn = activeBluetoothDevice
      ? { device: activeBluetoothDevice, char: activeBluetoothChar, name: activeBluetoothDevice.name }
      : undefined;
  }

  if (targetConn?.device?.gatt?.connected) {
    try {
      targetConn.device.gatt.disconnect();
    } catch {}
  }
  if (targetConn?.device === activeBluetoothDevice) {
    activeBluetoothDevice = null;
    activeBluetoothChar = null;
  }
  if (!counterId && typeof window !== 'undefined') {
    localStorage.removeItem('qdine_bt_printer_name');
  }
}

/**
 * Write raw ESC/POS bytes to Bluetooth printer in MTU-safe chunks
 */
export async function writeBytesToBluetooth(
  bytes: Uint8Array,
  targetPrinterName?: string,
  counterId?: string,
  counterName?: string
): Promise<void> {
  let writeChar: any = null;
  let targetDevice: any = null;

  if (counterId && activeBtConnections.has(counterId)) {
    const conn = activeBtConnections.get(counterId)!;
    if (conn.device?.gatt?.connected) {
      writeChar = conn.char;
      targetDevice = conn.device;
    }
  }

  if (!writeChar && counterName && activeBtConnections.has(counterName.trim().toLowerCase())) {
    const conn = activeBtConnections.get(counterName.trim().toLowerCase())!;
    if (conn.device?.gatt?.connected) {
      writeChar = conn.char;
      targetDevice = conn.device;
    }
  }

  if (!writeChar && targetPrinterName && activeBtConnections.has(targetPrinterName)) {
    const conn = activeBtConnections.get(targetPrinterName)!;
    if (conn.device?.gatt?.connected) {
      writeChar = conn.char;
      targetDevice = conn.device;
    }
  }

  if (!writeChar && activeBluetoothChar && activeBluetoothDevice?.gatt?.connected) {
    writeChar = activeBluetoothChar;
    targetDevice = activeBluetoothDevice;
  }

  if (!writeChar || !targetDevice?.gatt?.connected) {
    if (targetDevice?.gatt) {
      try {
        await targetDevice.gatt.connect();
      } catch (e) {
        throw new Error('Bluetooth printer is disconnected. Please re-pair in Kitchen Counters.');
      }
    } else {
      throw new Error('No Bluetooth printer connected. Tap "Connect Bluetooth" on this counter.');
    }
  }

  // BLE MTU is usually 20-512 bytes. 100 bytes is safest across all devices.
  const CHUNK_SIZE = 100;
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    const chunk = bytes.slice(i, i + CHUNK_SIZE);
    if (writeChar.properties.writeWithoutResponse) {
      await writeChar.writeValueWithoutResponse(chunk);
    } else {
      await writeChar.writeValueWithResponse(chunk);
    }
    // Small inter-chunk pause to prevent thermal printer buffer overflow
    await new Promise((r) => setTimeout(r, 25));
  }
}

/**
 * Attempt to reconnect to a previously paired Bluetooth thermal printer silently
 */
export async function tryAutoConnectBluetooth(): Promise<boolean> {
  if (typeof window === 'undefined' || !isBluetoothSupported() || !(navigator as any).bluetooth?.getDevices) {
    return false;
  }
  try {
    const devices = await (navigator as any).bluetooth.getDevices();
    if (!devices || devices.length === 0) return false;

    const savedName = localStorage.getItem('qdine_bt_printer_name');
    const targetDevice = (savedName ? devices.find((d: any) => d.name === savedName) : null) || devices[0];

    if (!targetDevice) return false;

    let server = targetDevice.gatt;
    if (!server.connected) {
      server = await targetDevice.gatt.connect();
    }

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
      } catch {}
    }

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

    if (writeChar) {
      activeBluetoothDevice = targetDevice;
      activeBluetoothChar = writeChar;
      const deviceName = targetDevice.name || 'Bluetooth Thermal Printer';
      const conn: ActiveBtConnection = { device: targetDevice, char: writeChar, name: deviceName };
      activeBtConnections.set(deviceName, conn);

      // Rehydrate counter associations from localStorage
      if (typeof window !== 'undefined') {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('qdine_bt_counter_')) {
            const counterKey = key.replace('qdine_bt_counter_', '');
            activeBtConnections.set(counterKey, conn);
          }
        }
      }

      targetDevice.addEventListener('gattserverdisconnected', () => {
        console.log('Bluetooth printer disconnected');
        activeBluetoothChar = null;
        activeBluetoothDevice = null;
        activeBtConnections.delete(deviceName);
      });
      return true;
    }
    return false;
  } catch (err) {
    console.debug('Bluetooth auto-connect skipped/failed:', err);
    return false;
  }
}

// ============================================================
// 2. WEB SERIAL / USB ENGINE
// ============================================================

// In-memory active Serial ports per counter
const activeSerialPorts = new Map<string, any>();

/**
 * Check if USB / Serial is connected for a specific counter
 */
export function isSerialConnectedForCounter(
  counterId?: string,
  printerName?: string
): { connected: boolean; deviceName: string | null } {
  if (counterId && activeSerialPorts.has(counterId)) {
    const p = activeSerialPorts.get(counterId);
    if (p && p.readable) {
      return { connected: true, deviceName: printerName || 'USB Serial Printer' };
    }
  }
  if (activeSerialPort && activeSerialPort.readable) {
    return { connected: true, deviceName: 'USB Serial Printer' };
  }
  return { connected: false, deviceName: null };
}

/**
 * Connect to a USB Thermal Printer via Web Serial (COM / USB) (optionally mapped to counter)
 */
export async function connectSerialPrinter(counterId?: string): Promise<{ success: boolean; deviceName?: string; error?: string }> {
  if (!isSerialSupported()) {
    return {
      success: false,
      error: 'Web Serial is not supported in this browser. Please use Chrome or Edge on Windows, Mac, or Linux.',
    };
  }

  try {
    const port = await (navigator as any).serial.requestPort();
    try {
      await port.open({ baudRate: 9600 });
    } catch (openErr: any) {
      // Common Windows error when printer is locked by Windows Print Spooler (USB001)
      if (openErr.message?.includes('Failed to open') || openErr.name === 'NetworkError') {
        throw new Error(
          'This USB printer is locked by Windows Print Spooler. For USB POS-80C, use Chrome Kiosk Mode (--kiosk-printing) for 1-click silent printing, or pair via Bluetooth.'
        );
      }
      throw openErr;
    }

    activeSerialPort = port;
    if (counterId) {
      activeSerialPorts.set(counterId, port);
    }

    const deviceName = 'USB Thermal Printer (POS-80C)';
    if (typeof window !== 'undefined') {
      localStorage.setItem('qdine_serial_printer_name', deviceName);
      localStorage.setItem('qdine_preferred_printer_type', 'serial');
      if (counterId) {
        localStorage.setItem(`qdine_serial_counter_${counterId}`, deviceName);
      }
    }

    return { success: true, deviceName };
  } catch (err: any) {
    console.error('Serial connection failed:', err);
    return { success: false, error: err.message || 'Failed to connect USB printer' };
  }
}

/**
 * Disconnect Serial / USB printer (optionally for specific counter)
 */
export async function disconnectSerialPrinter(counterId?: string): Promise<void> {
  if (counterId && activeSerialPorts.has(counterId)) {
    const p = activeSerialPorts.get(counterId);
    try {
      await p?.close();
    } catch {}
    activeSerialPorts.delete(counterId);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(`qdine_serial_counter_${counterId}`);
    }
  } else if (activeSerialPort) {
    try {
      await activeSerialPort.close();
    } catch {}
    activeSerialPort = null;
  }
  if (!counterId && typeof window !== 'undefined') {
    localStorage.removeItem('qdine_serial_printer_name');
  }
}

/**
 * Write raw ESC/POS bytes to Serial / USB printer
 */
export async function writeBytesToSerial(bytes: Uint8Array, counterId?: string): Promise<void> {
  const port = (counterId && activeSerialPorts.get(counterId)) || activeSerialPort;
  if (!port || !port.writable) {
    throw new Error('USB / Serial printer not connected. Tap "Connect USB" on this counter.');
  }

  const writer = port.writable.getWriter();
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

/**
 * Send raw ESC/POS binary bytes to RawBT WebSocket Service (Port 40213).
 * This prints silently in the background on Android without opening any tab or dialog!
 */
export function printViaRawBtWebSocket(bytes: Uint8Array, timeoutMs: number = 1500): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') return resolve(false);

    try {
      const socket = new WebSocket('ws://127.0.0.1:40213/');
      socket.binaryType = 'arraybuffer';

      const timer = setTimeout(() => {
        try { socket.close(); } catch {}
        resolve(false);
      }, timeoutMs);

      socket.onopen = () => {
        const wsBytes = new Uint8Array(bytes);
        socket.send(wsBytes);
        clearTimeout(timer);
        setTimeout(() => {
          try { socket.close(1000, 'Print complete'); } catch {}
          resolve(true);
        }, 120);
      };

      socket.onerror = () => {
        clearTimeout(timer);
        resolve(false);
      };

      socket.onclose = () => {
        clearTimeout(timer);
      };
    } catch {
      resolve(false);
    }
  });
}

// ============================================================
// 4. UNIFIED PRINT DISPATCHER
// ============================================================

export interface UnifiedPrintOptions {
  base64Bytes?: string;
  kotData: KotPrintData;
  printerName?: string;
  counterId?: string;
  counterName?: string;
  forceBrowser?: boolean;
  isAutoPrint?: boolean; // When true, NEVER open the browser built-in print dialog/tab!
}

// ============================================================
// SEQUENTIAL PRINT QUEUE (FIFO)
// Ensures jobs never overlap, collide on Bluetooth GATT, or lock USB
// Handles "one printer for all counters" by printing one at a time
// ============================================================
let printQueuePromise: Promise<any> = Promise.resolve();

export function enqueuePrintJob<T>(job: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    printQueuePromise = printQueuePromise
      .catch(() => {}) // Never break the queue if a previous job errors
      .then(async () => {
        try {
          const res = await job();
          // Safe inter-ticket pause (350ms) to allow cutter cycle and prevent thermal head buffer overflow
          await new Promise((r) => setTimeout(r, 350));
          resolve(res);
        } catch (err) {
          reject(err);
        }
      });
  });
}

/**
 * Dispatch print job to the most direct, highest-priority hardware connection.
 * Automatically queued sequentially so tickets never override or collide!
 * 1. Web Bluetooth (if paired & active)
 * 2. Web Serial / USB (if connected & active)
 * 3. Android RawBT WebSocket (Port 40213 - 100% silent, background)
 * 4. Android RawBT URL Intent
 * 5. Local HTTP Bridge on Windows (Port 9123 - 100% silent, background)
 * 6. Hidden iframe 80mm thermal receipt (Manual print only; never on auto-print)
 */
export function printUnifiedThermalTicket(options: UnifiedPrintOptions): Promise<{
  success: boolean;
  method: 'bluetooth' | 'serial' | 'rawbt' | 'browser';
  message?: string;
}> {
  const ticketNo = options.kotData?.ticketNumber;
  const isAddOn = Boolean(options.kotData?.isAddOn);
  if (!isAddOn && ticketNo && checkAndMarkDuplicatePrint(ticketNo, options.counterId, options.counterName || options.kotData?.counterName)) {
    console.warn(`[HardwarePrinter] Duplicate print suppressed for Ticket #${ticketNo} (${options.counterName || options.counterId || 'ALL'})`);
    return Promise.resolve({
      success: true,
      method: 'serial',
      message: `Ticket #${ticketNo} already processed. Duplicate suppressed.`,
    });
  }
  return enqueuePrintJob(() => executePrintUnifiedThermalTicket(options));
}

async function executePrintUnifiedThermalTicket(options: UnifiedPrintOptions): Promise<{
  success: boolean;
  method: 'bluetooth' | 'serial' | 'rawbt' | 'browser';
  message?: string;
}> {
  const { base64Bytes, kotData, printerName = 'POS-80C', counterId, counterName = kotData?.counterName, forceBrowser = false, isAutoPrint = false } = options;

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
    const preferredType = typeof window !== 'undefined' ? localStorage.getItem('qdine_preferred_printer_type') : null;

    // Check if RawBT is explicitly preferred
    if (preferredType === 'rawbt' && base64Bytes) {
      const sent = printViaRawBt(base64Bytes);
      if (sent) {
        return {
          success: true,
          method: 'rawbt',
          message: `Sent directly to RawBT Android Print Service!`,
        };
      }
    }

    // 1. Try Bluetooth if active or attempt silent auto-reconnect
    const btCheck = isBluetoothConnectedForCounter(counterId, printerName, counterName);
    if (!btCheck.connected && (!activeBluetoothChar || !activeBluetoothDevice?.gatt?.connected)) {
      await tryAutoConnectBluetooth();
    }

    const btNow = isBluetoothConnectedForCounter(counterId, printerName, counterName);
    const isBtActive = btNow.connected || (activeBluetoothChar && activeBluetoothDevice?.gatt?.connected);
    if (isBtActive) {
      try {
        await writeBytesToBluetooth(rawBytes, printerName, counterId, counterName);
        return {
          success: true,
          method: 'bluetooth',
          message: `Printed instantly to ${btNow.deviceName || activeBluetoothDevice?.name || 'Bluetooth Printer'}!`,
        };
      } catch (err: any) {
        console.warn('Bluetooth print failed, trying alternatives:', err.message);
      }
    }

    // 2. Try Serial / USB if active
    const serialCheck = isSerialConnectedForCounter(counterId, printerName);
    const isSerialActive = serialCheck.connected || (activeSerialPort && activeSerialPort.writable);
    if (isSerialActive) {
      try {
        await writeBytesToSerial(rawBytes, counterId);
        return {
          success: true,
          method: 'serial',
          message: `Printed instantly to USB Printer (${printerName})!`,
        };
      } catch (err: any) {
        console.warn('USB print failed, trying alternatives:', err.message);
      }
    }

    // 3. Try RawBT WebSocket on Android (Port 40213 - 100% silent background printing)
    try {
      const rawBtWsOk = await printViaRawBtWebSocket(rawBytes);
      if (rawBtWsOk) {
        return {
          success: true,
          method: 'rawbt',
          message: `Printed silently via RawBT Android Print Service!`,
        };
      }
    } catch {}

    // 4. Try Local HTTP Bridge on Windows (Port 9123 - 100% silent background printing)
    try {
      const localBridgeUrl = (typeof window !== 'undefined' && localStorage.getItem('qdine_printer_bridge_url')) || 'http://127.0.0.1:9123/print';
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1200);

      const bridgeRes = await fetch(localBridgeUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          printerName,
          base64Bytes,
          docName: `KOT #${kotData.ticketNumber} - ${counterName || kotData.counterName || 'Counter'}`,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (bridgeRes.ok) {
        const bridgeData = await bridgeRes.json();
        if (bridgeData.success) {
          return {
            success: true,
            method: 'serial',
            message: `Printed silently via local bridge to ${printerName}!`,
          };
        }
      }
    } catch {}
  }

  // 5. Fallback: Browser 80mm Thermal Receipt (Manual print only; never on auto-print)
  // When isAutoPrint is true and forceBrowser is false, NEVER open the browser print dialog!
  if (isAutoPrint && !forceBrowser) {
    console.warn(`[HardwarePrinter] Silent printer not reachable for "${printerName}". Browser print dialog suppressed for auto-print.`);
    return {
      success: false,
      method: 'browser',
      message: `Silent printer not connected for "${printerName}". Start print-agent or connect via USB/Bluetooth.`,
    };
  }

  // When no direct Bluetooth/Serial/RawBT/Bridge hardware is connected, this prints via the OS thermal receipt driver.
  // In Chrome Kiosk Mode (--kiosk-printing), this prints 100% silently and automatically.
  const html = generateThermalReceiptHtml(kotData);
  const printed = await printHtmlViaIframe(html);
  return {
    success: printed,
    method: 'browser',
    message: `KOT printed for ${counterName || kotData.counterName || printerName}`,
  };
}

/**
 * Universal iframe print helper for 80mm thermal receipts.
 * Uses a non-zero invisible frame (opacity: 0.01) so Chromium layout engines
 * reliably paginate and calculate styles before triggering print.
 */
export function printHtmlViaIframe(html: string): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve(false);
      return;
    }
    try {
      const iframeId = `thermal-print-iframe-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      let iframe = document.getElementById(iframeId) as HTMLIFrameElement | null;
      if (iframe) {
        try { iframe.remove(); } catch {}
      }

      iframe = document.createElement('iframe');
      iframe.id = iframeId;
      iframe.style.position = 'fixed';
      iframe.style.top = '0';
      iframe.style.left = '0';
      iframe.style.width = '80mm';
      iframe.style.height = '100vh';
      iframe.style.opacity = '0.01';
      iframe.style.pointerEvents = 'none';
      iframe.style.border = 'none';
      iframe.style.zIndex = '-9999';
      document.body.appendChild(iframe);

      const doc = iframe.contentWindow?.document;
      if (!doc) {
        resolve(false);
        return;
      }

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
          resolve(true);
        } catch (err) {
          console.error('Print iframe error:', err);
          resolve(false);
        } finally {
          setTimeout(() => {
            try { iframe?.remove(); } catch {}
          }, 60000);
        }
      };

      const img = iframe.contentWindow?.document?.querySelector('img');
      if (img && !img.complete) {
        img.onload = () => setTimeout(triggerPrint, 80);
        img.onerror = () => setTimeout(triggerPrint, 80);
      }

      iframe.onload = () => setTimeout(triggerPrint, 150);
      setTimeout(triggerPrint, 400);
    } catch (err) {
      console.error('printHtmlViaIframe fatal error:', err);
      resolve(false);
    }
  });
}

// ============================================================
// 5. UNIFIED BILL PRINT DISPATCHER
// ============================================================

export interface UnifiedBillPrintOptions {
  base64Bytes?: string;
  billHtml?: string;
  orderData?: any;
  billData?: any;
  printerName?: string;
  ticketNumber?: string | number;
  localBridgeUrl?: string;
  forceBrowser?: boolean;
}

/**
 * Dispatch bill print job to the most direct, highest-priority hardware connection:
 * 1. Web Bluetooth (if paired & active)
 * 2. Web Serial / USB (if connected & active)
 * 3. Android RawBT WebSocket (Port 40213 - 100% silent, background)
 * 4. Android RawBT URL Intent
 * 5. Local HTTP Bridge on Windows (Port 9123 - 100% silent, background)
 * 6. Hidden iframe 80mm thermal receipt (Browser thermal driver / Chrome kiosk printing)
 */
export function printUnifiedBill(options: UnifiedBillPrintOptions): Promise<{
  success: boolean;
  method: 'bluetooth' | 'serial' | 'rawbt' | 'bridge' | 'browser';
  message?: string;
}> {
  return enqueuePrintJob(() => executePrintUnifiedBill(options));
}

async function executePrintUnifiedBill(options: UnifiedBillPrintOptions): Promise<{
  success: boolean;
  method: 'bluetooth' | 'serial' | 'rawbt' | 'bridge' | 'browser';
  message?: string;
}> {
  const {
    base64Bytes,
    billHtml,
    orderData,
    billData,
    printerName = (typeof window !== 'undefined' ? (localStorage.getItem('qdine_bill_printer_name') || localStorage.getItem('qdine_kot_printer_name') || 'POS-80C') : 'POS-80C'),
    forceBrowser = false,
  } = options;

  const ticketNumber = options.ticketNumber || billData?.ticketNumber || orderData?.ticket_number || '';

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
    const preferredType = typeof window !== 'undefined' ? localStorage.getItem('qdine_preferred_printer_type') : null;

    // Check if RawBT is explicitly preferred on Android
    if (preferredType === 'rawbt' && base64Bytes) {
      const sent = printViaRawBt(base64Bytes);
      if (sent) {
        return {
          success: true,
          method: 'rawbt',
          message: 'Sent directly to RawBT Android Print Service!',
        };
      }
    }

    // 1. Try Bluetooth if active or attempt auto-reconnect
    const btCheck = isBluetoothConnectedForCounter(undefined, printerName);
    if (!btCheck.connected && (!activeBluetoothChar || !activeBluetoothDevice?.gatt?.connected)) {
      await tryAutoConnectBluetooth();
    }

    const btNow = isBluetoothConnectedForCounter(undefined, printerName);
    const isBtActive = btNow.connected || (activeBluetoothChar && activeBluetoothDevice?.gatt?.connected);
    if (isBtActive) {
      try {
        await writeBytesToBluetooth(rawBytes, printerName);
        return {
          success: true,
          method: 'bluetooth',
          message: `Bill #${ticketNumber} printed instantly to ${btNow.deviceName || activeBluetoothDevice?.name || 'Bluetooth Printer'}!`,
        };
      } catch (err: any) {
        console.warn('Bluetooth bill print failed, trying alternatives:', err.message);
      }
    }

    // 2. Try Serial / USB if active
    const serialCheck = isSerialConnectedForCounter(undefined, printerName);
    const isSerialActive = serialCheck.connected || (activeSerialPort && activeSerialPort.writable);
    if (isSerialActive) {
      try {
        await writeBytesToSerial(rawBytes);
        return {
          success: true,
          method: 'serial',
          message: `Bill #${ticketNumber} printed instantly to USB Printer (${printerName})!`,
        };
      } catch (err: any) {
        console.warn('USB bill print failed, trying alternatives:', err.message);
      }
    }

    // 3. Try RawBT WebSocket on Android
    try {
      const rawBtWsOk = await printViaRawBtWebSocket(rawBytes);
      if (rawBtWsOk) {
        return {
          success: true,
          method: 'rawbt',
          message: 'Bill printed silently via RawBT Android Print Service!',
        };
      }
    } catch {}

    // 4. Try Local HTTP Bridge on Windows (Port 9123 or user-configured bridge URL)
    try {
      const bridgeUrl = options.localBridgeUrl || (typeof window !== 'undefined' && localStorage.getItem('qdine_printer_bridge_url')) || 'http://127.0.0.1:9123/print';
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1200);

      const bridgeRes = await fetch(bridgeUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          printerName,
          base64Bytes,
          docName: `Bill #${ticketNumber || ''}`,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (bridgeRes.ok) {
        const bridgeData = await bridgeRes.json();
        if (bridgeData.success) {
          return {
            success: true,
            method: 'bridge',
            message: `Bill #${ticketNumber} sent silently to ${printerName} via local bridge!`,
          };
        }
      }
    } catch {}
  }

  // 5. Fallback: Browser 80mm Thermal Receipt (via hidden iframe)
  let htmlToPrint = billHtml;
  if (!htmlToPrint && orderData) {
    htmlToPrint = generateBillTemplateHTML(orderData, {
      name: orderData.restaurant_name || 'Restaurant',
      address: orderData.restaurant_address,
      phone: orderData.restaurant_phone,
      gst_number: orderData.restaurant_gst,
    });
  }

  if (htmlToPrint) {
    const printed = await printHtmlViaIframe(htmlToPrint);
    return {
      success: printed,
      method: 'browser',
      message: `Bill #${String(ticketNumber).padStart(3, '0')} printed!`,
    };
  }

  return {
    success: false,
    method: 'browser',
    message: 'No print data or HTML available to print bill.',
  };
}

