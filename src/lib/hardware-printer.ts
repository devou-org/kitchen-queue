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
let activeUsbDevice: any = null;
let activeUsbEndpoint: number = 1;

// Deduplication map to prevent double-printing within 5 seconds
const recentPrintJobs = new Map<string, number>();

export function checkAndMarkDuplicatePrint(
  ticketNumber?: string | number,
  counterId?: string,
  counterName?: string,
  isTest?: boolean
): boolean {
  if (!ticketNumber) return false;
  const cleanCounter = (counterName || counterId || 'all').trim().toLowerCase();
  const isTestTicket = Boolean(isTest || ticketNumber === 999 || ticketNumber === '999');
  const threshold = isTestTicket ? 2000 : 6000;
  const now = Date.now();

  // 1. Cross-tab deduplication via localStorage
  if (typeof window !== 'undefined') {
    try {
      const lsKey = `qdine_print_dup_${ticketNumber}_${cleanCounter}`;
      const lastStr = localStorage.getItem(lsKey);
      if (lastStr) {
        const lastTime = parseInt(lastStr, 10);
        if (!isNaN(lastTime) && now - lastTime < threshold) {
          return true;
        }
      }
      localStorage.setItem(lsKey, String(now));
    } catch {}
  }

  // 2. In-memory deduplication for current tab
  const memKey = `${ticketNumber}_${cleanCounter}`;
  const lastTime = recentPrintJobs.get(memKey);
  if (lastTime && now - lastTime < threshold) {
    return true;
  }
  recentPrintJobs.set(memKey, now);

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
    } else {
      activeBtConnections.delete(counterId);
    }
  }

  // 2. Direct match by counter name
  const cleanCName = (counterName || '').trim().toLowerCase();
  if (cleanCName && activeBtConnections.has(cleanCName)) {
    const conn = activeBtConnections.get(cleanCName)!;
    if (conn.device?.gatt?.connected) {
      return { connected: true, deviceName: conn.name };
    } else {
      activeBtConnections.delete(cleanCName);
    }
  }

  // 3. Direct match by printer device name (e.g. Printer001)
  const cleanPrinterName = printerName?.trim();
  if (cleanPrinterName && cleanPrinterName.toUpperCase() !== 'POS-80C' && activeBtConnections.has(cleanPrinterName)) {
    const conn = activeBtConnections.get(cleanPrinterName)!;
    if (conn.device?.gatt?.connected) {
      return { connected: true, deviceName: conn.name };
    } else {
      activeBtConnections.delete(cleanPrinterName);
    }
  }

  // 4. Match via localStorage counter mapping (e.g. qdine_bt_counter_bakery -> Printer001)
  if (typeof window !== 'undefined') {
    const savedName = (cleanCName && localStorage.getItem(`qdine_bt_counter_${cleanCName}`))
      || (counterId && localStorage.getItem(`qdine_bt_counter_${counterId}`));
    if (savedName && activeBtConnections.has(savedName)) {
      const conn = activeBtConnections.get(savedName)!;
      if (conn.device?.gatt?.connected) {
        return { connected: true, deviceName: conn.name };
      }
    }
  }

  // 5. Station fallback: Automatically route to the station's connected Bluetooth printer
  if (activeBluetoothDevice?.gatt?.connected) {
    return { connected: true, deviceName: activeBluetoothDevice.name };
  }
  if (activeBtConnections.size > 0) {
    for (const conn of activeBtConnections.values()) {
      if (conn.device?.gatt?.connected) {
        return { connected: true, deviceName: conn.name };
      }
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
      localStorage.setItem('qdine_is_print_station', '1');
      localStorage.setItem('qdine_auto_print_kot', 'true');
      localStorage.setItem('qdine_auto_print_bill', 'true');
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
    targetConn = activeBtConnections.get(cleanName);
  } else if (activeBluetoothDevice) {
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

  const cleanPrinterName = targetPrinterName?.trim();
  if (!writeChar && cleanPrinterName && cleanPrinterName.toUpperCase() !== 'POS-80C' && activeBtConnections.has(cleanPrinterName)) {
    const conn = activeBtConnections.get(cleanPrinterName)!;
    if (conn.device?.gatt?.connected) {
      writeChar = conn.char;
      targetDevice = conn.device;
    }
  }

  // Match via localStorage counter mapping
  if (!writeChar && typeof window !== 'undefined') {
    const cleanC = (counterName || '').trim().toLowerCase();
    const savedName = (cleanC && localStorage.getItem(`qdine_bt_counter_${cleanC}`))
      || (counterId && localStorage.getItem(`qdine_bt_counter_${counterId}`));
    if (savedName && activeBtConnections.has(savedName)) {
      const conn = activeBtConnections.get(savedName)!;
      if (conn.device?.gatt?.connected && conn.char) {
        writeChar = conn.char;
        targetDevice = conn.device;
      }
    }
  }

  // Fall back to activeBluetoothDevice or any connected Bluetooth printer on this station
  if (!writeChar) {
    if (activeBluetoothChar && activeBluetoothDevice?.gatt?.connected) {
      writeChar = activeBluetoothChar;
      targetDevice = activeBluetoothDevice;
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

  if (!writeChar || !targetDevice?.gatt?.connected) {
    if (targetDevice?.gatt) {
      try {
        await targetDevice.gatt.connect();
      } catch (e) {
        throw new Error(`Bluetooth printer "${cleanPrinterName || counterName || 'Assigned Printer'}" is disconnected. Please re-pair in settings.`);
      }
    } else {
      throw new Error(`No Bluetooth printer connected for ${cleanPrinterName || counterName || 'this counter'}. Tap "Pair Bluetooth" to connect.`);
    }
  }

  // BLE MTU is usually 20-512 bytes. 180 bytes fits safely inside modern BLE MTU negotiation.
  const CHUNK_SIZE = 180;
  console.time('[Perf] Bluetooth write');
  console.log('[Perf] Bluetooth write start, bytes length:', bytes.length);

  try {
    for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
      const chunk = bytes.subarray(i, i + CHUNK_SIZE);
      if (writeChar.properties.writeWithoutResponse) {
        await writeChar.writeValueWithoutResponse(chunk);
        // Small 5ms pause to prevent thermal printer buffer overflow on fire-and-forget
        await new Promise((r) => setTimeout(r, 5));
      } else {
        await writeChar.writeValueWithResponse(chunk);
        // No artificial delay needed when device acknowledges receipt
      }
    }
  } finally {
    console.timeEnd('[Perf] Bluetooth write');
    console.log('[Perf] Bluetooth write end');
  }
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

    const devicesToConnect = targetDevice ? [targetDevice] : devices;
    let anyConnected = false;

    for (const dev of devicesToConnect) {
      if (!dev) continue;
      try {
        let server = dev.gatt;
        if (!server.connected) {
          server = await dev.gatt.connect();
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
          const deviceName = dev.name || 'Bluetooth Thermal Printer';
          const conn: ActiveBtConnection = { device: dev, char: writeChar, name: deviceName };
          activeBtConnections.set(deviceName, conn);

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

          dev.addEventListener('gattserverdisconnected', () => {
            console.log(`Bluetooth printer disconnected: ${deviceName}`);
            activeBtConnections.delete(deviceName);
            if (activeBluetoothDevice === dev) {
              activeBluetoothChar = null;
              activeBluetoothDevice = null;
            }
          });

          activeBluetoothDevice = dev;
          activeBluetoothChar = writeChar;
          anyConnected = true;
        }
      } catch {}
    }

    return anyConnected;
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
    } catch {}
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
  printerAddress?: string;
  counterId?: string;
  counterName?: string;
  forceBrowser?: boolean;
  isAutoPrint?: boolean; // When true, NEVER open the browser built-in print dialog/tab!
  isTest?: boolean;
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
  method: HardwarePrinterType;
  message?: string;
  duplicate?: boolean;
}> {
  const ticketNo = options.kotData?.ticketNumber;
  const isAddOn = Boolean(options.kotData?.isAddOn);
  const isTest = Boolean(
    options.isTest ||
    ticketNo === 999 ||
    ticketNo === '999' ||
    String(ticketNo).toLowerCase().includes('test') ||
    String(options.kotData?.customerName || '').toLowerCase().includes('test')
  );

  if (!isAddOn && ticketNo && checkAndMarkDuplicatePrint(ticketNo, options.counterId, options.counterName || options.kotData?.counterName, isTest)) {
    console.warn(`[HardwarePrinter] Duplicate print suppressed for Ticket #${ticketNo} (${options.counterName || options.counterId || 'ALL'})`);
    return Promise.resolve({
      success: false,
      duplicate: true,
      method: 'browser' as HardwarePrinterType,
      message: `Ticket #${ticketNo} already processed. Duplicate suppressed.`,
    });
  }
  return enqueuePrintJob(() => executePrintUnifiedThermalTicket(options));
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
    } catch {}
  }

  console.time('[Perf] Print execution');
  console.log('[Perf] Print start for ticket:', options.kotData?.ticketNumber);

  if (!forceBrowser && rawBytes) {
    const preferredType = typeof window !== 'undefined' ? localStorage.getItem('qdine_preferred_printer_type') : null;

    // Check if RawBT is explicitly preferred
    if (preferredType === 'rawbt' && base64Bytes) {
      const sent = printViaRawBt(base64Bytes);
      if (sent) {
        console.timeEnd('[Perf] Print execution');
        return {
          success: true,
          method: 'rawbt',
          message: `Sent directly to RawBT Android Print Service!`,
        };
      }
    }

    // 0. Try QZ Tray ONLY if actively connected (never probe QZ on Android or when QZ is closed, preventing 2-3s timeout lag)
    const isAndroid = typeof window !== 'undefined' && /android/i.test(navigator.userAgent);
    if (!isAndroid && base64Bytes && isQzConnected()) {
      try {
        const qzTarget = printerAddress?.trim() || printerName;
        const qzResult = await printRawEscposViaQz(qzTarget, base64Bytes);
        if (qzResult.success) {
          return {
            success: true,
            method: 'qz-tray',
            message: `Printed via QZ Tray to "${qzTarget}"!`,
          };
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

    // Fall back to any active Bluetooth printer on this station if no dedicated counter printer is configured
    if (!btCheck.connected) {
      if (activeBluetoothDevice?.gatt?.connected) {
        btCheck = { connected: true, deviceName: activeBluetoothDevice.name };
      } else if (activeBtConnections.size > 0) {
        for (const conn of activeBtConnections.values()) {
          if (conn.device?.gatt?.connected) {
            btCheck = { connected: true, deviceName: conn.name };
            break;
          }
        }
      }
    }

    if (btCheck.connected) {
      try {
        await writeBytesToBluetooth(rawBytes, printerName, counterId, counterName);
        console.timeEnd('[Perf] Print execution');
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
        console.timeEnd('[Perf] Print execution');
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
            console.timeEnd('[Perf] Print execution');
            return {
              success: true,
              method: 'rawbt',
              message: `Printed silently via RawBT Android Print Service!`,
            };
          }
        } catch {}
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
              console.timeEnd('[Perf] Print execution');
              return {
                success: true,
                method: 'serial',
                message: `Printed silently via local bridge to ${printerName}!`,
              };
            }
          }
        } catch {}
      }
    }
  }

  console.timeEnd('[Perf] Print execution');

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
  printerAddress?: string;
  printerType?: string;
  ticketNumber?: string | number;
  localBridgeUrl?: string;
  forceBrowser?: boolean;
  counterId?: string;
  counterName?: string;
  isAutoPrint?: boolean;
  isTest?: boolean;
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
}> {
  return enqueuePrintJob(() => executePrintUnifiedBill(options));
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
    } catch {}
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
    if (!isAndroidBill && (effType === 'QZ_TRAY' || (effType === 'DEFAULT' && isQzConnected())) && base64Bytes) {
      try {
        const qzTarget = printerName || 'POS-80C';
        const qzResult = await printRawEscposViaQz(qzTarget, base64Bytes);
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

    // When preferred type is Bluetooth, skip RawBT WebSocket and Local HTTP Bridge to avoid timeout lag
    if (preferredType !== 'bluetooth') {
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
  }

  // 5. Fallback: Browser 80mm Thermal Receipt (via hidden iframe)
  // When isAutoPrint is true and forceBrowser is false, NEVER open the browser print dialog!
  if (isAutoPrint && !forceBrowser) {
    console.warn(`[HardwarePrinter] Silent printer not reachable for bill. Browser print dialog suppressed for auto-print.`);
    return {
      success: false,
      method: 'browser',
      message: `Silent printer not connected for bill. Check printer connection in Settings.`,
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


