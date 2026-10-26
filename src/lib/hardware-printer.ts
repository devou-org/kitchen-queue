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
import {
  isQzConnected,
  connectQzTray,
  disconnectQzTray,
  getQzPrinters,
  printRawEscposViaQz,
} from './qz-printer';

export type HardwarePrinterType = 'bluetooth' | 'serial' | 'usb' | 'browser' | 'rawbt' | 'qz-tray';

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

/**
 * Client-side duplicate suppression has been removed in favor of durable PostgreSQL
 * print_jobs queue claiming and DB-level idempotency keys.
 */
export function checkAndMarkDuplicatePrint(
  _ticketNumber?: string | number,
  _counterId?: string,
  _counterName?: string,
  _isTest?: boolean
): boolean {
  return false;
}

export function clearPrintMark(
  _ticketNumber?: string | number,
  _counterId?: string,
  _counterName?: string
): void {}

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
  const isBill = counterId === 'bill_printer' || (counterName || '').trim().toLowerCase() === 'bill printer';
  const cleanCName = (counterName || '').trim().toLowerCase();
  const cleanPrinterName = printerName?.trim();

  // 1. Direct match by counter ID (e.g. UUID or 'bill_printer')
  if (counterId && activeBtConnections.has(counterId)) {
    const conn = activeBtConnections.get(counterId)!;
    if (conn.device?.gatt?.connected) {
      return { connected: true, deviceName: conn.name };
    } else {
      activeBtConnections.delete(counterId);
    }
  }

  // 2. Direct match by counter name (e.g. 'bev', 'burger', 'main')
  if (cleanCName && activeBtConnections.has(cleanCName)) {
    const conn = activeBtConnections.get(cleanCName)!;
    if (conn.device?.gatt?.connected) {
      return { connected: true, deviceName: conn.name };
    } else {
      activeBtConnections.delete(cleanCName);
    }
  }

  // 3. Match via counter-specific saved preference in localStorage
  if (typeof window !== 'undefined') {
    let savedDeviceForCounter: string | null = null;
    if (isBill) {
      savedDeviceForCounter = localStorage.getItem('qdine_bt_counter_bill_printer')
        || localStorage.getItem('qdine_bt_counter_bill printer')
        || localStorage.getItem('qdine_bill_printer_name');
    } else {
      savedDeviceForCounter = (cleanCName ? localStorage.getItem(`qdine_bt_counter_${cleanCName}`) : null)
        || (counterId ? localStorage.getItem(`qdine_bt_counter_${counterId}`) : null);
    }

    if (savedDeviceForCounter && activeBtConnections.has(savedDeviceForCounter)) {
      const conn = activeBtConnections.get(savedDeviceForCounter)!;
      if (conn.device?.gatt?.connected) {
        return { connected: true, deviceName: conn.name };
      }
    }
  }

  // 4. Match by explicit non-generic printer name (e.g. Printer001 or KPC307-UEWB-330C)
  // Ensure that Bill Printer and Kitchen Counters remain strictly isolated
  if (cleanPrinterName && cleanPrinterName.toUpperCase() !== 'POS-80C' && activeBtConnections.has(cleanPrinterName)) {
    const conn = activeBtConnections.get(cleanPrinterName)!;
    if (conn.device?.gatt?.connected) {
      if (isBill) {
        const billSaved = typeof window !== 'undefined' ? localStorage.getItem('qdine_bill_printer_name') : null;
        if (billSaved === cleanPrinterName || activeBtConnections.has('bill_printer')) {
          return { connected: true, deviceName: conn.name };
        }
      } else {
        // Kitchen counter: only match if this device is not solely a bill_printer connection
        const isOnlyBillPrinter = activeBtConnections.get('bill_printer') === conn &&
          !activeBtConnections.has(counterId || '') &&
          !activeBtConnections.has(cleanCName);
        if (!isOnlyBillPrinter) {
          return { connected: true, deviceName: conn.name };
        }
      }
    } else {
      activeBtConnections.delete(cleanPrinterName);
    }
  }

  // Purely generic call without any counter context (rare standalone check)
  if (!counterId && !cleanCName && (!cleanPrinterName || cleanPrinterName.toUpperCase() === 'POS-80C')) {
    if (activeBluetoothDevice?.gatt?.connected) {
      return { connected: true, deviceName: activeBluetoothDevice.name };
    }
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
          } catch { }
        }
      } catch { }
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
      if (counterId === 'bill_printer' || counterName?.trim().toLowerCase() === 'bill printer') {
        localStorage.setItem('qdine_bill_printer_name', deviceName);
        localStorage.setItem('qdine_bill_printer_type', 'BLUETOOTH');
      } else if (!counterId && !counterName) {
        localStorage.setItem('qdine_bt_printer_name', deviceName);
      }
      localStorage.setItem('qdine_preferred_printer_type', 'bluetooth');
    }

    // Auto-cleanup on disconnect (attached only once per device)
    if (!attachedDisconnectListeners.has(device)) {
      attachedDisconnectListeners.add(device);
      device.addEventListener('gattserverdisconnected', () => {
        console.log(`Bluetooth printer disconnected: ${deviceName}`);
        activeBtConnections.delete(deviceName);
        if (device.id) activeBtConnections.delete(device.id);
        if (counterId) activeBtConnections.delete(counterId);
        if (counterName) activeBtConnections.delete(counterName.trim().toLowerCase());
        if (activeBluetoothDevice === device) {
          activeBluetoothChar = null;
          activeBluetoothDevice = null;
        }
      });
    }

    return { success: true, deviceName };
  } catch (err: any) {
    console.error('Bluetooth connection failed:', err);
    return { success: false, error: err.message || 'Failed to connect to Bluetooth printer' };
  }
}

