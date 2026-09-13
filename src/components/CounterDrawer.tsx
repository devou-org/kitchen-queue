'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Plus,
  Edit2,
  Trash2,
  Check,
  Loader2,
  Store,
  Printer,
  ChevronDown,
  ChevronUp,
  Bluetooth,
  BluetoothOff,
  Usb,
  RefreshCw,
  CheckCircle2,
  Wifi,
  Play,
  HelpCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Counter } from '@/types';
import {
  connectBluetoothPrinter,
  disconnectBluetoothPrinter,
  connectSerialPrinter,
  disconnectSerialPrinter,
  getHardwarePrinterState,
  isBluetoothSupported,
  isSerialSupported,
  isBluetoothConnectedForCounter,
  isSerialConnectedForCounter,
  printUnifiedThermalTicket,
} from '@/lib/hardware-printer';

interface CounterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  slug: string;
  onCountersChange?: () => void;
}

export function CounterDrawer({ isOpen, onClose, slug, onCountersChange }: CounterDrawerProps) {
  const [mounted, setMounted] = useState(false);
  const [counters, setCounters] = useState<Counter[]>([]);
  const [loading, setLoading] = useState(false);

  // Hardware Connection State
  const [btSupported, setBtSupported] = useState(false);
  const [serialSupported, setSerialSupported] = useState(false);
  const [hardwareState, setHardwareState] = useState({
    bluetoothConnected: false,
    bluetoothDeviceName: null as string | null,
    serialConnected: false,
    serialDeviceName: null as string | null,
  });
  const [connectingBt, setConnectingBt] = useState(false);
  const [connectingSerial, setConnectingSerial] = useState(false);
  const [connectingCounterId, setConnectingCounterId] = useState<string | null>(null);
  const [connectingSerialCounterId, setConnectingSerialCounterId] = useState<string | null>(null);
  const [testingCounterId, setTestingCounterId] = useState<string | null>(null);

  // New counter state
  const [newCounterName, setNewCounterName] = useState('');
  const [newPrinterName, setNewPrinterName] = useState('POS-80C');
  const [newPrinterType, setNewPrinterType] = useState('DEFAULT');
  const [newPrinterAddress, setNewPrinterAddress] = useState('');
  const [showPrinterSettings, setShowPrinterSettings] = useState(false);
  const [adding, setAdding] = useState(false);

  // Inline editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editingPrinterName, setEditingPrinterName] = useState('POS-80C');
  const [editingPrinterType, setEditingPrinterType] = useState('DEFAULT');
  const [editingPrinterAddress, setEditingPrinterAddress] = useState('');
  const [editingActive, setEditingActive] = useState(true);
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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

  const syncHardware = useCallback(() => {
    if (typeof window !== 'undefined') {
      setBtSupported(isBluetoothSupported());
      setSerialSupported(isSerialSupported());
      setHardwareState(getHardwarePrinterState());
    }
  }, []);

  const fetchCounters = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/counters', {
        headers: getHeaders()
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setCounters(data.data);
      }
    } catch {
      toast.error('Failed to load counters');
    } finally {
      setLoading(false);
    }
  }, [getHeaders]);

  useEffect(() => {
    if (isOpen) {
      fetchCounters();
      syncHardware();
      setEditingId(null);
      setNewCounterName('');
      setNewPrinterName('POS-80C');
      setNewPrinterType('DEFAULT');
      setNewPrinterAddress('');
      setShowPrinterSettings(false);
    }
  }, [isOpen, fetchCounters, syncHardware]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Hardware connection handlers
  const handleConnectBluetooth = async (counter?: Counter) => {
    if (counter) {
      setConnectingCounterId(counter.id);
    } else {
      setConnectingBt(true);
    }

    const toastId = toast.loading(
      counter ? `Scanning Bluetooth printer for ${counter.name}...` : 'Scanning for Bluetooth thermal printers...'
    );

    try {
      const res = await connectBluetoothPrinter(counter?.id);
      if (res.success && res.deviceName) {
        toast.success(
          counter
            ? `Paired "${res.deviceName}" to ${counter.name}!`
            : `Connected to ${res.deviceName}!`,
          { id: toastId }
        );

        // If connected for a counter and the printer name is new, update counter in DB
        if (counter && res.deviceName !== counter.printer_name) {
          try {
            await fetch(`/api/counters/${counter.id}`, {
              method: 'PUT',
              headers: getHeaders(),
              body: JSON.stringify({
                name: counter.name,
                printer_name: res.deviceName,
                printer_type: 'BLUETOOTH',
                printer_address: counter.printer_address || null,
                is_active: counter.is_active !== false,
              }),
            });
            await fetchCounters();
            onCountersChange?.();
          } catch {}
        }
        syncHardware();
      } else {
        toast.error(res.error || 'Bluetooth connection failed', { id: toastId });
      }
    } catch (err: any) {
      toast.error(err.message || 'Bluetooth connection cancelled', { id: toastId });
    } finally {
      setConnectingBt(false);
      setConnectingCounterId(null);
      syncHardware();
    }
  };

  const handleDisconnectBluetooth = async (counter?: Counter) => {
    await disconnectBluetoothPrinter(counter?.id, counter?.printer_name || undefined);
    syncHardware();
    toast.success(counter ? `Bluetooth printer disconnected from ${counter.name}` : 'Bluetooth printer disconnected');
  };

  const handleConnectSerial = async (counter?: Counter) => {
    if (counter) {
      setConnectingSerialCounterId(counter.id);
    } else {
      setConnectingSerial(true);
    }

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
      setConnectingSerialCounterId(null);
      syncHardware();
    }
  };

  const handleDisconnectSerial = async (counter?: Counter) => {
    await disconnectSerialPrinter(counter?.id);
    syncHardware();
    toast.success(counter ? `USB printer disconnected from ${counter.name}` : 'USB printer disconnected');
  };

  const handleTestPrint = async (counter: Counter) => {
    setTestingCounterId(counter.id);
    const pName = (counter.printer_name || 'POS-80C').trim();
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
        { product_name: 'Direct ESC/POS Thermal Cut', quantity: 1, counter: counter.name },
      ],
      notes: `Routing to: ${counter.name} | Device: ${pName} (${counter.printer_type || 'DEFAULT'})`,
    };

    try {
      const res = await fetch('/api/print/kot', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-restaurant-slug': slug,
        },
        body: JSON.stringify({
          orderId: testOrder.id,
          counterName: counter.name,
          printerName: pName,
          orderData: testOrder,
          slug,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to generate test print buffer');
      }

      const printResult = await printUnifiedThermalTicket({
        base64Bytes: data.base64Bytes,
        kotData: data.kotData,
        printerName: pName,
        counterId: counter.id,
      });

      if (printResult.method === 'bluetooth') {
        toast.success(printResult.message || `Printed to ${counter.name} via Bluetooth!`, { id: toastId });
      } else if (printResult.method === 'serial') {
        toast.success(printResult.message || `Printed to ${counter.name} via USB!`, { id: toastId });
      } else if (printResult.method === 'rawbt') {
        toast.success(printResult.message || `Printed to ${counter.name} via RawBT!`, { id: toastId });
      } else {
        toast.success('Test print ticket opened in thermal driver!', { id: toastId });
      }
    } catch (err: any) {
      console.error('Test print failed:', err);
      toast.error(err.message || 'Test print failed. Check printer connection.', { id: toastId });
    } finally {
      setTestingCounterId(null);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newCounterName.trim();
    if (!trimmed) {
      toast.error('Counter name is required');
      return;
    }

    if (counters.some(c => c.name.toLowerCase() === trimmed.toLowerCase())) {
      toast.error('Counter with this name already exists');
      return;
    }

    setAdding(true);
    try {
      const res = await fetch('/api/counters', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          name: trimmed,
          printer_name: newPrinterName.trim() || 'POS-80C',
          printer_type: newPrinterType,
          printer_address: newPrinterAddress.trim() || null,
        })
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Counter "${trimmed}" created!`);
        setNewCounterName('');
        setNewPrinterName('POS-80C');
        setNewPrinterType('DEFAULT');
        setNewPrinterAddress('');
        setShowPrinterSettings(false);
        await fetchCounters();
        onCountersChange?.();
      } else {
        toast.error(data.error || 'Failed to add counter');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setAdding(false);
    }
  };

  const handleStartEdit = (counter: Counter) => {
    setEditingId(counter.id);
    setEditingName(counter.name);
    setEditingPrinterName(counter.printer_name || 'POS-80C');
    setEditingPrinterType(counter.printer_type || 'DEFAULT');
    setEditingPrinterAddress(counter.printer_address || '');
    setEditingActive(counter.is_active !== false);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingName('');
  };

  const handleSaveEdit = async (id: string) => {
    const trimmed = editingName.trim();
    if (!trimmed) {
      toast.error('Counter name cannot be empty');
      return;
    }

    setSavingEdit(true);
    try {
      const res = await fetch(`/api/counters/${id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({
          name: trimmed,
          printer_name: editingPrinterName.trim() || 'POS-80C',
          printer_type: editingPrinterType,
          printer_address: editingPrinterAddress.trim() || null,
          is_active: editingActive
        })
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Counter updated successfully');
        setEditingId(null);
        await fetchCounters();
        onCountersChange?.();
      } else {
        toast.error(data.error || 'Failed to update counter');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"? Products assigned to it will remain unassigned.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/counters/${id}`, {
        method: 'DELETE',
        headers: getHeaders()
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Counter deleted');
        await fetchCounters();
        onCountersChange?.();
      } else {
        toast.error(data.error || 'Failed to delete counter');
      }
    } catch {
      toast.error('Network error');
    }
  };

  if (!mounted || !isOpen) return null;

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 99999 }}>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.45)',
          backdropFilter: 'blur(2px)',
          transition: 'opacity 0.2s ease',
        }}
      />

      {/* Slide-over Drawer Panel */}
      <aside
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: '620px',
          maxWidth: '100vw',
          height: '100vh',
          background: '#FFFFFF',
          boxShadow: '-8px 0 32px rgba(0, 0, 0, 0.16)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 100000,
          boxSizing: 'border-box',
          animation: 'slideInRight 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <style>{`
          @keyframes slideInRight {
            from { transform: translateX(100%); }
            to { transform: translateX(0); }
          }
        `}</style>

        {/* 1. Header */}
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid var(--border, #E2E8F0)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#FFFFFF',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                backgroundColor: '#EFF6FF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#2563EB',
                border: '1px solid #DBEAFE',
              }}
            >
              <Printer size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: '17px', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                Kitchen Counters & Hardware
              </h2>
              <p style={{ fontSize: '12px', color: '#64748B', margin: '3px 0 0 0' }}>
                Connect thermal printers, manage counters, and test KOT routing
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              padding: '8px',
              borderRadius: '8px',
              cursor: 'pointer',
              color: '#64748B',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#F8FAFC',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* 2. Global Hardware Status Banner */}
        <div
          style={{
            padding: '12px 24px',
            backgroundColor: '#F8FAFC',
            borderBottom: '1px solid #E2E8F0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '10px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
            {/* Bluetooth State */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: hardwareState.bluetoothConnected ? '#10B981' : '#CBD5E1',
                }}
              />
              <span style={{ fontWeight: 600, color: hardwareState.bluetoothConnected ? '#0F172A' : '#64748B' }}>
                Bluetooth:
              </span>
              {hardwareState.bluetoothConnected ? (
                <span style={{ color: '#16A34A', fontWeight: 700 }}>
                  {hardwareState.bluetoothDeviceName || 'Connected'}
                </span>
              ) : (
                <span style={{ color: '#94A3B8' }}>Not Paired</span>
              )}
            </div>

            {/* USB Serial State */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: hardwareState.serialConnected ? '#10B981' : '#CBD5E1',
                }}
              />
              <span style={{ fontWeight: 600, color: hardwareState.serialConnected ? '#0F172A' : '#64748B' }}>
                USB:
              </span>
              {hardwareState.serialConnected ? (
                <span style={{ color: '#16A34A', fontWeight: 700 }}>
                  {hardwareState.serialDeviceName || 'Connected'}
                </span>
              ) : (
                <span style={{ color: '#94A3B8' }}>Not Connected</span>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              syncHardware();
              toast.success('Refreshed hardware status');
            }}
            title="Refresh hardware status"
            style={{
              background: '#FFFFFF',
              border: '1px solid #CBD5E1',
              padding: '5px 9px',
              borderRadius: '6px',
              cursor: 'pointer',
              color: '#475569',
              fontSize: '11px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <RefreshCw size={12} />
            <span>Refresh</span>
          </button>
        </div>

        {/* 3. Add Counter Section */}
        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border, #E2E8F0)', backgroundColor: '#FFFFFF' }}>
          <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px' }}>
                Add New Kitchen Counter
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  placeholder="e.g. Main Kitchen, Bar Counter, Grill, Dessert"
                  value={newCounterName}
                  onChange={e => setNewCounterName(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    fontSize: '13px',
                    outline: 'none',
                    backgroundColor: '#FFFFFF',
                    color: '#0F172A'
                  }}
                />
                <button
                  type="submit"
                  disabled={adding || !newCounterName.trim()}
                  style={{
                    padding: '9px 16px',
                    borderRadius: '8px',
                    backgroundColor: 'var(--primary, #971345)',
                    color: '#FFFFFF',
                    border: 'none',
                    fontWeight: 700,
                    fontSize: '13px',
                    cursor: adding || !newCounterName.trim() ? 'not-allowed' : 'pointer',
                    opacity: adding || !newCounterName.trim() ? 0.6 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {adding ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                  Add Counter
                </button>
              </div>
            </div>

            {/* Optional Printer Device Settings Toggle */}
            <div>
              <button
                type="button"
                onClick={() => setShowPrinterSettings(!showPrinterSettings)}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#2563EB',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <Printer size={13} />
                <span>{showPrinterSettings ? 'Hide Printer Setup for New Counter' : 'Configure Printer for this New Counter'}</span>
                {showPrinterSettings ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              </button>

              {showPrinterSettings && (
                <div style={{ marginTop: '10px', padding: '14px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: '4px' }}>
                        Printer Device Name / Model
                      </label>
                      <input
                        type="text"
                        value={newPrinterName}
                        onChange={e => setNewPrinterName(e.target.value)}
                        placeholder="POS-80C, Bar-Printer"
                        style={{
                          width: '100%',
                          padding: '7px 10px',
                          borderRadius: '6px',
                          border: '1px solid #CBD5E1',
                          fontSize: '12px',
                          boxSizing: 'border-box',
                          backgroundColor: '#FFFFFF',
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: '4px' }}>
                        Connection Type
                      </label>
                      <select
                        value={newPrinterType}
                        onChange={e => setNewPrinterType(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '7px 10px',
                          borderRadius: '6px',
                          border: '1px solid #CBD5E1',
                          fontSize: '12px',
                          backgroundColor: '#FFFFFF',
                          boxSizing: 'border-box',
                        }}
                      >
                        <option value="DEFAULT">Default / System</option>
                        <option value="BLUETOOTH">Bluetooth (Wireless)</option>
                        <option value="USB">USB Cable (Serial COM)</option>
                        <option value="NETWORK">Network (LAN / Wi-Fi)</option>
                      </select>
                    </div>
                  </div>

                  {newPrinterType === 'NETWORK' && (
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: '4px' }}>
                        Network IP Address (e.g. 192.168.1.150:9100)
                      </label>
                      <input
                        type="text"
                        value={newPrinterAddress}
                        onChange={e => setNewPrinterAddress(e.target.value)}
                        placeholder="192.168.1.150:9100"
                        style={{
                          width: '100%',
                          padding: '7px 10px',
                          borderRadius: '6px',
                          border: '1px solid #CBD5E1',
                          fontSize: '12px',
                          boxSizing: 'border-box',
                          backgroundColor: '#FFFFFF',
                        }}
                      />
                    </div>
                  )}

                  {/* Fast Pairing Shortcut */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '4px' }}>
                    <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 600 }}>Quick Connect:</span>
                    <button
                      type="button"
                      onClick={() => handleConnectBluetooth()}
                      disabled={connectingBt}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '6px',
                        border: '1px solid #DBEAFE',
                        backgroundColor: '#EFF6FF',
                        color: '#2563EB',
                        fontSize: '11px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <Bluetooth size={12} />
                      Pair Bluetooth
                    </button>
                    <button
                      type="button"
                      onClick={() => handleConnectSerial()}
                      disabled={connectingSerial}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '6px',
                        border: '1px solid #E2E8F0',
                        backgroundColor: '#F1F5F9',
                        color: '#475569',
                        fontSize: '11px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <Usb size={12} />
                      Connect USB
                    </button>
                  </div>
                </div>
              )}
            </div>
          </form>
        </div>

        {/* 4. Counters List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', backgroundColor: '#F8FAFC' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94A3B8', marginBottom: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Configured Counters ({counters.length})</span>
            <span style={{ fontSize: '11px', fontWeight: 500, color: '#64748B', textTransform: 'none' }}>
              Pair printers & test live tickets
            </span>
          </div>

          {loading ? (
            <div style={{ padding: '60px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <Loader2 size={28} className="animate-spin" style={{ color: '#94A3B8' }} />
            </div>
          ) : counters.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '50px 24px', color: '#94A3B8', backgroundColor: '#FFFFFF', borderRadius: '12px', border: '1px dashed #CBD5E1' }}>
              <Store size={32} style={{ margin: '0 auto 10px', opacity: 0.5 }} />
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#475569' }}>No counters added yet</div>
              <p style={{ fontSize: '12px', margin: '6px 0 0 0' }}>Add your first kitchen counter above to assign menu items and connect thermal printers.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {counters.map(counter => {
                const isEditing = editingId === counter.id;
                const isTesting = testingCounterId === counter.id;

                if (isEditing) {
                  return (
                    <div
                      key={counter.id}
                      style={{
                        padding: '16px',
                        borderRadius: '12px',
                        border: '2px solid #2563EB',
                        backgroundColor: '#FFFFFF',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px',
                        boxShadow: '0 4px 12px rgba(37, 99, 235, 0.08)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: '#2563EB', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          Edit Counter & Printer
                        </span>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, color: '#475569', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={editingActive}
                            onChange={e => setEditingActive(e.target.checked)}
                          />
                          Active Counter
                        </label>
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: '4px' }}>
                          Counter Name
                        </label>
                        <input
                          type="text"
                          value={editingName}
                          onChange={e => setEditingName(e.target.value)}
                          autoFocus
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            borderRadius: '6px',
                            border: '1px solid #CBD5E1',
                            fontSize: '13px',
                            fontWeight: 600,
                            color: '#0F172A',
                            outline: 'none',
                            boxSizing: 'border-box'
                          }}
                        />
                      </div>

                      {/* Printer Details in Edit Mode */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: '4px' }}>
                            Printer Model / Name
                          </label>
                          <input
                            type="text"
                            value={editingPrinterName}
                            onChange={e => setEditingPrinterName(e.target.value)}
                            placeholder="POS-80C, Bar-Printer"
                            style={{
                              width: '100%',
                              padding: '8px 10px',
                              borderRadius: '6px',
                              border: '1px solid #CBD5E1',
                              fontSize: '12px',
                              boxSizing: 'border-box'
                            }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: '4px' }}>
                            Connection Type
                          </label>
                          <select
                            value={editingPrinterType}
                            onChange={e => setEditingPrinterType(e.target.value)}
                            style={{
                              width: '100%',
                              padding: '8px 10px',
                              borderRadius: '6px',
                              border: '1px solid #CBD5E1',
                              fontSize: '12px',
                              backgroundColor: '#FFFFFF',
                              boxSizing: 'border-box'
                            }}
                          >
                            <option value="DEFAULT">Default / System</option>
                            <option value="BLUETOOTH">Bluetooth (Wireless)</option>
                            <option value="USB">USB Cable (Serial COM)</option>
                            <option value="NETWORK">Network (LAN / Wi-Fi)</option>
                          </select>
                        </div>
                      </div>

                      {editingPrinterType === 'NETWORK' && (
                        <div>
                          <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: '4px' }}>
                            Network IP / Address
                          </label>
                          <input
                            type="text"
                            value={editingPrinterAddress}
                            onChange={e => setEditingPrinterAddress(e.target.value)}
                            placeholder="192.168.1.150:9100"
                            style={{
                              width: '100%',
                              padding: '8px 10px',
                              borderRadius: '6px',
                              border: '1px solid #CBD5E1',
                              fontSize: '12px',
                              boxSizing: 'border-box'
                            }}
                          />
                        </div>
                      )}

                      {/* Pairing Buttons while editing */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 0 2px 0' }}>
                        <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 600 }}>Quick Pair:</span>
                        <button
                          type="button"
                          onClick={() => handleConnectBluetooth()}
                          disabled={connectingBt}
                          style={{
                            padding: '4px 10px',
                            borderRadius: '6px',
                            border: '1px solid #DBEAFE',
                            backgroundColor: '#EFF6FF',
                            color: '#2563EB',
                            fontSize: '11px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <Bluetooth size={12} />
                          Pair Bluetooth
                        </button>
                        <button
                          type="button"
                          onClick={() => handleConnectSerial()}
                          disabled={connectingSerial}
                          style={{
                            padding: '4px 10px',
                            borderRadius: '6px',
                            border: '1px solid #E2E8F0',
                            backgroundColor: '#F1F5F9',
                            color: '#475569',
                            fontSize: '11px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <Usb size={12} />
                          Connect USB
                        </button>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', borderTop: '1px solid #F1F5F9', paddingTop: '10px' }}>
                        <button
                          type="button"
                          onClick={handleCancelEdit}
                          style={{
                            padding: '7px 14px',
                            borderRadius: '6px',
                            border: '1px solid #CBD5E1',
                            backgroundColor: '#FFFFFF',
                            color: '#64748B',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSaveEdit(counter.id)}
                          disabled={savingEdit}
                          style={{
                            padding: '7px 16px',
                            borderRadius: '6px',
                            border: 'none',
                            backgroundColor: '#16A34A',
                            color: '#FFFFFF',
                            fontSize: '12px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          {savingEdit ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                          Save Changes
                        </button>
                      </div>
                    </div>
                  );
                }

                // Determine Hardware Status relative to this counter's configured type
                const pType = counter.printer_type || 'DEFAULT';
                const isBt = pType === 'BLUETOOTH';
                const isUsbType = pType === 'USB';
                const isNet = pType === 'NETWORK';

                let isConnected = false;
                let statusLabel = 'Disconnected';

                if (isBt) {
                  const btInfo = isBluetoothConnectedForCounter(counter.id, counter.printer_name || undefined);
                  isConnected = btInfo.connected;
                  statusLabel = isConnected
                    ? `Paired (${btInfo.deviceName || counter.printer_name})`
                    : 'Bluetooth Not Paired';
                } else if (isUsbType) {
                  const serialInfo = isSerialConnectedForCounter(counter.id, counter.printer_name || undefined);
                  isConnected = serialInfo.connected;
                  statusLabel = isConnected
                    ? `Connected (${serialInfo.deviceName || 'USB'})`
                    : 'USB Not Connected';
                } else if (isNet) {
                  statusLabel = counter.printer_address ? `LAN: ${counter.printer_address}` : 'IP Not Configured';
                  isConnected = Boolean(counter.printer_address);
                } else {
                  // DEFAULT
                  isConnected = hardwareState.bluetoothConnected || hardwareState.serialConnected;
                  statusLabel = isConnected ? 'System Printer Ready' : 'Default / Browser Driver';
                }

                return (
                  <div
                    key={counter.id}
                    style={{
                      padding: '16px',
                      borderRadius: '12px',
                      border: '1px solid #E2E8F0',
                      backgroundColor: '#FFFFFF',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                      transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
                    }}
                  >
                    {/* Top Row: Counter Title & Actions */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span
                          style={{
                            width: '9px',
                            height: '9px',
                            borderRadius: '50%',
                            backgroundColor: counter.is_active !== false ? '#10B981' : '#94A3B8',
                            display: 'inline-block',
                          }}
                        />
                        <span style={{ fontSize: '14px', fontWeight: 800, color: '#0F172A' }}>
                          {counter.name}
                        </span>
                        {counter.is_active === false && (
                          <span style={{ fontSize: '10px', color: '#EF4444', fontWeight: 700, background: '#FEE2E2', padding: '1px 6px', borderRadius: '4px' }}>
                            Inactive
                          </span>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <button
                          type="button"
                          onClick={() => handleStartEdit(counter)}
                          title="Configure Counter & Printer"
                          style={{
                            background: '#F8FAFC',
                            border: '1px solid #E2E8F0',
                            padding: '6px 8px',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            color: '#475569',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '11px',
                            fontWeight: 600,
                          }}
                        >
                          <Edit2 size={12} />
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(counter.id, counter.name)}
                          title="Delete Counter"
                          style={{
                            background: '#FEF2F2',
                            border: '1px solid #FEE2E2',
                            padding: '6px 8px',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            color: '#EF4444',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    {/* Middle: Printer Configuration Details Box */}
                    <div
                      style={{
                        padding: '10px 12px',
                        borderRadius: '8px',
                        backgroundColor: '#F8FAFC',
                        border: '1px solid #F1F5F9',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '8px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            fontSize: '12px',
                            color: '#0F172A',
                            fontWeight: 700,
                          }}
                        >
                          <Printer size={13} style={{ color: '#2563EB' }} />
                          {counter.printer_name || 'POS-80C'}
                        </span>

                        <span
                          style={{
                            fontSize: '10px',
                            fontWeight: 700,
                            padding: '2px 7px',
                            borderRadius: '4px',
                            backgroundColor: isBt
                              ? '#EFF6FF'
                              : isUsbType
                              ? '#F0FDF4'
                              : isNet
                              ? '#FAF5FF'
                              : '#F1F5F9',
                            color: isBt
                              ? '#2563EB'
                              : isUsbType
                              ? '#16A34A'
                              : isNet
                              ? '#9333EA'
                              : '#475569',
                            border: isBt
                              ? '1px solid #DBEAFE'
                              : isUsbType
                              ? '1px solid #DCFCE7'
                              : isNet
                              ? '1px solid #F3E8FF'
                              : '1px solid #E2E8F0',
                          }}
                        >
                          {pType}
                        </span>

                        {counter.printer_address && (
                          <span style={{ fontSize: '11px', color: '#64748B', fontFamily: 'monospace' }}>
                            {counter.printer_address}
                          </span>
                        )}
                      </div>

                      {/* Connection status tag */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px' }}>
                        <span
                          style={{
                            width: '7px',
                            height: '7px',
                            borderRadius: '50%',
                            backgroundColor: isConnected ? '#10B981' : '#CBD5E1',
                          }}
                        />
                        <span style={{ fontWeight: 600, color: isConnected ? '#16A34A' : '#64748B' }}>
                          {statusLabel}
                        </span>
                      </div>
                    </div>

                    {/* Bottom: Dedicated Connection Settings & Action Buttons */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '8px',
                        paddingTop: '2px',
                      }}
                    >
                      {/* Connection / Pairing Buttons */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        {isBt ? (
                          isConnected ? (
                            <button
                              type="button"
                              onClick={() => handleDisconnectBluetooth(counter)}
                              style={{
                                padding: '6px 11px',
                                borderRadius: '6px',
                                border: '1px solid #FCA5A5',
                                backgroundColor: '#FEF2F2',
                                color: '#DC2626',
                                fontSize: '11px',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                              }}
                            >
                              <BluetoothOff size={12} />
                              Disconnect BT
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleConnectBluetooth(counter)}
                              disabled={connectingCounterId !== null}
                              style={{
                                padding: '6px 12px',
                                borderRadius: '6px',
                                border: '1px solid #2563EB',
                                backgroundColor: '#2563EB',
                                color: '#FFFFFF',
                                fontSize: '11px',
                                fontWeight: 700,
                                cursor: connectingCounterId !== null ? 'not-allowed' : 'pointer',
                                opacity: connectingCounterId && connectingCounterId !== counter.id ? 0.6 : 1,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '5px',
                              }}
                            >
                              {connectingCounterId === counter.id ? (
                                <Loader2 size={12} className="animate-spin" />
                              ) : (
                                <Bluetooth size={12} />
                              )}
                              <span>{connectingCounterId === counter.id ? 'Connecting...' : 'Connect Bluetooth'}</span>
                            </button>
                          )
                        ) : isUsbType ? (
                          isConnected ? (
                            <button
                              type="button"
                              onClick={() => handleDisconnectSerial(counter)}
                              style={{
                                padding: '6px 11px',
                                borderRadius: '6px',
                                border: '1px solid #CBD5E1',
                                backgroundColor: '#FFFFFF',
                                color: '#475569',
                                fontSize: '11px',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                              }}
                            >
                              <Usb size={12} />
                              Disconnect USB
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleConnectSerial(counter)}
                              disabled={connectingSerialCounterId !== null}
                              style={{
                                padding: '6px 12px',
                                borderRadius: '6px',
                                border: '1px solid var(--primary, #971345)',
                                backgroundColor: 'var(--primary, #971345)',
                                color: '#FFFFFF',
                                fontSize: '11px',
                                fontWeight: 700,
                                cursor: connectingSerialCounterId !== null ? 'not-allowed' : 'pointer',
                                opacity: connectingSerialCounterId && connectingSerialCounterId !== counter.id ? 0.6 : 1,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '5px',
                              }}
                            >
                              {connectingSerialCounterId === counter.id ? (
                                <Loader2 size={12} className="animate-spin" />
                              ) : (
                                <Usb size={12} />
                              )}
                              <span>{connectingSerialCounterId === counter.id ? 'Connecting...' : 'Connect USB'}</span>
                            </button>
                          )
                        ) : (
                          // DEFAULT or NETWORK: offer quick Bluetooth/USB pairing buttons
                          <>
                            <button
                              type="button"
                              onClick={() => handleConnectBluetooth(counter)}
                              disabled={connectingCounterId !== null}
                              style={{
                                padding: '5px 10px',
                                borderRadius: '6px',
                                border: '1px solid #DBEAFE',
                                backgroundColor: '#EFF6FF',
                                color: '#2563EB',
                                fontSize: '11px',
                                fontWeight: 600,
                                cursor: connectingCounterId !== null ? 'not-allowed' : 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                              }}
                            >
                              {connectingCounterId === counter.id ? (
                                <Loader2 size={12} className="animate-spin" />
                              ) : (
                                <Bluetooth size={12} />
                              )}
                              <span>{connectingCounterId === counter.id ? 'Pairing...' : isConnected ? 'BT Paired' : 'Pair BT'}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleConnectSerial(counter)}
                              disabled={connectingSerialCounterId !== null}
                              style={{
                                padding: '5px 10px',
                                borderRadius: '6px',
                                border: '1px solid #E2E8F0',
                                backgroundColor: '#F1F5F9',
                                color: '#475569',
                                fontSize: '11px',
                                fontWeight: 600,
                                cursor: connectingSerialCounterId !== null ? 'not-allowed' : 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                              }}
                            >
                              {connectingSerialCounterId === counter.id ? (
                                <Loader2 size={12} className="animate-spin" />
                              ) : (
                                <Usb size={12} />
                              )}
                              <span>{connectingSerialCounterId === counter.id ? 'Connecting...' : hardwareState.serialConnected ? 'USB Active' : 'USB'}</span>
                            </button>
                          </>
                        )}
                      </div>

                      {/* Test Print Button */}
                      <button
                        type="button"
                        onClick={() => handleTestPrint(counter)}
                        disabled={isTesting}
                        style={{
                          padding: '6px 14px',
                          borderRadius: '6px',
                          border: '1px solid #CBD5E1',
                          backgroundColor: '#FFFFFF',
                          color: '#0F172A',
                          fontSize: '11px',
                          fontWeight: 700,
                          cursor: isTesting ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '5px',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                        }}
                      >
                        {isTesting ? (
                          <Loader2 size={12} className="animate-spin" style={{ color: '#2563EB' }} />
                        ) : (
                          <Play size={11} style={{ fill: '#2563EB', color: '#2563EB' }} />
                        )}
                        <span>{isTesting ? 'Printing...' : 'Test Print'}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </aside>
    </div>,
    document.body
  );
}
