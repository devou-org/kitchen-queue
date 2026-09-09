'use client';
import React, { useState, useEffect, useCallback } from 'react';
import {
  Printer,
  Wifi,
  WifiOff,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Server,
  Terminal,
  Play,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { printKotFromBrowser } from '@/lib/client-print';

interface PrinterConnectionCardProps {
  restaurantName?: string;
  slug: string;
}

export function PrinterConnectionCard({ restaurantName = 'QDINE', slug }: PrinterConnectionCardProps) {
  const [bridgeStatus, setBridgeStatus] = useState<'checking' | 'connected' | 'offline'>('checking');
  const [bridgeDetails, setBridgeDetails] = useState<any>(null);
  const [printerName, setPrinterName] = useState('POS-80C');
  const [bridgeUrl, setBridgeUrl] = useState('http://127.0.0.1:9123');
  const [cloudApiStatus, setCloudApiStatus] = useState<'checking' | 'connected' | 'error'>('checking');
  const [testingPrint, setTestingPrint] = useState(false);
  const [showSetupGuide, setShowSetupGuide] = useState(false);

  // Load saved settings from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedPrinter = localStorage.getItem('qdine_kot_printer_name');
      if (savedPrinter) setPrinterName(savedPrinter);

      const savedUrl = localStorage.getItem('qdine_printer_bridge_url');
      if (savedUrl) setBridgeUrl(savedUrl);
    }
  }, []);

  // Check local bridge status
  const checkBridgeStatus = useCallback(async () => {
    setBridgeStatus('checking');
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1800);

      const res = await fetch(`${bridgeUrl.replace(/\/+$/, '')}/health`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        setBridgeStatus('connected');
        setBridgeDetails(data);
      } else {
        setBridgeStatus('offline');
        setBridgeDetails(null);
      }
    } catch {
      setBridgeStatus('offline');
      setBridgeDetails(null);
    }
  }, [bridgeUrl]);

  // Check cloud API status
  const checkCloudApi = useCallback(async () => {
    setCloudApiStatus('checking');
    try {
      const res = await fetch('/api/counters', {
        headers: { 'x-restaurant-slug': slug },
      });
      if (res.ok) {
        setCloudApiStatus('connected');
      } else {
        setCloudApiStatus('error');
      }
    } catch {
      setCloudApiStatus('error');
    }
  }, [slug]);

  useEffect(() => {
    checkBridgeStatus();
    checkCloudApi();
  }, [checkBridgeStatus, checkCloudApi]);

  const handleSavePrinterSettings = (e: React.FormEvent) => {
    e.preventDefault();
    if (!printerName.trim()) {
      toast.error('Printer name cannot be empty');
      return;
    }
    localStorage.setItem('qdine_kot_printer_name', printerName.trim());
    localStorage.setItem('qdine_printer_bridge_url', bridgeUrl.trim());
    toast.success('Printer configuration saved!');
    checkBridgeStatus();
  };

  const handleSendTestPrint = async () => {
    setTestingPrint(true);
    const toastId = toast.loading('Sending test print to ' + printerName + '...');

    const testOrder = {
      id: 'test-print-' + Date.now(),
      ticket_number: 999,
      order_type: 'DINE_IN',
      table_number: 'TEST-01',
      customer_name: 'Hardware Test',
      staff_name: 'Admin',
      created_at: new Date().toISOString(),
      items: [
        { product_name: 'Thermal Printer Link', quantity: 1, counter: 'Counter 1' },
        { product_name: 'Hardware ESC/POS Test', quantity: 1, counter: 'Counter 1' },
      ],
      notes: 'Connection verified successfully! Ready to print KOT tickets.',
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
          counterName: 'ALL',
          printerName: printerName.trim(),
          orderData: testOrder,
          slug,
        }),
      });

      const data = await res.json();

      if (data.mode === 'server') {
        toast.success(data.message || 'Test print sent to POS-80C!', { id: toastId });
        return;
      }

      if (data.kotData) {
        const clientRes = await printKotFromBrowser({
          kotData: data.kotData,
          base64Bytes: data.base64Bytes,
          printerName: printerName.trim(),
          localBridgeUrl: `${bridgeUrl.replace(/\/+$/, '')}/print`,
        });

        if (clientRes.method === 'bridge') {
          toast.success(`Test print sent to ${printerName} via local bridge!`, { id: toastId });
        } else {
          toast.success('Test print ticket opened in thermal print driver!', { id: toastId });
        }
      } else {
        throw new Error(data.error || 'Failed to prepare test print');
      }
    } catch (err: any) {
      console.error('Test print failed:', err);
      toast.error(err.message || 'Test print failed. Check printer connection.', { id: toastId });
    } finally {
      setTestingPrint(false);
    }
  };

  return (
    <div className="card" style={{ padding: '20px', borderRadius: '12px', background: '#FFFFFF', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
      {/* Card Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px', marginBottom: '16px' }}>
        <div>
          <h2 style={{ fontSize: '16px', fontWeight: 800, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
            <Printer size={18} style={{ color: 'var(--primary, #2563eb)' }} />
            Connection & Hardware Status
          </h2>
          <p style={{ fontSize: '12px', color: '#64748B', margin: '4px 0 0 0' }}>
            Monitor thermal printer bridge, local hardware, and cloud API connectivity.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            checkBridgeStatus();
            checkCloudApi();
            toast.success('Refreshing connection status...');
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
          title="Refresh connection status"
        >
          <RefreshCw size={13} className={bridgeStatus === 'checking' ? 'animate-spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Status Badges Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', marginBottom: '18px' }}>
        {/* 1. Local Thermal Printer Bridge */}
        <div style={{
          padding: '12px 14px',
          borderRadius: '8px',
          border: '1px solid',
          borderColor: bridgeStatus === 'connected' ? '#BBF7D0' : bridgeStatus === 'checking' ? '#E2E8F0' : '#FED7AA',
          backgroundColor: bridgeStatus === 'connected' ? '#F0FDF4' : bridgeStatus === 'checking' ? '#F8FAFC' : '#FFFBEB',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: '#475569', letterSpacing: '0.04em' }}>
              Local Printer Bridge
            </span>
            {bridgeStatus === 'connected' ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 700, color: '#15803D' }}>
                <CheckCircle2 size={13} /> Active
              </span>
            ) : bridgeStatus === 'checking' ? (
              <span style={{ fontSize: '11px', color: '#94A3B8' }}>Checking...</span>
            ) : (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 700, color: '#C2410C' }}>
                <WifiOff size={13} /> Browser Mode
              </span>
            )}
          </div>
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#0F172A' }}>
            {bridgeStatus === 'connected'
              ? `Connected (127.0.0.1:9123)`
              : `Bridge Offline · Using Browser Driver`}
          </div>
          <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
            {bridgeStatus === 'connected'
              ? `Hardware: ${bridgeDetails?.defaultPrinter || printerName} (1-Click Silent Print)`
              : `Prints will open via thermal roll print dialog`}
          </div>
        </div>

        {/* 2. Cloud API Backend */}
        <div style={{
          padding: '12px 14px',
          borderRadius: '8px',
          border: '1px solid',
          borderColor: cloudApiStatus === 'connected' ? '#BBF7D0' : '#FED7AA',
          backgroundColor: cloudApiStatus === 'connected' ? '#F0FDF4' : '#FFFBEB',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: '#475569', letterSpacing: '0.04em' }}>
              Cloud Database & API
            </span>
            {cloudApiStatus === 'connected' ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 700, color: '#15803D' }}>
                <CheckCircle2 size={13} /> Online
              </span>
            ) : (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 700, color: '#C2410C' }}>
                <AlertTriangle size={13} /> Checking
              </span>
            )}
          </div>
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#0F172A' }}>
            {cloudApiStatus === 'connected' ? 'Connected to QDine Cloud' : 'Connecting to Server...'}
          </div>
          <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
            Restaurant: {restaurantName} ({slug})
          </div>
        </div>
      </div>

      {/* Printer Configuration Form */}
      <form onSubmit={handleSavePrinterSettings} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>
              Windows Thermal Printer Name
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
              Exact printer name in Windows Control Panel / Settings.
            </span>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>
              Local Hardware Bridge URL
            </label>
            <input
              type="url"
              value={bridgeUrl}
              onChange={(e) => setBridgeUrl(e.target.value)}
              placeholder="http://127.0.0.1:9123"
              style={{
                width: '100%',
                padding: '9px 12px',
                border: '1px solid #CBD5E1',
                borderRadius: '8px',
                color: '#0F172A',
                fontSize: '13px',
                fontFamily: 'monospace',
                boxSizing: 'border-box',
              }}
            />
            <span style={{ fontSize: '11px', color: '#64748B', marginTop: '3px', display: 'block' }}>
              Local bridge endpoint on Cashier PC (default: port 9123).
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
            Save Printer Settings
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
            onClick={() => setShowSetupGuide(!showSetupGuide)}
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
            {showSetupGuide ? 'Hide Bridge Setup Guide' : 'How to enable 1-click silent printing?'}
          </button>
        </div>
      </form>

      {/* Setup Guide Accordion */}
      {showSetupGuide && (
        <div style={{
          marginTop: '16px',
          padding: '14px',
          borderRadius: '8px',
          background: '#F8FAFC',
          border: '1px solid #E2E8F0',
          fontSize: '12px',
          lineHeight: 1.6,
          color: '#334155',
        }}>
          <div style={{ fontWeight: 700, color: '#0F172A', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Terminal size={14} style={{ color: 'var(--primary, #2563eb)' }} />
            Quick Guide: 1-Click Silent Thermal Printing on Windows PC
          </div>
          <ol style={{ paddingLeft: '18px', margin: '6px 0 0 0' }}>
            <li>Connect your <strong>POS-80C</strong> thermal printer via USB to the restaurant cashier/counter PC.</li>
            <li>In the project folder on the cashier PC, double-click:
              <code style={{ background: '#EEF2F6', padding: '2px 6px', borderRadius: '4px', fontWeight: 700, color: '#1E293B', marginLeft: '4px' }}>
                scripts/start-printer-bridge.bat
              </code>
            </li>
            <li>A small terminal window will open showing <em>"QDine POS Printer Bridge Running on port 9123"</em>. Keep it minimized.</li>
            <li>Click <strong>"Refresh"</strong> above — the status will immediately turn green <strong style={{ color: '#15803D' }}>Active</strong>!</li>
            <li>Now every time you click <strong>"Print KOT"</strong> in the Order Details drawer, the ticket will print instantly and cut the paper with <strong>0 dialogs</strong>!</li>
          </ol>
          <div style={{ marginTop: '8px', fontSize: '11px', color: '#64748B' }}>
            <em>Note: Even if the bridge window is closed, printing will still work seamlessly through your browser thermal print driver.</em>
          </div>
        </div>
      )}
    </div>
  );
}

