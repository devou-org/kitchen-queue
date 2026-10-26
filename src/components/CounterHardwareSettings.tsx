'use client';
import React, { useState, useEffect, useCallback } from 'react';
import {
  Printer,
  Receipt,
  Bluetooth,
  BluetoothOff,
  Usb,
  Wifi,
  Play,
  Save,
  Check,
  Loader2,
  RefreshCw,
  Cpu,
  Edit2,
  List,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Counter } from '@/types';
import {
  connectBluetoothPrinter,
  disconnectBluetoothPrinter,
  connectSerialPrinter,
  disconnectSerialPrinter,
  isBluetoothConnectedForCounter,
  isSerialConnectedForCounter,
  printUnifiedThermalTicket,
  printUnifiedBill,
} from '@/lib/hardware-printer';
import {
  isQzConnected,
  connectQzTray,
  getQzPrinters,
  printRawEscposViaQz,
} from '@/lib/qz-printer';
import { CustomSelect, SelectOption } from '@/components/ui/CustomSelect';

const CONNECTION_OPTIONS: SelectOption[] = [
  { value: 'DEFAULT', label: 'System Default', icon: Printer },
  { value: 'QZ_TRAY', label: 'QZ Tray', icon: Cpu },
  { value: 'BLUETOOTH', label: 'Bluetooth', icon: Bluetooth },
  { value: 'USB', label: 'USB Cable', icon: Usb },
  { value: 'NETWORK', label: 'Network (LAN / Wi-Fi)', icon: Wifi },
];

interface CounterHardwareSettingsProps {
  slug: string;
  primaryColor?: string;
}

interface CounterFormState {
  printer_name: string;
  printer_type: string;
  printer_address: string;
}