/**
 * Disconnect Bluetooth printer (optionally for specific counter)
 */
export async function disconnectBluetoothPrinter(
  counterId?: string,
  printerName?: string,
  counterName?: string
): Promise<void> {
  let targetConn: ActiveBtConnection | undefined;

  const cleanName = printerName?.trim();
  const cleanCounterName = counterName?.trim().toLowerCase();

  // Find the active connection for this counter
  if (counterId && activeBtConnections.has(counterId)) {
    targetConn = activeBtConnections.get(counterId);
  } else if (cleanCounterName && activeBtConnections.has(cleanCounterName)) {
    targetConn = activeBtConnections.get(cleanCounterName);
  } else if (cleanName && cleanName.toUpperCase() !== 'POS-80C' && activeBtConnections.has(cleanName)) {
    const isBill = counterId === 'bill_printer' || cleanCounterName === 'bill printer';
    const candidate = activeBtConnections.get(cleanName);
    if (isBill || candidate !== activeBtConnections.get('bill_printer')) {
      targetConn = candidate;
    }
  } else if (!counterId && !cleanCounterName && activeBluetoothDevice) {
    targetConn = { device: activeBluetoothDevice, char: activeBluetoothChar, name: activeBluetoothDevice.name };
  }

  // Delete all counter-specific bindings
  if (counterId) {
    activeBtConnections.delete(counterId);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(`qdine_bt_counter_${counterId}`);
    }
  }
  if (cleanCounterName) {
    activeBtConnections.delete(cleanCounterName);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(`qdine_bt_counter_${cleanCounterName}`);
    }
  }
  if (counterId === 'bill_printer' || cleanCounterName === 'bill printer') {
    activeBtConnections.delete('bill_printer');
    activeBtConnections.delete('bill printer');
    if (typeof window !== 'undefined') {
      localStorage.removeItem('qdine_bt_counter_bill_printer');
      localStorage.removeItem('qdine_bt_counter_bill printer');
    }
  }

  // Check if any other counter is still using this physical Bluetooth device
  let otherCounterUsingDevice = false;
  if (targetConn?.device) {
    for (const [key, conn] of activeBtConnections.entries()) {
      if (
        conn.device === targetConn.device &&
        key !== targetConn.name &&
        key !== cleanName &&
        key !== counterId &&
        key !== cleanCounterName &&
        key !== 'bill_printer' &&
        key !== 'bill printer'
      ) {
        otherCounterUsingDevice = true;
        break;
      }
    }
  }

  // If no other counter is using this Bluetooth device, disconnect GATT and clean up global device reference
  if (!otherCounterUsingDevice && targetConn?.device) {
    if (targetConn.name) {
      activeBtConnections.delete(targetConn.name);
    }
    if (cleanName && cleanName.toUpperCase() !== 'POS-80C') {
      activeBtConnections.delete(cleanName);
    }
    if (targetConn.device.gatt?.connected) {
      try {
        targetConn.device.gatt.disconnect();
      } catch (err) {
        console.warn('GATT disconnect warning:', err);
      }
    }
    if (activeBluetoothDevice === targetConn.device) {
      activeBluetoothDevice = null;
      activeBluetoothChar = null;
    }
  }

  if (typeof window !== 'undefined') {
    if (!counterId || counterId === 'bill_printer') {
      localStorage.removeItem('qdine_bt_printer_name');
    }
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
    targetDevice = conn.device;
    if (conn.device?.gatt?.connected) {
      writeChar = conn.char;
    }
  }

  if (!writeChar && counterName && activeBtConnections.has(counterName.trim().toLowerCase())) {
    const conn = activeBtConnections.get(counterName.trim().toLowerCase())!;
    if (!targetDevice) targetDevice = conn.device;
    if (conn.device?.gatt?.connected) {
      writeChar = conn.char;
    }
  }

  const cleanPrinterName = targetPrinterName?.trim();
  if (!writeChar && cleanPrinterName && cleanPrinterName.toUpperCase() !== 'POS-80C' && activeBtConnections.has(cleanPrinterName)) {
    const conn = activeBtConnections.get(cleanPrinterName)!;
    if (!targetDevice) targetDevice = conn.device;
    if (conn.device?.gatt?.connected) {
      writeChar = conn.char;
    }
  }

  // Match via localStorage counter mapping
  let savedName: string | null = null;
  if (!writeChar && typeof window !== 'undefined') {
    const cleanC = (counterName || '').trim().toLowerCase();
    savedName = (cleanC ? localStorage.getItem(`qdine_bt_counter_${cleanC}`) : null)
      || (counterId ? localStorage.getItem(`qdine_bt_counter_${counterId}`) : null);
    if (savedName && activeBtConnections.has(savedName)) {
      const conn = activeBtConnections.get(savedName)!;
      if (!targetDevice) targetDevice = conn.device;
      if (conn.device?.gatt?.connected && conn.char) {
        writeChar = conn.char;
      }
    }
  }

  // Fall back to activeBluetoothDevice ONLY when no specific counter target was specified
  const hasSpecificTarget = Boolean(counterId || counterName || (cleanPrinterName && cleanPrinterName.toUpperCase() !== 'POS-80C'));
  if (!writeChar && !targetDevice && !hasSpecificTarget) {
    if (activeBluetoothDevice?.gatt?.connected) {
      targetDevice = activeBluetoothDevice;
      writeChar = activeBluetoothChar;
      if (!writeChar) {
        writeChar = await discoverWriteCharacteristic(activeBluetoothDevice.gatt);
        if (writeChar) activeBluetoothChar = writeChar;
      }
    } else if (activeBtConnections.size > 0) {
      for (const conn of activeBtConnections.values()) {
        if (conn.device?.gatt?.connected && conn.char) {
          writeChar = conn.char;
          targetDevice = conn.device;
          break;
        }
      }
    }
  }

  // If targetDevice is not found in memory, try searching paired devices from navigator.bluetooth.getDevices()
  if (!targetDevice && typeof window !== 'undefined' && (navigator as any).bluetooth?.getDevices) {
    try {
      const devices = await (navigator as any).bluetooth.getDevices();
      const desiredName = savedName || (cleanPrinterName && cleanPrinterName.toUpperCase() !== 'POS-80C' ? cleanPrinterName : null);
      if (desiredName) {
        targetDevice = devices.find((d: any) => d.name === desiredName);
      }
    } catch { }
  }

  // If target device is disconnected or writeChar is invalid, reconnect with timeout and re-discover writeChar
  if (!writeChar || !targetDevice?.gatt?.connected) {
    if (targetDevice) {
      try {
        const server = await connectGattWithTimeout(targetDevice, 3000);
        writeChar = await discoverWriteCharacteristic(server);
        if (writeChar) {
          activeBluetoothChar = writeChar;
          activeBluetoothDevice = targetDevice;
          const devName = targetDevice.name || 'Bluetooth Printer';
          const conn: ActiveBtConnection = { device: targetDevice, char: writeChar, name: devName };
          activeBtConnections.set(devName, conn);
          if (targetDevice.id) activeBtConnections.set(targetDevice.id, conn);
          if (counterId) activeBtConnections.set(counterId, conn);
          if (counterName) activeBtConnections.set(counterName.trim().toLowerCase(), conn);
        }
      } catch (e: any) {
        throw new Error(`Bluetooth printer "${cleanPrinterName || counterName || 'Assigned Printer'}" connection failed: ${e.message}`);
      }
    }
    if (!writeChar) {
      throw new Error(`No Bluetooth printer connected for ${cleanPrinterName || counterName || 'this counter'}. Tap "Pair Bluetooth" to connect.`);
    }
  }

  // BLE MTU safe chunking: Default to safe 64 bytes (universal BLE thermal printer safe limit)
  // Configurable via localStorage 'qdine_bt_chunk_size' (20 to 180 bytes)
  const configuredChunk = typeof window !== 'undefined' ? parseInt(localStorage.getItem('qdine_bt_chunk_size') || '64', 10) : 64;
  const CHUNK_SIZE = !isNaN(configuredChunk) && configuredChunk >= 20 && configuredChunk <= 512 ? configuredChunk : 64;

  console.time('[Perf] Bluetooth write');
  console.log(`[Perf] Bluetooth write start, bytes length: ${bytes.length}, chunk size: ${CHUNK_SIZE}`);

  try {
    for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
      const chunk = bytes.subarray(i, i + CHUNK_SIZE);
      if (writeChar.properties.writeWithoutResponse) {
        await writeChar.writeValueWithoutResponse(chunk);
        // Small 8ms pause to prevent thermal printer buffer overflow on fire-and-forget
        await new Promise((r) => setTimeout(r, 8));
      } else {
        await writeChar.writeValueWithResponse(chunk);
      }
    }
  } finally {
    console.timeEnd('[Perf] Bluetooth write');
    console.log('[Perf] Bluetooth write end');
  }
}

