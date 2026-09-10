'use client';
import React, { useState, useEffect, useCallback } from 'react';
import {
  Printer,
  Bluetooth,
  BluetoothConnected,
  BluetoothOff,
  Usb,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Terminal,
  Loader2,
  Power,
  PowerOff,
  Info,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  connectBluetoothPrinter,
  disconnectBluetoothPrinter,
  connectSerialPrinter,
  disconnectSerialPrinter,
  getHardwarePrinterState,
  isBluetoothSupported,
  isSerialSupported,
  printUnifiedThermalTicket,
} from '@/lib/hardware-printer';

interface PrinterConnectionCardProps {
  restaurantName?: string;
  slug: string;
}

export function PrinterConnectionCard({ restaurantName = 'QDINE', slug }: PrinterConnectionCardProps) {
  const [btSupported, setBtSupported] = useState(false);
  const [serialSupported, setSerialSupported] = useState(false);

  const [hardwareState, setHardwareState] = useState({
    bluetoothConnected: false,
    bluetoothDeviceName: null as string | null,
    serialConnected: false,
    serialDeviceName: null as string | null,
  });

  const [printerName, setPrinterName] = useState('POS-80C');
  const [connectingBt, setConnectingBt] = useState(false);
  const [connectingSerial, setConnectingSerial] = useState(false);
  const [testingPrint, setTestingPrint] = useState(false);
  const [showKioskGuide, setShowKioskGuide] = useState(false);

  // Sync state
  const syncHardware = useCallback(() => {
    setHardwareState(getHardwarePrinterState());
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setBtSupported(isBluetoothSupported());
      setSerialSupported(isSerialSupported());
      syncHardware();

      const savedPrinter = localStorage.getItem('qdine_kot_printer_name');
      if (savedPrinter) setPrinterName(savedPrinter);
    }
  }, [syncHardware]);

  // Connect Bluetooth
  const handleConnectBluetooth = async () => {
    setConnectingBt(true);
    const toastId = toast.loading('Scanning for Bluetooth thermal printers...');
    try {
      const res = await connectBluetoothPrinter();
      if (res.success) {
        toast.success(`Connected to ${res.deviceName || 'Bluetooth Printer'}!`, { id: toastId });
        syncHardware();
      } else {
        toast.error(res.error || 'Bluetooth connection failed', { id: toastId });
      }
    } catch (err: any) {
      toast.error(err.message || 'Bluetooth connection cancelled', { id: toastId });
    } finally {
      setConnectingBt(false);
      syncHardware();
    }
  };

  // Disconnect Bluetooth
  const handleDisconnectBluetooth = async () => {
    await disconnectBluetoothPrinter();
    syncHardware();
    toast.success('Bluetooth printer disconnected');
  };

  // Connect USB / Serial
  const handleConnectSerial = async () => {
    setConnectingSerial(true);
    const toastId = toast.loading('Select your USB / COM printer...');
    try {
      const res = await connectSerialPrinter();
      if (res.success) {
        toast.success(`Connected to ${res.deviceName || 'USB Printer'}!`, { id: toastId });
        syncHardware();
      } else {
        toast.error(res.error || 'USB connection failed', { id: toastId });
      }
    } catch (err: any) {
      toast.error(err.message || 'USB connection cancelled', { id: toastId });
    } finally {
      setConnectingSerial(false);
      syncHardware();
    }
  };

  // Disconnect USB
  const handleDisconnectSerial = async () => {
    await disconnectSerialPrinter();
    syncHardware();
    toast.success('USB printer disconnected');
  };

  // Save printer name
  const handleSavePrinterSettings = (e: React.FormEvent) => {
    e.preventDefault();
    if (!printerName.trim()) {
      toast.error('Printer name cannot be empty');
      return;
    }
    localStorage.setItem('qdine_kot_printer_name', printerName.trim());
    toast.success('Printer configuration saved!');
  };

  // Send test print
  const handleSendTestPrint = async () => {
    setTestingPrint(true);
    const toastId = toast.loading('Printing test ticket to ' + printerName + '...');

    const testId = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : '00000000-0000-0000-0000-000000000999';

    const testOrder = {
      id: testId,
      ticket_number: 999,
      order_type: 'DINE_IN',
      table_number: 'TEST-01',
      customer_name: 'Hardware Test',
      staff_name: 'Admin',
      created_at: new Date().toISOString(),
      items: [
        { product_name: 'Bluetooth / USB Thermal Link', quantity: 1, counter: 'Counter 1' },
        { product_name: 'Direct ESC/POS Cut Test', quantity: 1, counter: 'Counter 1' },
      ],
      notes: 'Hardware connection verified successfully! 1-click silent KOT printing ready.',
    };

    try {
      // 1. Fetch ESC/POS compiled bytes from server
      const res = await fetch('/api/print/kot', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-restaurant-slug': slug,
        },
        body: JSON.stringify({
          orderId: testOrder.id,
          counterName: 'ALL',
          printerName: printerName.trim(),
          orderData: testOrder,
          slug,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to generate test print buffer');
      }

      // 2. Print via Hardware Dispatcher (Bluetooth -> USB -> Browser Driver)
      const printResult = await printUnifiedThermalTicket({
        base64Bytes: data.base64Bytes,
        kotData: data.kotData,
        printerName: printerName.trim(),
      });

      if (printResult.method === 'bluetooth') {
        toast.success(printResult.message || 'Test printed instantly via Bluetooth!', { id: toastId });
      } else if (printResult.method === 'serial') {
        toast.success(printResult.message || 'Test printed instantly via USB!', { id: toastId });
      } else {
        toast.success('Test print ticket opened in thermal driver!', { id: toastId });
      }
    } catch (err: any) {
      console.error('Test print failed:', err);
      toast.error(err.message || 'Test print failed. Check printer connection.', { id: toastId });
    } finally {
      setTestingPrint(false);
    }
  };

  return (
    <div
      className="card"
      style={{
        padding: '20px',
        borderRadius: '12px',
        background: '#FFFFFF',
        border: '1px solid #E2E8F0',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      }}
    >
      {/* Card Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '10px',
          marginBottom: '16px',
        }}
      >
        <div>
          <h2
            style={{
              fontSize: '16px',
              fontWeight: 800,
              color: '#0F172A',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              margin: 0,
            }}
          >
            <Printer size={18} style={{ color: 'var(--primary, #2563eb)' }} />
            Thermal Hardware Connections (Bluetooth & USB)
          </h2>
          <p style={{ fontSize: '12px', color: '#64748B', margin: '4px 0 0 0' }}>
            Pair wireless Bluetooth or USB thermal printers for direct, 1-click silent KOT printing.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            syncHardware();
            toast.success('Refreshed printer connections');
          }}
          className="btn btn-secondary btn-sm"
          style={{
            height: '30px',
            padding: '0 10px',
            fontSize: '12px',
            borderRadius: '8px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            fontWeight: 600,
          }}
          title="Refresh hardware status"
        >
          <RefreshCw size={13} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Hardware Connection Cards Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '14px',
          marginBottom: '20px',
        }}
      >
        {/* 1. Bluetooth Thermal Printer */}
        <div
          style={{
            padding: '16px',
            borderRadius: '10px',
            border: '1px solid',
            borderColor: hardwareState.bluetoothConnected ? '#BBF7D0' : '#E2E8F0',
            backgroundColor: hardwareState.bluetoothConnected ? '#F0FDF4' : '#F8FAFC',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  color: '#0F172A',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                {hardwareState.bluetoothConnected ? (
                  <BluetoothConnected size={16} style={{ color: '#16A34A' }} />
                ) : (
                  <Bluetooth size={16} style={{ color: '#2563EB' }} />
                )}
                Bluetooth Thermal Printer
              </span>

              {hardwareState.bluetoothConnected ? (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '11px',
                    fontWeight: 700,
                    color: '#15803D',
                    background: '#DCFCE7',
                    padding: '2px 8px',
                    borderRadius: '999px',
                  }}
                >
                  <CheckCircle2 size={12} /> Connected
                </span>
              ) : (
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    color: '#64748B',
                    background: '#E2E8F0',
                    padding: '2px 8px',
                    borderRadius: '999px',
                  }}
                >
                  Not Paired
                </span>
              )}
            </div>

            <p style={{ fontSize: '12px', color: '#475569', margin: '0 0 4px 0' }}>
              {hardwareState.bluetoothConnected
                ? `Active Device: ${hardwareState.bluetoothDeviceName || 'Thermal Printer'}`
                : 'Connect mobile or desktop Bluetooth thermal receipt printer.'}
            </p>
            <span style={{ fontSize: '11px', color: '#64748B' }}>
              Supported on Chrome & Edge (Android, Windows, Mac, Linux).
            </span>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {hardwareState.bluetoothConnected ? (
              <button
                type="button"
                onClick={handleDisconnectBluetooth}
                className="btn btn-secondary btn-sm"
                style={{
                  height: '32px',
                  fontSize: '12px',
                  borderRadius: '6px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  color: '#DC2626',
                }}
              >
                <PowerOff size={13} />
                <span>Disconnect</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleConnectBluetooth}
                disabled={connectingBt || !btSupported}
                className="btn btn-primary btn-sm"
                style={{
                  height: '32px',
                  fontSize: '12px',
                  fontWeight: 700,
                  borderRadius: '6px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                {connectingBt ? <Loader2 size={13} className="animate-spin" /> : <Bluetooth size={13} />}
                <span>{connectingBt ? 'Searching...' : 'Pair Bluetooth Printer'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleSendTestPrint}
              disabled={testingPrint}
              className="btn btn-secondary btn-sm"
              style={{
                height: '32px',
                fontSize: '12px',
                borderRadius: '6px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              <Printer size={13} />
              <span>Test</span>
            </button>
          </div>
        </div>

        {/* 2. USB / Serial Thermal Printer */}
        <div
          style={{
            padding: '16px',
            borderRadius: '10px',
            border: '1px solid',
            borderColor: hardwareState.serialConnected ? '#BBF7D0' : '#E2E8F0',
            backgroundColor: hardwareState.serialConnected ? '#F0FDF4' : '#F8FAFC',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  color: '#0F172A',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <Usb size={16} style={{ color: hardwareState.serialConnected ? '#16A34A' : '#64748B' }} />
                USB Thermal Printer (POS-80C)
              </span>

              {hardwareState.serialConnected ? (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '11px',
                    fontWeight: 700,
                    color: '#15803D',
                    background: '#DCFCE7',
                    padding: '2px 8px',
                    borderRadius: '999px',
                  }}
                >
                  <CheckCircle2 size={12} /> Connected
                </span>
              ) : (
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    color: '#64748B',
                    background: '#E2E8F0',
                    padding: '2px 8px',
                    borderRadius: '999px',
                  }}
                >
                  Not Connected
                </span>
              )}
            </div>

            <p style={{ fontSize: '12px', color: '#475569', margin: '0 0 4px 0' }}>
              {hardwareState.serialConnected
                ? `Active Device: ${hardwareState.serialDeviceName || 'POS-80C'}`
                : 'Connect thermal receipt printer via USB / COM cable directly.'}
            </p>
            <span style={{ fontSize: '11px', color: '#64748B' }}>
              Direct in-browser hardware access (Chrome / Edge on Windows & Mac).
            </span>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {hardwareState.serialConnected ? (
              <button
                type="button"
                onClick={handleDisconnectSerial}
                className="btn btn-secondary btn-sm"
                style={{
                  height: '32px',
                  fontSize: '12px',
                  borderRadius: '6px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  color: '#DC2626',
                }}
              >
                <PowerOff size={13} />
                <span>Disconnect</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleConnectSerial}
                disabled={connectingSerial || !serialSupported}
                className="btn btn-primary btn-sm"
                style={{
                  height: '32px',
                  fontSize: '12px',
                  fontWeight: 700,
                  borderRadius: '6px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                {connectingSerial ? <Loader2 size={13} className="animate-spin" /> : <Usb size={13} />}
                <span>{connectingSerial ? 'Connecting...' : 'Connect USB Printer'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleSendTestPrint}
              disabled={testingPrint}
              className="btn btn-secondary btn-sm"
              style={{
                height: '32px',
                fontSize: '12px',
                borderRadius: '6px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              <Printer size={13} />
              <span>Test</span>
            </button>
          </div>
        </div>
      </div>

      {/* Printer Configuration Form */}
      <form onSubmit={handleSavePrinterSettings} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '11px',
                fontWeight: 700,
                color: '#475569',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                marginBottom: '4px',
              }}
            >
              Thermal Printer Name / Model
            </label>
            <input
              type="text"
              value={printerName}
              onChange={(e) => setPrinterName(e.target.value)}
              placeholder="e.g. POS-80C, POS-80, Thermal"
              style={{
                width: '100%',
                padding: '9px 12px',
                border: '1px solid #CBD5E1',
                borderRadius: '8px',
                color: '#0F172A',
                fontSize: '13px',
                fontWeight: 600,
                boxSizing: 'border-box',
              }}
            />
            <span style={{ fontSize: '11px', color: '#64748B', marginTop: '3px', display: 'block' }}>
              Default thermal target for KOT routing and slip formatting.
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', marginTop: '4px' }}>
          <button
            type="submit"
            className="btn btn-primary btn-sm"
            style={{
              padding: '0 14px',
              height: '34px',
              fontSize: '12px',
              fontWeight: 700,
              borderRadius: '8px',
            }}
          >
            Save Configuration
          </button>

          <button
            type="button"
            onClick={handleSendTestPrint}
            disabled={testingPrint}
            className="btn btn-secondary btn-sm"
            style={{
              padding: '0 14px',
              height: '34px',
              fontSize: '12px',
              fontWeight: 600,
              borderRadius: '8px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            {testingPrint ? <Loader2 size={13} className="animate-spin" /> : <Printer size={13} />}
            <span>{testingPrint ? 'Sending Print...' : 'Send Test Print Slip'}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowKioskGuide(!showKioskGuide)}
            style={{
              background: 'none',
              border: 'none',
              padding: '0 6px',
              fontSize: '12px',
              fontWeight: 600,
              color: 'var(--primary, #2563eb)',
              cursor: 'pointer',
              textDecoration: 'underline',
              marginLeft: 'auto',
            }}
          >
            {showKioskGuide ? 'Hide Kiosk Guide' : 'How to set up 0-dialog silent kiosk printing?'}
          </button>
        </div>
      </form>

      {/* Chrome Kiosk Guide Accordion */}
      {showKioskGuide && (
        <div
          style={{
            marginTop: '16px',
            padding: '14px',
            borderRadius: '8px',
            background: '#F8FAFC',
            border: '1px solid #E2E8F0',
            fontSize: '12px',
            lineHeight: 1.6,
            color: '#334155',
          }}
        >
          <div
            style={{
              fontWeight: 700,
              color: '#0F172A',
              marginBottom: '6px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Terminal size={14} style={{ color: 'var(--primary, #2563eb)' }} />
            Windows Cashier PC: 1-Click Silent Kiosk Printing Setup
          </div>
          <p style={{ margin: '0 0 8px 0', color: '#64748B' }}>
            If your <strong>POS-80C</strong> is installed in Windows Settings as the default printer, Chrome and Edge
            support <strong>silent kiosk printing</strong> with zero popups:
          </p>
          <ol style={{ paddingLeft: '18px', margin: '6px 0 0 0' }}>
            <li>Set <strong>POS-80C</strong> as the Default Printer in Windows Settings → Printers & Scanners.</li>
            <li>Right-click your Chrome or Edge desktop shortcut, select <strong>Properties</strong>.</li>
            <li>In the <strong>Target</strong> field, append:
              <code
                style={{
                  background: '#EEF2F6',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  fontWeight: 700,
                  color: '#1E293B',
                  marginLeft: '4px',
                }}
              >
                --kiosk-printing
              </code>
            </li>
            <li>Now whenever you click <strong>"Print KOT"</strong>, the slip prints immediately to the POS-80C with <strong>zero print dialogs</strong>!</li>
          </ol>
        </div>
      )}
    </div>
  );
}