export function CounterHardwareSettings({ slug, primaryColor = '#971345' }: CounterHardwareSettingsProps) {
  const [counters, setCounters] = useState<Counter[]>([]);
  const [loading, setLoading] = useState(true);
  const [formStates, setFormStates] = useState<Record<string, CounterFormState>>({});
  const [savingCounterId, setSavingCounterId] = useState<string | null>(null);
  const [savedCounterId, setSavedCounterId] = useState<string | null>(null);
  const [connectingCounterId, setConnectingCounterId] = useState<string | null>(null);
  const [testingCounterId, setTestingCounterId] = useState<string | null>(null);
  const [, setTick] = useState(0);

  // Default Bill Printer State
  const [billPrinter, setBillPrinter] = useState<CounterFormState>({
    printer_name: 'POS-80C',
    printer_type: 'DEFAULT',
    printer_address: '',
  });
  const [savingBillPrinter, setSavingBillPrinter] = useState(false);
  const [savedBillPrinter, setSavedBillPrinter] = useState(false);
  const [testingBillPrinter, setTestingBillPrinter] = useState(false);
  const [connectingBillBt, setConnectingBillBt] = useState(false);
  const [connectingBillUsb, setConnectingBillUsb] = useState(false);
  const [manualInputBillPrinter, setManualInputBillPrinter] = useState(false);

  // QZ Tray State
  const [qzActive, setQzActive] = useState(false);
  const [qzConnecting, setQzConnecting] = useState(false);
  const [systemPrinters, setSystemPrinters] = useState<string[]>([]);
  const [manualInputCounters, setManualInputCounters] = useState<Record<string, boolean>>({});

  const getHeaders = useCallback(() => {
    const token = typeof window !== 'undefined'
      ? (localStorage.getItem('admin_token') || localStorage.getItem('staff_token') || '')
      : '';
    return {
      'Content-Type': 'application/json',
      'x-restaurant-slug': slug,
      'Authorization': `Bearer ${token}`
    };
  }, [slug]);

  const checkQzStatus = useCallback(async (autoDiscover = true) => {
    if (typeof window === 'undefined') return;
    const connected = isQzConnected();
    setQzActive(connected);

    if (connected && autoDiscover) {
      const res = await getQzPrinters();
      if (res.success && res.printers.length > 0) {
        setSystemPrinters(res.printers);
      }
    }
  }, []);

  const handleConnectQz = async () => {
    setQzConnecting(true);
    const toastId = toast.loading('Connecting to local QZ Tray (localhost:8182)...');
    try {
      const conn = await connectQzTray();
      if (conn.success) {
        setQzActive(true);
        if (typeof window !== 'undefined') {
          localStorage.setItem('qdine_is_print_station', '1');
          localStorage.setItem('qdine_qz_active', '1');
          localStorage.setItem('qdine_auto_print_kot', 'true');
        }
        toast.success(`Connected to QZ Tray v${conn.version || '2.2'}!`, { id: toastId });
        // Auto discover printers
        const pRes = await getQzPrinters();
        if (pRes.success && pRes.printers.length > 0) {
          setSystemPrinters(pRes.printers);
          toast.success(`Detected ${pRes.printers.length} system printers`);
        }
      } else {
        setQzActive(false);
        toast.error(conn.error || 'QZ Tray is not running locally', { id: toastId });
      }
    } catch (err: any) {
      toast.error(err.message || 'QZ Tray connection failed', { id: toastId });
    } finally {
      setQzConnecting(false);
      setTick(t => t + 1);
    }
  };

  const handleDetectPrinters = async () => {
    setQzConnecting(true);
    const toastId = toast.loading('Scanning installed OS printers via QZ Tray...');
    try {
      const res = await getQzPrinters();
      if (res.success && res.printers.length > 0) {
        setSystemPrinters(res.printers);
        setQzActive(true);
        toast.success(`Found ${res.printers.length} installed printers!`, { id: toastId });
      } else {
        toast.error(res.error || 'No printers detected', { id: toastId });
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to detect printers', { id: toastId });
    } finally {
      setQzConnecting(false);
    }
  };

  const fetchCounters = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/counters', {
        headers: getHeaders()
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setCounters(data.data);
        const initialMap: Record<string, CounterFormState> = {};
        data.data.forEach((c: Counter) => {
          initialMap[c.id] = {
            printer_name: c.printer_name || 'POS-80C',
            printer_type: c.printer_type || 'DEFAULT',
            printer_address: c.printer_address || '',
          };
        });
        setFormStates(initialMap);
      }
    } catch {
      toast.error('Failed to load kitchen counters');
    } finally {
      setLoading(false);
    }
  }, [getHeaders]);

  const fetchBillPrinter = useCallback(async () => {
    let localName = typeof window !== 'undefined' ? localStorage.getItem('qdine_bill_printer_name') : null;
    let localType = typeof window !== 'undefined' ? localStorage.getItem('qdine_bill_printer_type') : null;
    let localAddr = typeof window !== 'undefined' ? localStorage.getItem('qdine_bill_printer_address') : null;

    try {
      const res = await fetch('/api/admin/bill-printer', { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.data) {
          const dbName = data.data.bill_printer_name;
          const dbType = data.data.bill_printer_type;
          const dbAddr = data.data.bill_printer_address;

          const chosenName = localName || dbName || 'POS-80C';
          const chosenType = (localType || dbType || 'DEFAULT').toUpperCase();
          const isNetwork = chosenType === 'NETWORK';
          const chosenAddr = isNetwork ? (localAddr !== null ? localAddr : (dbAddr || '')) : '';

          setBillPrinter({
            printer_name: chosenName,
            printer_type: chosenType,
            printer_address: chosenAddr,
          });

          if (typeof window !== 'undefined') {
            if (!localName && dbName) localStorage.setItem('qdine_bill_printer_name', dbName);
            if (!localType && dbType) localStorage.setItem('qdine_bill_printer_type', dbType);
            if (isNetwork && chosenAddr) {
              localStorage.setItem('qdine_bill_printer_address', chosenAddr);
            } else {
              localStorage.removeItem('qdine_bill_printer_address');
            }
          }
          return;
        }
      }
    } catch (e) {
      console.warn('Failed to fetch bill printer from server:', e);
    }

    const fallbackType = (localType || 'DEFAULT').toUpperCase();
    const isNetwork = fallbackType === 'NETWORK';
    const fallbackAddr = isNetwork ? (localAddr || '') : '';
    if (!isNetwork && typeof window !== 'undefined') {
      localStorage.removeItem('qdine_bill_printer_address');
    }

    setBillPrinter({
      printer_name: localName || 'POS-80C',
      printer_type: fallbackType,
      printer_address: fallbackAddr,
    });
  }, [getHeaders]);

  useEffect(() => {
    if (slug) {
      fetchCounters();
      fetchBillPrinter();
      checkQzStatus(true);
      connectQzTray(1)
        .then(res => {
          if (res.success) {
            setQzActive(true);
            getQzPrinters().then(pRes => {
              if (pRes.success && pRes.printers.length > 0) {
                setSystemPrinters(pRes.printers);
              }
            });
          }
        })
        .catch(() => {});
    }
  }, [slug, fetchCounters, fetchBillPrinter, checkQzStatus]);

  const handleSaveBillPrinter = async () => {
    setSavingBillPrinter(true);
    const isNetwork = billPrinter.printer_type === 'NETWORK';
    const pName = billPrinter.printer_name.trim() || 'POS-80C';
    const pAddr = isNetwork ? billPrinter.printer_address.trim() : '';

    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('qdine_bill_printer_name', pName);
        localStorage.setItem('qdine_bill_printer_type', billPrinter.printer_type);
        if (isNetwork && pAddr) {
          localStorage.setItem('qdine_bill_printer_address', pAddr);
        } else {
          localStorage.removeItem('qdine_bill_printer_address');
        }
      }

      const res = await fetch('/api/admin/bill-printer', {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({
          bill_printer_name: pName,
          bill_printer_type: billPrinter.printer_type,
          bill_printer_address: isNetwork ? (pAddr || null) : null,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.error || 'Saved locally, but failed to sync with server');
      } else {
        toast.success(`Default bill printer set to "${pName}" (${billPrinter.printer_type})!`);
      }

      setSavedBillPrinter(true);
      setTimeout(() => setSavedBillPrinter(false), 2000);
    } catch {
      toast.error('Saved locally. Network error updating server.');
    } finally {
      setSavingBillPrinter(false);
    }
  };

  const handlePairBillBluetooth = async () => {
    setConnectingBillBt(true);
    const toastId = toast.loading('Scanning Bluetooth printer for Bills...');
    try {
      const res = await connectBluetoothPrinter('bill_printer', 'Bill Printer');
      if (res.success && res.deviceName) {
        toast.success(`Paired "${res.deviceName}" as Default Bill Printer!`, { id: toastId });
        setBillPrinter(prev => ({
          ...prev,
          printer_name: res.deviceName || 'POS-80C',
          printer_type: 'BLUETOOTH',
          printer_address: '',
        }));
        if (typeof window !== 'undefined') {
          localStorage.setItem('qdine_bill_printer_name', res.deviceName || 'POS-80C');
          localStorage.setItem('qdine_bill_printer_type', 'BLUETOOTH');
          localStorage.removeItem('qdine_bill_printer_address');
        }
        await fetch('/api/admin/bill-printer', {
          method: 'PUT',
          headers: getHeaders(),
          body: JSON.stringify({
            bill_printer_name: res.deviceName || 'POS-80C',
            bill_printer_type: 'BLUETOOTH',
            bill_printer_address: null,
          }),
        }).catch(() => {});
        setTick(t => t + 1);
      } else {
        toast.error(res.error || 'Bluetooth pairing failed', { id: toastId });
      }
    } catch (err: any) {
      toast.error(err.message || 'Bluetooth connection cancelled', { id: toastId });
    } finally {
      setConnectingBillBt(false);
    }
  };

  const handleDisconnectBillBluetooth = async () => {
    try {
      await disconnectBluetoothPrinter('bill_printer', billPrinter.printer_name, 'Bill Printer');
      if (typeof window !== 'undefined') {
        localStorage.removeItem('qdine_bt_counter_bill_printer');
        localStorage.removeItem('qdine_bt_counter_bill printer');
        localStorage.removeItem('qdine_bill_printer_name');
        localStorage.removeItem('qdine_bt_printer_name');
      }
      setBillPrinter(prev => ({
        ...prev,
        printer_name: 'POS-80C',
      }));
      await fetch('/api/admin/bill-printer', {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({
          bill_printer_name: 'POS-80C',
          bill_printer_type: billPrinter.printer_type,
          bill_printer_address: null,
        }),
      }).catch(() => {});
      setTick(t => t + 1);
      toast.success('Disconnected Bluetooth bill printer');
    } catch (err: any) {
      console.error('Failed to disconnect Bluetooth bill printer:', err);
      toast.error('Failed to disconnect bill printer');
    }
  };

  const handleConnectBillUsb = async () => {
    setConnectingBillUsb(true);
    const toastId = toast.loading('Select USB / COM printer for Bills...');
    try {
      const res = await connectSerialPrinter('bill_printer');
      if (res.success) {
        const devName = res.deviceName || 'USB Thermal Bill Printer';
        toast.success(`Connected to ${devName}!`, { id: toastId });
        setBillPrinter(prev => ({
          ...prev,
          printer_name: devName,
          printer_type: 'USB',
          printer_address: '',
        }));
        if (typeof window !== 'undefined') {
          localStorage.setItem('qdine_bill_printer_name', devName);
          localStorage.setItem('qdine_bill_printer_type', 'USB');
          localStorage.removeItem('qdine_bill_printer_address');
        }
        await fetch('/api/admin/bill-printer', {
          method: 'PUT',
          headers: getHeaders(),
          body: JSON.stringify({
            bill_printer_name: devName,
            bill_printer_type: 'USB',
            bill_printer_address: null,
          }),
        }).catch(() => {});
        setTick(t => t + 1);
      } else {
        toast.error(res.error || 'USB connection failed', { id: toastId });
      }
    } catch (err: any) {
      toast.error(err.message || 'USB connection cancelled', { id: toastId });
    } finally {
      setConnectingBillUsb(false);
    }
  };

  const handleDisconnectBillUsb = async () => {
    try {
      await disconnectSerialPrinter('bill_printer', billPrinter.printer_name);
      if (typeof window !== 'undefined') {
        localStorage.removeItem('qdine_serial_counter_bill_printer');
        localStorage.removeItem('qdine_bill_printer_name');
        localStorage.removeItem('qdine_serial_printer_name');
      }
      setBillPrinter(prev => ({
        ...prev,
        printer_name: 'POS-80C',
      }));
      await fetch('/api/admin/bill-printer', {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({
          bill_printer_name: 'POS-80C',
          bill_printer_type: billPrinter.printer_type,
          bill_printer_address: null,
        }),
      }).catch(() => {});
      setTick(t => t + 1);
      toast.success('Disconnected USB bill printer');
    } catch (err: any) {
      console.error('Failed to disconnect USB bill printer:', err);
      toast.error('Failed to disconnect bill printer');
    }
  };

  const handleTestPrintBill = async () => {
    setTestingBillPrinter(true);
    const pName = (billPrinter.printer_name || 'POS-80C').trim();
    const isNetwork = billPrinter.printer_type === 'NETWORK';
    const toastId = toast.loading(`Sending test bill to default printer (${pName})...`);

    const testBillOrder = {
      id: 'test-bill-' + Date.now(),
      ticket_number: 999,
      order_type: 'DINE_IN',
      table_number: 'BILL-01',
      customer_name: 'Cashier Bill Verification',
      staff_name: 'Admin / Cashier',
      created_at: new Date().toISOString(),
      items: [
        { product_name: 'Default Bill Printer Verification', quantity: 1, price: 150 },
        { product_name: 'Direct ESC/POS Receipt Cut', quantity: 1, price: 50 },
      ],
      subtotal: 200,
      gst_type: 'NONE',
      gst_rate: 0,
      gst_amount: 0,
      total_price: 200,
      is_paid: true,
      payment_method: 'CASH',
      notes: `Default Bill Printer: ${pName} (${billPrinter.printer_type})`,
    };

    try {
      const res = await fetch('/api/print/bill', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          orderId: testBillOrder.id,
          printerName: pName,
          printerType: billPrinter.printer_type,
          orderData: testBillOrder,
          slug,
          isTest: true,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to generate test bill buffer');
      }

      if (data.mode === 'server') {
        toast.success(data.message || `Test bill sent to ${pName}!`, { id: toastId });
        return;
      }

      // Print directly using Unified Dispatcher honoring exact selected hardware type
      const printResult = await printUnifiedBill({
        base64Bytes: data.base64Bytes,
        billHtml: data.billHtml,
        orderData: testBillOrder,
        billData: data.billData,
        printerName: pName,
        printerAddress: isNetwork ? billPrinter.printer_address?.trim() : undefined,
        printerType: billPrinter.printer_type,
        ticketNumber: 999,
        counterId: 'bill_printer',
        counterName: 'Bill Printer',
        isTest: true,
      });

      if (printResult.method === 'bluetooth') {
        toast.success(printResult.message || `Test bill printed to Bluetooth printer "${pName}"!`, { id: toastId });
      } else if (printResult.method === 'serial') {
        toast.success(printResult.message || `Test bill printed to USB printer "${pName}"!`, { id: toastId });
      } else if (printResult.method === 'qz-tray') {
        toast.success(printResult.message || `Test bill printed via QZ Tray!`, { id: toastId });
      } else if (printResult.success) {
        toast.success(printResult.message || 'Test bill printed!', { id: toastId });
      } else {
        toast.error(printResult.message || 'Test bill print failed. Please verify Bluetooth/USB connection.', { id: toastId });
      }
    } catch (err: any) {
      console.error('Test bill print failed:', err);
      toast.error(err.message || 'Test bill print failed. Check printer connection.', { id: toastId });
    } finally {
      setTestingBillPrinter(false);
    }
  };

  const handleFieldChange = (counterId: string, field: keyof CounterFormState, value: string) => {
    setFormStates(prev => ({
      ...prev,
      [counterId]: {
        ...(prev[counterId] || { printer_name: 'POS-80C', printer_type: 'DEFAULT', printer_address: '' }),
        [field]: value
      }
    }));
  };

  const handleSaveCounter = async (counter: Counter) => {
    const form = formStates[counter.id] || {
      printer_name: counter.printer_name || 'POS-80C',
      printer_type: counter.printer_type || 'DEFAULT',
      printer_address: counter.printer_address || ''
    };

    setSavingCounterId(counter.id);
    try {
      const res = await fetch(`/api/counters/${counter.id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({
          name: counter.name,
          printer_name: form.printer_name.trim() || 'POS-80C',
          printer_type: form.printer_type,
          printer_address: form.printer_address.trim() || null,
          is_active: counter.is_active !== false,
        })
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Printer saved for ${counter.name}`);
        setSavedCounterId(counter.id);
        setTimeout(() => setSavedCounterId(null), 2000);
        setCounters(prev => prev.map(c => c.id === counter.id ? { ...c, ...form } : c));
        if (typeof window !== 'undefined') {
          if (form.printer_type === 'BLUETOOTH' && form.printer_name && form.printer_name !== 'POS-80C') {
            localStorage.setItem(`qdine_bt_counter_${counter.id}`, form.printer_name.trim());
            localStorage.setItem(`qdine_bt_counter_${counter.name.trim().toLowerCase()}`, form.printer_name.trim());
          } else {
            localStorage.removeItem(`qdine_bt_counter_${counter.id}`);
            localStorage.removeItem(`qdine_bt_counter_${counter.name.trim().toLowerCase()}`);
          }
        }
        setTick(t => t + 1);
      } else {
        toast.error(data.error || 'Failed to save printer settings');
      }
    } catch {
      toast.error('Network error saving printer settings');
    } finally {
      setSavingCounterId(null);
    }
  };

  const handlePairBluetooth = async (counter: Counter) => {
    setConnectingCounterId(counter.id);
    const toastId = toast.loading(`Scanning Bluetooth printer for ${counter.name}...`);
    try {
      const res = await connectBluetoothPrinter(counter.id, counter.name);
      if (res.success && res.deviceName) {
        toast.success(`Paired "${res.deviceName}" to ${counter.name}!`, { id: toastId });
        handleFieldChange(counter.id, 'printer_name', res.deviceName);
        handleFieldChange(counter.id, 'printer_type', 'BLUETOOTH');

        await fetch(`/api/counters/${counter.id}`, {
          method: 'PUT',
          headers: getHeaders(),
          body: JSON.stringify({
            name: counter.name,
            printer_name: res.deviceName,
            printer_type: 'BLUETOOTH',
            printer_address: null,
            is_active: counter.is_active !== false,
          })
        });
        setCounters(prev => prev.map(c => c.id === counter.id ? { ...c, printer_name: res.deviceName, printer_type: 'BLUETOOTH' } : c));
        setTick(t => t + 1);
      } else {
        toast.error(res.error || 'Bluetooth pairing failed', { id: toastId });
      }
    } catch (err: any) {
      toast.error(err.message || 'Bluetooth connection cancelled', { id: toastId });
    } finally {
      setConnectingCounterId(null);
    }
  };

  const handleDisconnectBluetooth = async (counter: Counter) => {
    await disconnectBluetoothPrinter(
      counter.id,
      formStates[counter.id]?.printer_name || counter.printer_name || undefined,
      counter.name
    );
    if (typeof window !== 'undefined') {
      localStorage.removeItem(`qdine_bt_counter_${counter.id}`);
      localStorage.removeItem(`qdine_bt_counter_${counter.name.trim().toLowerCase()}`);
    }
    setTick(t => t + 1);
    toast.success(`Disconnected Bluetooth printer from ${counter.name}`);
  };

  const handleConnectUsb = async (counter: Counter) => {
    setConnectingCounterId(counter.id);
    const toastId = toast.loading('Select USB / COM printer...');
    try {
      const res = await connectSerialPrinter(counter.id);
      if (res.success) {
        const devName = res.deviceName || 'USB Thermal Printer';
        toast.success(`Connected to ${devName}!`, { id: toastId });
        handleFieldChange(counter.id, 'printer_name', devName);
        handleFieldChange(counter.id, 'printer_type', 'USB');

        await fetch(`/api/counters/${counter.id}`, {
          method: 'PUT',
          headers: getHeaders(),
          body: JSON.stringify({
            name: counter.name,
            printer_name: devName,
            printer_type: 'USB',
            is_active: counter.is_active !== false,
          })
        });
        setCounters(prev => prev.map(c => c.id === counter.id ? { ...c, printer_name: devName, printer_type: 'USB' } : c));
        setTick(t => t + 1);
      } else {
        toast.error(res.error || 'USB connection failed', { id: toastId });
      }
    } catch (err: any) {
      toast.error(err.message || 'USB connection cancelled', { id: toastId });
    } finally {
      setConnectingCounterId(null);
    }
  };

  const handleDisconnectUsb = async (counter: Counter) => {
    await disconnectSerialPrinter(counter.id);
    setTick(t => t + 1);
    toast.success(`Disconnected USB printer from ${counter.name}`);
  };

  const handleTestPrint = async (counter: Counter) => {
    setTestingCounterId(counter.id);
    const form = formStates[counter.id] || {
      printer_name: counter.printer_name || 'POS-80C',
      printer_type: counter.printer_type || 'DEFAULT',
      printer_address: counter.printer_address || ''
    };
    const pName = (form.printer_name || 'POS-80C').trim();
    const toastId = toast.loading(`Sending test ticket to ${counter.name} (${pName})...`);

    const testId = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : 'test-' + Date.now();

    const testOrder = {
      id: testId,
      ticket_number: 999,
      order_type: 'DINE_IN',
      table_number: 'TEST-01',
      customer_name: `${counter.name} Test`,
      staff_name: 'Admin',
      created_at: new Date().toISOString(),
      items: [
        { product_name: 'Hardware Ticket Verification', quantity: 1, counter: counter.name },
        { product_name: 'Direct Thermal Cut', quantity: 1, counter: counter.name },
      ],
      notes: `Routing: ${counter.name} | Device: ${pName} (${form.printer_type})`,
    };

    try {
      const res = await fetch('/api/print/kot', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          orderId: testOrder.id,
          counterName: counter.name,
          printerName: pName,
          orderData: testOrder,
          slug,
          isTest: true,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to generate test print buffer');
      }

      // 1. Try QZ Tray ONLY if QZ Tray is configured or actively connected (never on Android or when QZ is closed)
      const isAndroid = typeof window !== 'undefined' && /android/i.test(navigator.userAgent);
      if (!isAndroid && data.base64Bytes && (form.printer_type === 'QZ_TRAY' || isQzConnected())) {
        const target = (form.printer_type === 'NETWORK' && form.printer_address?.trim())
          ? form.printer_address.trim()
          : pName;
        const qzPrintRes = await printRawEscposViaQz(target, data.base64Bytes);
        if (qzPrintRes.success) {
          toast.success(`Printed to ${counter.name} via QZ Tray!`, { id: toastId });
          return;
        }
      }

      if (data.mode === 'server') {
        toast.success(data.message || `Test print sent to ${pName}!`, { id: toastId });
        return;
      }

      // 3. Fallback kotData object to guarantee no undefined reference crashes
      const fallbackKotData = data.kotData || {
        restaurantName: 'QDINE',
        ticketNumber: testOrder.ticket_number,
        orderType: testOrder.order_type,
        tableNumber: testOrder.table_number,
        customerName: testOrder.customer_name,
        staffName: testOrder.staff_name,
        createdAt: testOrder.created_at,
        counterName: counter.name,
        items: testOrder.items,
        notes: testOrder.notes,
      };

      const printResult = await printUnifiedThermalTicket({
        base64Bytes: data.base64Bytes,
        kotData: fallbackKotData,
        printerName: pName,
        printerAddress: form.printer_type === 'NETWORK' ? form.printer_address?.trim() : undefined,
        counterId: counter.id,
        counterName: counter.name,
        isTest: true,
      });

      if (printResult.method === 'qz-tray') {
        toast.success(`Printed to ${counter.name} via QZ Tray!`, { id: toastId });
      } else if (printResult.method === 'bluetooth') {
        toast.success(printResult.message || `Printed to ${counter.name} via Bluetooth!`, { id: toastId });
      } else if (printResult.method === 'serial') {
        toast.success(printResult.message || `Printed to ${counter.name} via USB!`, { id: toastId });
      } else if (printResult.method === 'rawbt') {
        toast.success(printResult.message || `Printed to ${counter.name} via RawBT!`, { id: toastId });
      } else if (printResult.success) {
        toast.success('Test ticket opened in thermal driver!', { id: toastId });
      } else {
        toast.error(printResult.message || 'Test print failed', { id: toastId });
      }
    } catch (err: any) {
      console.error('Test print failed:', err);
      toast.error(err.message || 'Test print failed. Check printer connection.', { id: toastId });
    } finally {
      setTestingCounterId(null);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: '#64748B', fontSize: '13px' }}>
        <Loader2 size={16} className="animate-spin" />
        <span>Loading counter hardware configurations...</span>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* HTML5 Datalist for Auto-discovered OS Printers */}
      <datalist id="system-printers-datalist">
        {systemPrinters.map(p => (
          <option key={p} value={p} />
        ))}
      </datalist>

      {/* QZ Tray Status & Actions Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '8px',
          padding: '8px 12px',
          borderRadius: '8px',
          backgroundColor: qzActive ? '#F0FDF4' : '#F8FAFC',
          border: `1px solid ${qzActive ? '#BBF7D0' : '#E2E8F0'}`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: qzActive ? '#10B981' : '#94A3B8',
              flexShrink: 0,
            }}
          />
          <span style={{ fontSize: '12px', fontWeight: 700, color: qzActive ? '#15803D' : '#475569' }}>
            {qzActive ? 'QZ Tray Connected' : 'QZ Tray Standby'}
          </span>
          {systemPrinters.length > 0 && (
            <span style={{ fontSize: '11px', color: '#166534', fontWeight: 600 }}>
              ({systemPrinters.length} OS printers detected)
            </span>
          )}
          <a
            href="https://qz.io/download/"
            target="_blank"
            rel="noopener noreferrer"
            title="Download QZ Tray for desktop silent printing"
            style={{
              fontSize: '11px',
              color: '#2563EB',
              fontWeight: 600,
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '2px',
              padding: '2px 7px',
              borderRadius: '4px',
              backgroundColor: '#EFF6FF',
              border: '1px solid #DBEAFE',
              marginLeft: '2px',
            }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#DBEAFE')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#EFF6FF')}
          >
            Download QZ Tray ↗
          </a>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {!qzActive ? (
            <button
              type="button"
              onClick={handleConnectQz}
              disabled={qzConnecting}
              style={{
                padding: '4px 8px',
                borderRadius: '5px',
                border: '1px solid #CBD5E1',
                backgroundColor: '#FFFFFF',
                color: '#334155',
                fontSize: '11px',
                fontWeight: 600,
                cursor: qzConnecting ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              {qzConnecting ? <Loader2 size={11} className="animate-spin" /> : <Cpu size={11} />}
              <span>Connect QZ Tray</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleDetectPrinters}
              disabled={qzConnecting}
              style={{
                padding: '4px 8px',
                borderRadius: '5px',
                border: '1px solid #BBF7D0',
                backgroundColor: '#FFFFFF',
                color: '#15803D',
                fontSize: '11px',
                fontWeight: 600,
                cursor: qzConnecting ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              {qzConnecting ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
              <span>Detect Printers</span>
            </button>
          )}
        </div>
      </div>

      {/* ======================================================== */}
      {/* 1. DEFAULT BILL PRINTER SETTING (CASHIER / RECEIPT) */}
      {/* ======================================================== */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '10px',
          border: '1.5px solid #E2E8F0',
          padding: '14px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.03)',
        }}
      >
        {/* Header: Title, Description, and Live Status Badge */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: '#ECFDF5',
                color: '#059669',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Receipt size={17} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>
                  Bill Printer
                </span>
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: 600,
                    padding: '2px 7px',
                    borderRadius: '10px',
                    backgroundColor: '#F1F5F9',
                    color: '#475569',
                    border: '1px solid #E2E8F0',
                  }}
                >
                  Receipts
                </span>
              </div>
              <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: '#64748B' }}>
                Prints customer bills and receipts.
              </p>
            </div>
          </div>

          {/* Connection Status Indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {billPrinter.printer_type === 'QZ_TRAY' ? (
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '3px 8px',
                  borderRadius: '6px',
                  backgroundColor: qzActive ? '#EFF6FF' : '#F1F5F9',
                  color: qzActive ? '#1D4ED8' : '#64748B',
                  border: qzActive ? '1px solid #BFDBFE' : '1px solid #E2E8F0',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                }}
              >
                <Cpu size={12} />
                {qzActive ? 'QZ Tray Ready' : 'QZ Standby'}
              </span>
            ) : billPrinter.printer_type === 'BLUETOOTH' ? (
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '3px 8px',
                  borderRadius: '6px',
                  backgroundColor: isBluetoothConnectedForCounter('bill_printer', billPrinter.printer_name, 'Bill Printer').connected ? '#EFF6FF' : '#F1F5F9',
                  color: isBluetoothConnectedForCounter('bill_printer', billPrinter.printer_name, 'Bill Printer').connected ? '#2563EB' : '#64748B',
                  border: isBluetoothConnectedForCounter('bill_printer', billPrinter.printer_name, 'Bill Printer').connected ? '1px solid #DBEAFE' : '1px solid #E2E8F0',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                }}
              >
                <Bluetooth size={12} />
                {isBluetoothConnectedForCounter('bill_printer', billPrinter.printer_name, 'Bill Printer').connected ? 'Bluetooth Paired' : 'BT Standby'}
              </span>
            ) : billPrinter.printer_type === 'USB' ? (
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '3px 8px',
                  borderRadius: '6px',
                  backgroundColor: isSerialConnectedForCounter('bill_printer', billPrinter.printer_name).connected ? '#F0FDF4' : '#F1F5F9',
                  color: isSerialConnectedForCounter('bill_printer', billPrinter.printer_name).connected ? '#16A34A' : '#64748B',
                  border: isSerialConnectedForCounter('bill_printer', billPrinter.printer_name).connected ? '1px solid #DCFCE7' : '1px solid #E2E8F0',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                }}
              >
                <Usb size={12} />
                {isSerialConnectedForCounter('bill_printer', billPrinter.printer_name).connected ? 'USB Active' : 'USB Standby'}
              </span>
            ) : billPrinter.printer_type === 'NETWORK' ? (
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '3px 8px',
                  borderRadius: '6px',
                  backgroundColor: billPrinter.printer_address ? '#FAF5FF' : '#F1F5F9',
                  color: billPrinter.printer_address ? '#9333EA' : '#64748B',
                  border: billPrinter.printer_address ? '1px solid #F3E8FF' : '1px solid #E2E8F0',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                }}
              >
                <Wifi size={12} />
                LAN IP
              </span>
            ) : (
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  padding: '3px 8px',
                  borderRadius: '6px',
                  backgroundColor: '#F8FAFC',
                  color: '#64748B',
                  border: '1px solid #E2E8F0',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                }}
              >
                <Printer size={12} />
                System Default
              </span>
            )}
          </div>
        </div>

        {/* Configuration Row: Connection Type, Printer Device, Network IP */}
        <div style={{ display: 'grid', gridTemplateColumns: billPrinter.printer_type === 'NETWORK' ? '1fr 1.2fr 1fr' : '1fr 1.4fr', gap: '10px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: '4px' }}>
              Connection
            </label>
            <CustomSelect
              value={billPrinter.printer_type}
              onChange={(newType: string) => {
                setBillPrinter(prev => ({
                  ...prev,
                  printer_type: newType,
                  printer_address: newType === 'NETWORK' ? prev.printer_address : '',
                }));
                if (typeof window !== 'undefined') {
                  localStorage.setItem('qdine_bill_printer_type', newType);
                  if (newType !== 'NETWORK') {
                    localStorage.removeItem('qdine_bill_printer_address');
                  }
                }
              }}
              options={CONNECTION_OPTIONS}
              direction="auto"
              buttonStyle={{
                height: '32px',
                padding: '0 8px',
                fontSize: '12px',
                borderRadius: '6px',
                border: '1px solid #CBD5E1',
                fontWeight: 500,
              }}
              dropdownStyle={{
                zIndex: 100,
              }}
            />
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
              <label style={{ fontSize: '10px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>
                Printer Device
              </label>
              {systemPrinters.length > 0 && (
                <button
                  type="button"
                  onClick={() => setManualInputBillPrinter(prev => !prev)}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    fontSize: '10px',
                    color: '#2563EB',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '2px',
                    fontWeight: 600,
                  }}
                >
                  {manualInputBillPrinter ? (
                    <>
                      <List size={10} />
                      <span>Pick Detected</span>
                    </>
                  ) : (
                    <>
                      <Edit2 size={10} />
                      <span>Custom Name</span>
                    </>
                  )}
                </button>
              )}
            </div>

            {systemPrinters.length > 0 && !manualInputBillPrinter ? (
              <CustomSelect
                value={billPrinter.printer_name}
                onChange={(val: string) => {
                  setBillPrinter(prev => ({
                    ...prev,
                    printer_name: val,
                    printer_type: (prev.printer_type === 'BLUETOOTH') ? 'QZ_TRAY' : prev.printer_type,
                  }));
                }}
                options={[
                  ...(billPrinter.printer_name && !systemPrinters.includes(billPrinter.printer_name)
                    ? [{ value: billPrinter.printer_name, label: `${billPrinter.printer_name} (Current)`, icon: Printer }]
                    : []),
                  ...systemPrinters.map(p => ({ value: p, label: p, icon: Printer })),
                ]}
                placeholder="Select Printer..."
                direction="auto"
                buttonStyle={{
                  height: '32px',
                  padding: '0 8px',
                  fontSize: '12px',
                  borderRadius: '6px',
                  border: '1px solid #CBD5E1',
                  fontWeight: 500,
                }}
                dropdownStyle={{
                  zIndex: 100,
                }}
              />
            ) : (
              <input
                type="text"
                value={billPrinter.printer_name}
                onChange={e => setBillPrinter(prev => ({ ...prev, printer_name: e.target.value }))}
                placeholder={systemPrinters[0] || 'POS-80C'}
                style={{
                  width: '100%',
                  height: '32px',
                  padding: '6px 9px',
                  borderRadius: '6px',
                  border: '1px solid #CBD5E1',
                  fontSize: '12px',
                  color: '#0F172A',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            )}
          </div>

          {billPrinter.printer_type === 'NETWORK' && (
            <div>
              <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: '4px' }}>
                IP Address & Port
              </label>
              <input
                type="text"
                value={billPrinter.printer_address}
                onChange={e => setBillPrinter(prev => ({ ...prev, printer_address: e.target.value }))}
                placeholder="192.168.1.100:9100"
                style={{
                  width: '100%',
                  height: '32px',
                  padding: '6px 9px',
                  borderRadius: '6px',
                  border: '1px solid #CBD5E1',
                  fontSize: '12px',
                  fontFamily: 'monospace',
                  color: '#0F172A',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          )}
        </div>

        {/* Action Buttons: Pairing, Test Print Bill, Save */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', paddingTop: '4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {billPrinter.printer_type === 'QZ_TRAY' && !qzActive && (
              <>
                <button
                  type="button"
                  onClick={handleConnectQz}
                  disabled={qzConnecting}
                  style={{
                    padding: '4px 9px',
                    borderRadius: '5px',
                    border: '1px solid #BFDBFE',
                    backgroundColor: '#EFF6FF',
                    color: '#1D4ED8',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: qzConnecting ? 'not-allowed' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  {qzConnecting ? <Loader2 size={11} className="animate-spin" /> : <Cpu size={11} />}
                  <span>Connect QZ</span>
                </button>
                <a
                  href="https://qz.io/download/"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    padding: '4px 8px',
                    borderRadius: '5px',
                    border: '1px solid #E2E8F0',
                    backgroundColor: '#FFFFFF',
                    color: '#2563EB',
                    fontSize: '11px',
                    fontWeight: 600,
                    textDecoration: 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '3px',
                  }}
                >
                  Download QZ ↗
                </a>
              </>
            )}

            {billPrinter.printer_type === 'BLUETOOTH' && (
              isBluetoothConnectedForCounter('bill_printer', billPrinter.printer_name, 'Bill Printer').connected ? (
                <button
                  type="button"
                  onClick={handleDisconnectBillBluetooth}
                  style={{
                    padding: '4px 8px',
                    borderRadius: '5px',
                    border: '1px solid #FECACA',
                    backgroundColor: '#FEF2F2',
                    color: '#DC2626',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <BluetoothOff size={11} />
                  <span>Disconnect</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handlePairBillBluetooth}
                  disabled={connectingBillBt}
                  style={{
                    padding: '4px 9px',
                    borderRadius: '5px',
                    border: '1px solid #DBEAFE',
                    backgroundColor: '#EFF6FF',
                    color: '#2563EB',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: connectingBillBt ? 'not-allowed' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  {connectingBillBt ? <Loader2 size={11} className="animate-spin" /> : <Bluetooth size={11} />}
                  <span>Pair Bluetooth</span>
                </button>
              )
            )}

            {billPrinter.printer_type === 'USB' && (
              isSerialConnectedForCounter('bill_printer', billPrinter.printer_name).connected ? (
                <button
                  type="button"
                  onClick={handleDisconnectBillUsb}
                  style={{
                    padding: '4px 8px',
                    borderRadius: '5px',
                    border: '1px solid #E2E8F0',
                    backgroundColor: '#F8FAFC',
                    color: '#475569',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <Usb size={11} />
                  <span>Disconnect</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleConnectBillUsb}
                  disabled={connectingBillUsb}
                  style={{
                    padding: '4px 9px',
                    borderRadius: '5px',
                    border: '1px solid #DCFCE7',
                    backgroundColor: '#F0FDF4',
                    color: '#16A34A',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: connectingBillUsb ? 'not-allowed' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  {connectingBillUsb ? <Loader2 size={11} className="animate-spin" /> : <Usb size={11} />}
                  <span>Connect USB</span>
                </button>
              )
            )}

            {/* Test Print Bill Button */}
            <button
              type="button"
              onClick={handleTestPrintBill}
              disabled={testingBillPrinter}
              style={{
                padding: '4px 9px',
                borderRadius: '5px',
                border: '1px solid #E2E8F0',
                backgroundColor: '#FFFFFF',
                color: '#0F172A',
                fontSize: '11px',
                fontWeight: 600,
                cursor: testingBillPrinter ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              {testingBillPrinter ? (
                <Loader2 size={11} className="animate-spin" style={{ color: '#2563EB' }} />
              ) : (
                <Play size={10} style={{ fill: '#2563EB', color: '#2563EB' }} />
              )}
              <span>Test Print</span>
            </button>
          </div>

          {/* Save Button */}
          <button
            type="button"
            onClick={handleSaveBillPrinter}
            disabled={savingBillPrinter}
            style={{
              padding: '4px 11px',
              borderRadius: '5px',
              border: 'none',
              backgroundColor: savedBillPrinter ? '#16A34A' : primaryColor,
              color: '#FFFFFF',
              fontSize: '11px',
              fontWeight: 700,
              cursor: savingBillPrinter ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              transition: 'all 0.15s ease',
            }}
          >
            {savingBillPrinter ? (
              <Loader2 size={11} className="animate-spin" />
            ) : savedBillPrinter ? (
              <Check size={11} />
            ) : (
              <Save size={11} />
            )}
            <span>{savedBillPrinter ? 'Saved' : 'Save'}</span>
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 2. COUNTER PRINTER ROUTING (KITCHEN TICKETS / KOT)       */}
      {/* ======================================================== */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '6px', paddingBottom: '2px', borderTop: '1px solid #E2E8F0' }}>
        <span style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Kitchen Counter Ticket Routing ({counters.length})
        </span>
        <button
          type="button"
          onClick={() => {
            fetchCounters();
            fetchBillPrinter();
            checkQzStatus();
            setTick(t => t + 1);
            toast.success('Hardware refreshed');
          }}
          title="Refresh counters"
          style={{
            background: 'none',
            border: 'none',
            padding: '2px 6px',
            color: '#64748B',
            cursor: 'pointer',
            fontSize: '11px',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          <RefreshCw size={11} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Counter List or Empty State */}
      {counters.length === 0 ? (
        <div style={{ padding: '16px', background: '#F8FAFC', borderRadius: '8px', border: '1px dashed #CBD5E1', textAlign: 'center' }}>
          <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: '#475569' }}>
            No kitchen counters found
          </p>
          <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: '#94A3B8' }}>
            Add kitchen counters from the sidebar or orders page to route KOT tickets to specific station printers.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {counters.map(counter => {
          const form = formStates[counter.id] || {
            printer_name: counter.printer_name || 'POS-80C',
            printer_type: counter.printer_type || 'DEFAULT',
            printer_address: counter.printer_address || '',
          };

          const isQz = form.printer_type === 'QZ_TRAY';
          const isBt = form.printer_type === 'BLUETOOTH';
          const isUsb = form.printer_type === 'USB';
          const isNet = form.printer_type === 'NETWORK';

          const btConnected = isBluetoothConnectedForCounter(counter.id, form.printer_name, counter.name).connected;
          const usbConnected = isSerialConnectedForCounter(counter.id, form.printer_name).connected;

          const isSaving = savingCounterId === counter.id;
          const isSaved = savedCounterId === counter.id;
          const isConnecting = connectingCounterId === counter.id;
          const isTesting = testingCounterId === counter.id;

          return (
            <div
              key={counter.id}
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: '8px',
                border: '1px solid #E2E8F0',
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)',
              }}
            >
              {/* Header: Counter Name & Status Badge */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      backgroundColor: counter.is_active !== false ? '#10B981' : '#94A3B8',
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>
                    {counter.name}
                  </span>
                </div>

                {/* Connection Status Indicator */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {isQz ? (
                    <span
                      style={{
                        fontSize: '10px',
                        fontWeight: 700,
                        padding: '2px 6px',
                        borderRadius: '4px',
                        backgroundColor: qzActive ? '#EFF6FF' : '#F1F5F9',
                        color: qzActive ? '#1D4ED8' : '#64748B',
                        border: qzActive ? '1px solid #BFDBFE' : '1px solid #E2E8F0',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <Cpu size={10} />
                      {qzActive ? 'QZ Tray Active' : 'QZ Standby'}
                    </span>
                  ) : isBt ? (
                    <span
                      style={{
                        fontSize: '10px',
                        fontWeight: 700,
                        padding: '2px 6px',
                        borderRadius: '4px',
                        backgroundColor: btConnected ? '#EFF6FF' : '#F1F5F9',
                        color: btConnected ? '#2563EB' : '#64748B',
                        border: btConnected ? '1px solid #DBEAFE' : '1px solid #E2E8F0',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <Bluetooth size={10} />
                      {btConnected ? 'Bluetooth Paired' : 'BT Standby'}
                    </span>
                  ) : isUsb ? (
                    <span
                      style={{
                        fontSize: '10px',
                        fontWeight: 700,
                        padding: '2px 6px',
                        borderRadius: '4px',
                        backgroundColor: usbConnected ? '#F0FDF4' : '#F1F5F9',
                        color: usbConnected ? '#16A34A' : '#64748B',
                        border: usbConnected ? '1px solid #DCFCE7' : '1px solid #E2E8F0',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <Usb size={10} />
                      {usbConnected ? 'USB Active' : 'USB Standby'}
                    </span>
                  ) : isNet ? (
                    <span
                      style={{
                        fontSize: '10px',
                        fontWeight: 700,
                        padding: '2px 6px',
                        borderRadius: '4px',
                        backgroundColor: form.printer_address ? '#FAF5FF' : '#F1F5F9',
                        color: form.printer_address ? '#9333EA' : '#64748B',
                        border: form.printer_address ? '1px solid #F3E8FF' : '1px solid #E2E8F0',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <Wifi size={10} />
                      LAN IP
                    </span>
                  ) : (
                    <span
                      style={{
                        fontSize: '10px',
                        fontWeight: 600,
                        padding: '2px 6px',
                        borderRadius: '4px',
                        backgroundColor: '#F8FAFC',
                        color: '#64748B',
                        border: '1px solid #E2E8F0',
                      }}
                    >
                      System Default
                    </span>
                  )}
                </div>
              </div>

              {/* Minimal Configuration Row */}
              <div style={{ display: 'grid', gridTemplateColumns: isNet ? '1fr 1fr 1fr' : '1fr 1.4fr', gap: '8px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: '3px' }}>
                    Connection
                  </label>
                  <CustomSelect
                    value={form.printer_type}
                    onChange={(newType: string) => handleFieldChange(counter.id, 'printer_type', newType)}
                    options={CONNECTION_OPTIONS}
                    direction="auto"
                    buttonStyle={{
                      height: '32px',
                      padding: '0 8px',
                      fontSize: '12px',
                      borderRadius: '6px',
                      border: '1px solid #CBD5E1',
                      fontWeight: 500,
                    }}
                    dropdownStyle={{
                      zIndex: 100,
                    }}
                  />
                </div>

                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '3px' }}>
                    <label style={{ fontSize: '10px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>
                      Printer Device
                    </label>
                    {systemPrinters.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setManualInputCounters(prev => ({ ...prev, [counter.id]: !prev[counter.id] }))}
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: 0,
                          fontSize: '10px',
                          color: '#2563EB',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '2px',
                          fontWeight: 600,
                        }}
                      >
                        {manualInputCounters[counter.id] ? (
                          <>
                            <List size={10} />
                            <span>Pick Detected</span>
                          </>
                        ) : (
                          <>
                            <Edit2 size={10} />
                            <span>Custom</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>

                  {systemPrinters.length > 0 && !manualInputCounters[counter.id] ? (
                    <CustomSelect
                      value={form.printer_name}
                      onChange={(val: string) => {
                        handleFieldChange(counter.id, 'printer_name', val);
                        if (val && form.printer_type === 'BLUETOOTH') {
                          handleFieldChange(counter.id, 'printer_type', 'QZ_TRAY');
                        }
                      }}
                      options={[
                        ...(form.printer_name && !systemPrinters.includes(form.printer_name)
                          ? [{ value: form.printer_name, label: `${form.printer_name} (Current)`, icon: Printer }]
                          : []),
                        ...systemPrinters.map(p => ({ value: p, label: p, icon: Printer })),
                      ]}
                      placeholder="Select Printer..."
                      direction="auto"
                      buttonStyle={{
                        height: '32px',
                        padding: '0 8px',
                        fontSize: '12px',
                        borderRadius: '6px',
                        border: '1px solid #CBD5E1',
                        fontWeight: 500,
                      }}
                      dropdownStyle={{
                        zIndex: 100,
                      }}
                    />
                  ) : (
                    <input
                      type="text"
                      value={form.printer_name}
                      onChange={e => handleFieldChange(counter.id, 'printer_name', e.target.value)}
                      placeholder={systemPrinters[0] || 'POS-80C'}
                      style={{
                        width: '100%',
                        height: '32px',
                        padding: '6px 8px',
                        borderRadius: '6px',
                        border: '1px solid #CBD5E1',
                        fontSize: '12px',
                        color: '#0F172A',
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                  )}
                </div>

                {isNet && (
                  <div>
                    <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: '3px' }}>
                      IP Address & Port
                    </label>
                    <input
                      type="text"
                      value={form.printer_address}
                      onChange={e => handleFieldChange(counter.id, 'printer_address', e.target.value)}
                      placeholder="192.168.1.100:9100"
                      style={{
                        width: '100%',
                        height: '32px',
                        padding: '6px 8px',
                        borderRadius: '6px',
                        border: '1px solid #CBD5E1',
                        fontSize: '12px',
                        fontFamily: 'monospace',
                        color: '#0F172A',
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Action Buttons Row */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', paddingTop: '2px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {isQz ? (
                    !qzActive ? (
                      <>
                        <button
                          type="button"
                          onClick={handleConnectQz}
                          disabled={qzConnecting}
                          style={{
                            padding: '4px 9px',
                            borderRadius: '5px',
                            border: '1px solid #BFDBFE',
                            backgroundColor: '#EFF6FF',
                            color: '#1D4ED8',
                            fontSize: '11px',
                            fontWeight: 600,
                            cursor: qzConnecting ? 'not-allowed' : 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          {qzConnecting ? <Loader2 size={11} className="animate-spin" /> : <Cpu size={11} />}
                          <span>Connect QZ</span>
                        </button>
                        <a
                          href="https://qz.io/download/"
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            padding: '4px 8px',
                            borderRadius: '5px',
                            border: '1px solid #E2E8F0',
                            backgroundColor: '#FFFFFF',
                            color: '#2563EB',
                            fontSize: '11px',
                            fontWeight: 600,
                            textDecoration: 'none',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                          }}
                        >
                          Download QZ ↗
                        </a>
                      </>
                    ) : null
                  ) : isBt ? (
                    btConnected ? (
                      <button
                        type="button"
                        onClick={() => handleDisconnectBluetooth(counter)}
                        style={{
                          padding: '4px 8px',
                          borderRadius: '5px',
                          border: '1px solid #FECACA',
                          backgroundColor: '#FEF2F2',
                          color: '#DC2626',
                          fontSize: '11px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <BluetoothOff size={11} />
                        <span>Disconnect</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handlePairBluetooth(counter)}
                        disabled={isConnecting}
                        style={{
                          padding: '4px 9px',
                          borderRadius: '5px',
                          border: '1px solid #DBEAFE',
                          backgroundColor: '#EFF6FF',
                          color: '#2563EB',
                          fontSize: '11px',
                          fontWeight: 600,
                          cursor: isConnecting ? 'not-allowed' : 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        {isConnecting ? <Loader2 size={11} className="animate-spin" /> : <Bluetooth size={11} />}
                        <span>Pair Bluetooth</span>
                      </button>
                    )
                  ) : isUsb ? (
                    usbConnected ? (
                      <button
                        type="button"
                        onClick={() => handleDisconnectUsb(counter)}
                        style={{
                          padding: '4px 8px',
                          borderRadius: '5px',
                          border: '1px solid #E2E8F0',
                          backgroundColor: '#F8FAFC',
                          color: '#475569',
                          fontSize: '11px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <Usb size={11} />
                        <span>Disconnect</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleConnectUsb(counter)}
                        disabled={isConnecting}
                        style={{
                          padding: '4px 9px',
                          borderRadius: '5px',
                          border: '1px solid #DCFCE7',
                          backgroundColor: '#F0FDF4',
                          color: '#16A34A',
                          fontSize: '11px',
                          fontWeight: 600,
                          cursor: isConnecting ? 'not-allowed' : 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        {isConnecting ? <Loader2 size={11} className="animate-spin" /> : <Usb size={11} />}
                        <span>Connect USB</span>
                      </button>
                    )
                  ) : null}

                  {/* Test Print Button */}
                  <button
                    type="button"
                    onClick={() => handleTestPrint(counter)}
                    disabled={isTesting}
                    style={{
                      padding: '4px 9px',
                      borderRadius: '5px',
                      border: '1px solid #E2E8F0',
                      backgroundColor: '#FFFFFF',
                      color: '#0F172A',
                      fontSize: '11px',
                      fontWeight: 600,
                      cursor: isTesting ? 'not-allowed' : 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    {isTesting ? (
                      <Loader2 size={11} className="animate-spin" style={{ color: '#2563EB' }} />
                    ) : (
                      <Play size={10} style={{ fill: '#2563EB', color: '#2563EB' }} />
                    )}
                    <span>Test Print</span>
                  </button>
                </div>

                {/* Save Button */}
                <button
                  type="button"
                  onClick={() => handleSaveCounter(counter)}
                  disabled={isSaving}
                  style={{
                    padding: '4px 11px',
                    borderRadius: '5px',
                    border: 'none',
                    backgroundColor: isSaved ? '#16A34A' : primaryColor,
                    color: '#FFFFFF',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: isSaving ? 'not-allowed' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {isSaving ? (
                    <Loader2 size={11} className="animate-spin" />
                  ) : isSaved ? (
                    <Check size={11} />
                  ) : (
                    <Save size={11} />
                  )}
                  <span>{isSaved ? 'Saved' : 'Save'}</span>
                </button>
              </div>
            </div>
          );
        })}
        </div>
      )}
    </div>
  );
}