const attachedDisconnectListeners = new WeakSet<any>();

function isLikelyPrinter(dev: any): boolean {
  if (!dev || !dev.name) return false;
  const name = dev.name.trim();
  if (typeof window !== 'undefined') {
    if (localStorage.getItem('qdine_bt_printer_name') === name) return true;
    if (localStorage.getItem('qdine_bill_printer_name') === name) return true;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('qdine_bt_counter_') && localStorage.getItem(k) === name) {
        return true;
      }
    }
  }
  return /\b(printer|pos|receipt|thermal|rpp|mpt|kpc)\b|^bt-|bluetooth printer/i.test(name);
}

/**
 * Count distinct Bluetooth printer names configured across counters in localStorage
 */
export function distinctSavedPrinters(): number {
  if (typeof window === 'undefined') return 0;
  const set = new Set<string>();
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith('qdine_bt_counter_')) {
      const val = localStorage.getItem(k)?.trim();
      if (val && val.toUpperCase() !== 'POS-80C') {
        set.add(val.toLowerCase());
      }
    }
  }
  return set.size;
}

/**
 * Connect to device GATT with strict timeout (default 3000ms)
 * to prevent sequential queue from freezing indefinitely when a printer is out of range.
 */
export function connectGattWithTimeout(device: any, timeoutMs: number = 3000): Promise<any> {
  return new Promise((resolve, reject) => {
    if (!device?.gatt) {
      return reject(new Error('Device has no GATT server'));
    }
    if (device.gatt.connected) {
      return resolve(device.gatt);
    }
    let settled = false;
    const timer = setTimeout(() => {
      settled = true;
      try {
        if (device.gatt?.disconnect) device.gatt.disconnect();
      } catch { }
      reject(new Error(`Bluetooth connection to "${device.name || 'Printer'}" timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    device.gatt.connect()
      .then((server: any) => {
        if (!settled) {
          clearTimeout(timer);
          resolve(server);
        }
      })
      .catch((err: any) => {
        if (!settled) {
          clearTimeout(timer);
          reject(err);
        }
      });
  });
}

/**
 * Discover writable ESC/POS characteristic on connected GATT server
 */
export async function discoverWriteCharacteristic(server: any): Promise<any> {
  if (!server) return null;
  // 1. Try standard thermal printer BLE service UUIDs
  for (const serviceUuid of BLE_THERMAL_SERVICES) {
    try {
      const service = await server.getPrimaryService(serviceUuid);
      const chars = await service.getCharacteristics();
      for (const char of chars) {
        if (char.properties.write || char.properties.writeWithoutResponse) {
          return char;
        }
      }
    } catch { }
  }

  // 2. Fall back to discovering across all primary services
  try {
    const services = await server.getPrimaryServices();
    for (const service of services) {
      try {
        const chars = await service.getCharacteristics();
        for (const char of chars) {
          if (char.properties.write || char.properties.writeWithoutResponse) {
            return char;
          }
        }
      } catch { }
    }
  } catch { }

  return null;
}

/**
 * Attempt to reconnect to previously paired Bluetooth thermal printers silently
 */
export async function tryAutoConnectBluetooth(targetName?: string, targetCounterId?: string): Promise<boolean> {
  if (typeof window === 'undefined' || !isBluetoothSupported() || !(navigator as any).bluetooth?.getDevices) {
    return false;
  }
  try {
    const devices = await (navigator as any).bluetooth.getDevices();
    if (!devices || devices.length === 0) return false;

    // Filter to requested device if specified
    const cleanTarget = targetName?.trim();
    let targetDevice: any = null;
    if (cleanTarget && cleanTarget.toUpperCase() !== 'POS-80C') {
      targetDevice = devices.find((d: any) => d.name === cleanTarget);
    }
    if (!targetDevice && targetCounterId && typeof window !== 'undefined') {
      const savedForCounter = localStorage.getItem(`qdine_bt_counter_${targetCounterId}`);
      if (savedForCounter) {
        targetDevice = devices.find((d: any) => d.name === savedForCounter);
      }
    }

    // If no target device, ONLY attempt devices that are known/configured printers
    // Never attempt connection on headphones, watches, car bluetooth, etc.!
    const devicesToConnect = targetDevice
      ? [targetDevice]
      : devices.filter(isLikelyPrinter);

    if (devicesToConnect.length === 0) {
      return false;
    }

    let anyConnected = false;

    for (const dev of devicesToConnect) {
      if (!dev) continue;
      try {
        const server = await connectGattWithTimeout(dev, 2500);
        const writeChar = await discoverWriteCharacteristic(server);

        if (writeChar) {
          const deviceName = dev.name || 'Bluetooth Thermal Printer';
          const conn: ActiveBtConnection = { device: dev, char: writeChar, name: deviceName };
          activeBtConnections.set(deviceName, conn);
          if (dev.id) {
            activeBtConnections.set(dev.id, conn);
          }

          if (targetCounterId) {
            activeBtConnections.set(targetCounterId, conn);
          }

          // Rehydrate ONLY counters whose saved preference matches this device
          if (typeof window !== 'undefined') {
            for (let i = 0; i < localStorage.length; i++) {
              const key = localStorage.key(i);
              if (key && key.startsWith('qdine_bt_counter_')) {
                const counterKey = key.replace('qdine_bt_counter_', '');
                const savedName = localStorage.getItem(key);
                if (savedName === deviceName) {
                  activeBtConnections.set(counterKey, conn);
                }
              }
            }
          }

          // Attach disconnect listener once per device
          if (!attachedDisconnectListeners.has(dev)) {
            attachedDisconnectListeners.add(dev);
            dev.addEventListener('gattserverdisconnected', () => {
              console.log(`Bluetooth printer disconnected: ${deviceName}`);
              activeBtConnections.delete(deviceName);
              if (dev.id) activeBtConnections.delete(dev.id);
              if (activeBluetoothDevice === dev) {
                activeBluetoothChar = null;
                activeBluetoothDevice = null;
              }
            });
          }

          activeBluetoothDevice = dev;
          activeBluetoothChar = writeChar;
          anyConnected = true;
          if (targetDevice) break;
        }
      } catch (err: any) {
        console.warn(`[AutoConnect] Could not connect to "${dev.name}":`, err.message);
      }
    }

    return anyConnected;
  } catch (err) {
    console.warn('tryAutoConnectBluetooth failed:', err);
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
  const cleanName = printerName?.trim();
  const hasSpecificTarget = Boolean(
    (counterId && counterId.trim()) ||
    (cleanName && cleanName.toUpperCase() !== 'POS-80C')
  );

  if (counterId && activeSerialPorts.has(counterId)) {
    const p = activeSerialPorts.get(counterId);
    if (p && p.readable) {
      return { connected: true, deviceName: cleanName || 'USB Serial Printer' };
    }
  }

  if (cleanName && cleanName.toUpperCase() !== 'POS-80C' && activeSerialPorts.has(cleanName)) {
    const p = activeSerialPorts.get(cleanName);
    if (p && p.readable) {
      return { connected: true, deviceName: cleanName };
    }
  }

  if (hasSpecificTarget) {
    if (counterId !== 'bill_printer' && activeSerialPort && activeSerialPort.readable) {
      return { connected: true, deviceName: cleanName || 'USB Serial Printer' };
    }
    return { connected: false, deviceName: null };
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
export async function disconnectSerialPrinter(counterId?: string, printerName?: string): Promise<void> {
  const cleanName = printerName?.trim();
  let portToClose: any = null;

  if (counterId && activeSerialPorts.has(counterId)) {
    portToClose = activeSerialPorts.get(counterId);
    activeSerialPorts.delete(counterId);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(`qdine_serial_counter_${counterId}`);
    }
  } else if (cleanName && cleanName.toUpperCase() !== 'POS-80C' && activeSerialPorts.has(cleanName)) {
    portToClose = activeSerialPorts.get(cleanName);
    activeSerialPorts.delete(cleanName);
  } else if (activeSerialPort) {
    portToClose = activeSerialPort;
    activeSerialPort = null;
  }

  if (portToClose) {
    try {
      await portToClose.close();
    } catch { }
  }

  if (counterId === 'bill_printer') {
    activeSerialPorts.delete('bill_printer');
    if (typeof window !== 'undefined') {
      localStorage.removeItem('qdine_serial_counter_bill_printer');
    }
  }

  if ((!counterId || counterId === 'bill_printer') && typeof window !== 'undefined') {
    localStorage.removeItem('qdine_serial_printer_name');
  }
}

/**
 * Write raw ESC/POS bytes to Serial / USB printer
 */
export async function writeBytesToSerial(bytes: Uint8Array, counterId?: string): Promise<void> {
  let port = (counterId && activeSerialPorts.get(counterId)) || activeSerialPort;
  if (!port && activeSerialPorts.size > 0) {
    for (const p of activeSerialPorts.values()) {
      if (p?.writable) {
        port = p;
        break;
      }
    }
  }
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
        try { socket.close(); } catch { }
        resolve(false);
      }, timeoutMs);

      socket.onopen = () => {
        const wsBytes = new Uint8Array(bytes);
        socket.send(wsBytes);
        clearTimeout(timer);
        setTimeout(() => {
          try { socket.close(1000, 'Print complete'); } catch { }
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
  printerAddress?: string;
  printerType?: string;
  counterId?: string;
  counterName?: string;
  forceBrowser?: boolean;
  isAutoPrint?: boolean; // When true, NEVER open the browser built-in print dialog/tab!
  isTest?: boolean;
  skipDuplicateCheck?: boolean; // When true, caller has already checked and marked duplicates
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
      .catch(() => { }) // Never break the queue if a previous job errors
      .then(async () => {
        try {
          const res = await Promise.race([
            job(),
            new Promise<never>((_, rej) =>
              setTimeout(() => rej(new Error('Print job timed out')), 30000)
            ),
          ]);
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
  method: HardwarePrinterType;
  message?: string;
  duplicate?: boolean;
}> {
  return enqueuePrintJob(async () => {
    return await executePrintUnifiedThermalTicket(options);
  });
}

async function executePrintUnifiedThermalTicket(options: UnifiedPrintOptions): Promise<{
  success: boolean;
  method: HardwarePrinterType;
  message?: string;
}> {
  const { base64Bytes, kotData, printerName = 'POS-80C', printerAddress, counterId, counterName = kotData?.counterName, forceBrowser = false, isAutoPrint = false } = options;

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
    } catch { }
  }

  let perfTimerEnded = false;
  const endPerf = () => {
    if (!perfTimerEnded) {
      perfTimerEnded = true;
      try { console.timeEnd('[Perf] Print execution'); } catch { }
    }
  };

  console.time('[Perf] Print execution');
  console.log('[Perf] Print start for ticket:', options.kotData?.ticketNumber);

  if (!forceBrowser && rawBytes) {
    const preferredType = typeof window !== 'undefined' ? localStorage.getItem('qdine_preferred_printer_type') : null;

    // Check if RawBT is explicitly preferred
    if (preferredType === 'rawbt' && base64Bytes) {
      const sent = printViaRawBt(base64Bytes);
      if (sent) {
        endPerf();
        return {
          success: true,
          method: 'rawbt',
          message: `Sent directly to RawBT Android Print Service!`,
        };
      }
    }

    // 0. Try QZ Tray if actively connected OR if counter/station is configured for QZ/Network/OS printing
    const isAndroid = typeof window !== 'undefined' && /android/i.test(navigator.userAgent);
    const wantsQz = !isAndroid && Boolean(base64Bytes) && (
      isQzConnected() ||
      options.printerType === 'QZ_TRAY' ||
      options.printerType === 'NETWORK' ||
      Boolean(options.printerAddress) ||
      (typeof window !== 'undefined' && (
        localStorage.getItem('qdine_preferred_printer_type') === 'qz-tray' ||
        localStorage.getItem('qdine_qz_active') === '1'
      ))
    );

    if (wantsQz) {
      try {
        const qzTarget = printerAddress?.trim() || printerName;
        if (qzTarget) {
          const qzResult = await printRawEscposViaQz(qzTarget, base64Bytes!);
          if (qzResult.success) {
            endPerf();
            return {
              success: true,
              method: 'qz-tray',
              message: `Printed via QZ Tray to "${qzTarget}"!`,
            };
          }
        }
      } catch (qzErr: any) {
        console.warn('QZ Tray print attempt failed, trying alternatives:', qzErr?.message);
      }
    }

    // 1. Try Bluetooth if active or attempt silent auto-reconnect
    let btCheck = isBluetoothConnectedForCounter(counterId, printerName, counterName);
    if (!btCheck.connected) {
      await tryAutoConnectBluetooth(printerName, counterId);
      btCheck = isBluetoothConnectedForCounter(counterId, printerName, counterName);
    }

    if (btCheck.connected) {
      try {
        await writeBytesToBluetooth(rawBytes, printerName, counterId, counterName);
        endPerf();
        return {
          success: true,
          method: 'bluetooth',
          message: `Printed instantly to ${btCheck.deviceName || printerName || 'Bluetooth Printer'}!`,
        };
      } catch (err: any) {
        console.warn('Bluetooth print failed, trying alternatives:', err.message);
      }
    }

    // 2. Try Serial / USB if active
    let serialCheck = isSerialConnectedForCounter(counterId, printerName);
    if (!serialCheck.connected && !btCheck.connected) {
      if (activeSerialPort?.readable) {
        serialCheck = { connected: true, deviceName: 'USB Serial Printer' };
      } else if (activeSerialPorts.size > 0) {
        for (const p of activeSerialPorts.values()) {
          if (p?.readable) {
            serialCheck = { connected: true, deviceName: 'USB Serial Printer' };
            break;
          }
        }
      }
    }

    if (serialCheck.connected) {
      try {
        await writeBytesToSerial(rawBytes, counterId);
        endPerf();
        return {
          success: true,
          method: 'serial',
          message: `Printed instantly to USB Printer (${printerName})!`,
        };
      } catch (err: any) {
        console.warn('USB print failed, trying alternatives:', err.message);
      }
    }

    // When preferred type is Bluetooth or USB, skip network/RawBT to avoid timeout lag
    if (preferredType !== 'bluetooth' && preferredType !== 'usb') {
      const isAndroid = typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent);
      if (isAndroid) {
        // 3. Try RawBT WebSocket on Android (Port 40213 - 100% silent background printing)
        try {
          const rawBtWsOk = await printViaRawBtWebSocket(rawBytes);
          if (rawBtWsOk) {
            endPerf();
            return {
              success: true,
              method: 'rawbt',
              message: `Printed silently via RawBT Android Print Service!`,
            };
          }
        } catch { }
      }

      // 4. Try Local HTTP Bridge on Windows (Port 9123) only if explicitly configured
      const hasBridgeConfig = typeof window !== 'undefined' && Boolean(localStorage.getItem('qdine_printer_bridge_url') || localStorage.getItem('qdine_use_printer_bridge') === '1');
      if (hasBridgeConfig) {
        try {
          const localBridgeUrl = localStorage.getItem('qdine_printer_bridge_url') || 'http://127.0.0.1:9123/print';
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 800);

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
              endPerf();
              return {
                success: true,
                method: 'serial',
                message: `Printed silently via local bridge to ${printerName}!`,
              };
            }
          }
        } catch { }
      }
    }
  }

  endPerf();

  // 5. Fallback: Browser 80mm Thermal Receipt (Manual print only; never on auto-print unless configured or kiosk)
  const allowBrowserAutoPrint = typeof window !== 'undefined' && (
    localStorage.getItem('qdine_allow_browser_autoprint') === '1' ||
    localStorage.getItem('qdine_preferred_printer_type') === 'browser' ||
    localStorage.getItem('qdine_auto_print_browser') === 'true'
  );
  if (isAutoPrint && !forceBrowser && !allowBrowserAutoPrint) {
    console.warn(`[HardwarePrinter] Silent printer not reachable for "${printerName}". Browser print dialog suppressed for auto-print.`);
    return {
      success: false,
      method: 'browser',
      message: `Silent printer not connected for "${printerName}". Tap "Pair Bluetooth" in Settings, connect USB, or enable Browser Printing.`,
    };
  }

  // When no direct Bluetooth/Serial/RawBT/Bridge hardware is connected, this prints via the OS thermal receipt driver.
  // In Chrome Kiosk Mode (--kiosk-printing), this prints 100% silently and automatically.
  if (!kotData) {
    console.warn(`[HardwarePrinter] No kotData provided for thermal print.`);
    return {
      success: false,
      method: 'browser',
      message: `No KOT data available to print for "${printerName}"`,
    };
  }

  const html = generateThermalReceiptHtml(kotData);
  const printed = await printHtmlViaIframe(html);
  return {
    success: printed,
    method: 'browser',
    message: `KOT printed for ${counterName || kotData?.counterName || printerName}`,
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
        try { iframe.remove(); } catch { }
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
            try { iframe?.remove(); } catch { }
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
  printerAddress?: string;
  printerType?: string;
  ticketNumber?: string | number;
  localBridgeUrl?: string;
  forceBrowser?: boolean;
  counterId?: string;
  counterName?: string;
  isAutoPrint?: boolean;
  isTest?: boolean;
  skipDuplicateCheck?: boolean;
}

/**
 * Dispatch bill print job to the most direct, highest-priority hardware connection:
 * 0. QZ Tray (100% silent, direct OS spooler / network TCP)
 * 1. Web Bluetooth (if paired & active)
 * 2. Web Serial / USB (if connected & active)
 * 3. Android RawBT WebSocket (Port 40213 - 100% silent, background)
 * 4. Android RawBT URL Intent
 * 5. Local HTTP Bridge on Windows (Port 9123 - 100% silent, background)
 * 6. Hidden iframe 80mm thermal receipt (Browser thermal driver / Chrome kiosk printing)
 */
export function printUnifiedBill(options: UnifiedBillPrintOptions): Promise<{
  success: boolean;
  method: 'bluetooth' | 'serial' | 'rawbt' | 'bridge' | 'browser' | 'qz-tray';
  message?: string;
  duplicate?: boolean;
}> {
  return enqueuePrintJob(async () => {
    return await executePrintUnifiedBill(options);
  });
}

async function executePrintUnifiedBill(options: UnifiedBillPrintOptions): Promise<{
  success: boolean;
  method: 'bluetooth' | 'serial' | 'rawbt' | 'bridge' | 'browser' | 'qz-tray';
  message?: string;
}> {
  const {
    base64Bytes,
    billHtml,
    orderData,
    billData,
    printerName = (typeof window !== 'undefined' ? (localStorage.getItem('qdine_bill_printer_name') || localStorage.getItem('qdine_kot_printer_name') || 'POS-80C') : 'POS-80C'),
    printerAddress = (typeof window !== 'undefined' ? (localStorage.getItem('qdine_bill_printer_address') || undefined) : undefined),
    printerType = (typeof window !== 'undefined' ? (localStorage.getItem('qdine_bill_printer_type') || 'DEFAULT') : 'DEFAULT'),
    forceBrowser = false,
    isAutoPrint = false,
    counterId,
    counterName,
  } = options;

  const targetCounterId = counterId || (activeBtConnections.has('bill_printer') || (typeof window !== 'undefined' && localStorage.getItem('qdine_bt_counter_bill_printer')) ? 'bill_printer' : undefined);
  const targetCounterName = counterName || (targetCounterId ? 'Bill Printer' : undefined);

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
    } catch { }
  }

  const effType = (printerType || (typeof window !== 'undefined' ? localStorage.getItem('qdine_bill_printer_type') : null) || 'DEFAULT').toUpperCase();
  const effAddress = (effType === 'NETWORK' ? (printerAddress || (typeof window !== 'undefined' ? localStorage.getItem('qdine_bill_printer_address') : '')) : '')?.trim();

  // If not in NETWORK mode, ensure no old Wi-Fi address remains in localStorage
  if (effType !== 'NETWORK' && typeof window !== 'undefined') {
    localStorage.removeItem('qdine_bill_printer_address');
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

    // 1. BLUETOOTH MODE: Try Bluetooth if explicitly selected or if in DEFAULT mode with active Bluetooth connection
    if (effType === 'BLUETOOTH' || effType === 'DEFAULT') {
      let btCheck = isBluetoothConnectedForCounter(targetCounterId, printerName, targetCounterName);
      if (!btCheck.connected) {
        await tryAutoConnectBluetooth(printerName, targetCounterId);
        btCheck = isBluetoothConnectedForCounter(targetCounterId, printerName, targetCounterName);
      }

      if (btCheck.connected) {
        try {
          await writeBytesToBluetooth(rawBytes, printerName, targetCounterId, targetCounterName);
          return {
            success: true,
            method: 'bluetooth',
            message: `Bill #${ticketNumber} printed instantly to ${btCheck.deviceName || printerName}!`,
          };
        } catch (err: any) {
          console.warn('Bluetooth bill print failed:', err.message);
          if (effType === 'BLUETOOTH') {
            return {
              success: false,
              method: 'bluetooth',
              message: `Failed to print to Bluetooth printer (${printerName}): ${err.message}`,
            };
          }
        }
      } else if (effType === 'BLUETOOTH') {
        return {
          success: false,
          method: 'bluetooth',
          message: `Bluetooth printer "${printerName || 'POS-80C'}" is not connected. Please pair it in Settings.`,
        };
      }
    }

    // 2. USB MODE: Try USB / Serial if explicitly selected or if in DEFAULT mode with active USB connection
    if (effType === 'USB' || effType === 'DEFAULT') {
      const serialCheck = isSerialConnectedForCounter(targetCounterId, printerName);
      if (serialCheck.connected) {
        try {
          await writeBytesToSerial(rawBytes, targetCounterId);
          return {
            success: true,
            method: 'serial',
            message: `Bill #${ticketNumber} printed instantly to USB Printer (${printerName})!`,
          };
        } catch (err: any) {
          console.warn('USB bill print failed:', err.message);
          if (effType === 'USB') {
            return {
              success: false,
              method: 'serial',
              message: `Failed to print to USB printer (${printerName}): ${err.message}`,
            };
          }
        }
      } else if (effType === 'USB') {
        return {
          success: false,
          method: 'serial',
          message: `USB printer "${printerName || 'POS-80C'}" is not connected. Please connect it in Settings.`,
        };
      }
    }

    // 3. NETWORK MODE: Print to IP via QZ Tray TCP socket
    if (effType === 'NETWORK' && effAddress && base64Bytes) {
      try {
        const qzResult = await printRawEscposViaQz(effAddress, base64Bytes);
        if (qzResult.success) {
          return {
            success: true,
            method: 'qz-tray',
            message: `Bill #${ticketNumber} printed via network to "${effAddress}"!`,
          };
        }
      } catch (qzErr: any) {
        console.warn('Network bill print attempt failed:', qzErr?.message);
      }
    }

    // 4. QZ TRAY or DEFAULT SYSTEM MODE: Print via local QZ Tray spooler to target printer (skip on Android and when QZ is closed)
    const isAndroidBill = typeof window !== 'undefined' && /android/i.test(navigator.userAgent);
    const wantsQzBill = !isAndroidBill && Boolean(base64Bytes) && (
      effType === 'QZ_TRAY' ||
      effType === 'NETWORK' ||
      Boolean(effAddress) ||
      isQzConnected() ||
      (typeof window !== 'undefined' && localStorage.getItem('qdine_qz_active') === '1')
    );
    if (wantsQzBill) {
      try {
        const qzTarget = effAddress || printerName || 'POS-80C';
        const qzResult = await printRawEscposViaQz(qzTarget, base64Bytes!);
        if (qzResult.success) {
          return {
            success: true,
            method: 'qz-tray',
            message: `Bill #${ticketNumber} printed via QZ Tray to "${qzTarget}"!`,
          };
        }
      } catch (qzErr: any) {
        console.warn('QZ Tray bill print attempt failed, trying alternatives:', qzErr?.message);
      }
    }

    // When preferred type is Bluetooth or USB, skip RawBT WebSocket and Local HTTP Bridge to avoid timeout lag
    if (preferredType !== 'bluetooth' && preferredType !== 'usb') {
      const isAndroid = typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent);
      if (isAndroid) {
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
        } catch { }
      }

      // 4. Try Local HTTP Bridge on Windows (Port 9123 or user-configured bridge URL) only if explicitly configured
      const hasBridgeConfig = typeof window !== 'undefined' && Boolean(localStorage.getItem('qdine_printer_bridge_url') || localStorage.getItem('qdine_use_printer_bridge') === '1');
      if (hasBridgeConfig) {
        try {
          const bridgeUrl = options.localBridgeUrl || (typeof window !== 'undefined' && localStorage.getItem('qdine_printer_bridge_url')) || 'http://127.0.0.1:9123/print';
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 800);

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
        } catch { }
      }
    }
  }

  // 5. Fallback: Browser 80mm Thermal Receipt (via hidden iframe)
  const allowBrowserAutoPrintBill = typeof window !== 'undefined' && (
    localStorage.getItem('qdine_allow_browser_autoprint') === '1' ||
    localStorage.getItem('qdine_preferred_printer_type') === 'browser' ||
    localStorage.getItem('qdine_auto_print_browser') === 'true'
  );
  if (isAutoPrint && !forceBrowser && !allowBrowserAutoPrintBill) {
    console.warn(`[HardwarePrinter] Silent printer not reachable for bill. Browser print dialog suppressed for auto-print.`);
    return {
      success: false,
      method: 'browser',
      message: `Silent printer not connected for bill. Tap "Pair Bluetooth" in Settings, connect USB, or enable Browser Printing.`,
    };
  }

  let htmlToPrint = billHtml;
  if (!htmlToPrint && orderData) {
    htmlToPrint = generateBillTemplateHTML(orderData, {
      name: billData?.restaurantName || orderData.restaurant_name || 'Restaurant',
      logo_url: billData?.logoUrl || orderData.logo_url || orderData.restaurant_logo,
      address: billData?.address || orderData.restaurant_address,
      phone: billData?.phone || billData?.restaurantPhone || orderData.restaurant_phone,
      gst_number: billData?.gstNumber || orderData.restaurant_gst || orderData.gst_number,
      primary_color: billData?.primaryColor || orderData.primary_color,
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

export {
  isQzConnected,
  connectQzTray,
  disconnectQzTray,
  getQzPrinters,
  printRawEscposViaQz,
};


