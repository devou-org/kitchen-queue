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
  Copy,
  Radio,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { printKotFromBrowser } from '@/lib/client-print';

interface PrinterConnectionCardProps {
  restaurantName?: string;
  slug: string;
}

export function PrinterConnectionCard({ restaurantName = 'QDINE', slug }: PrinterConnectionCardProps) {
  // Cloud Print Agent status (from /api/print/agent)
  const [agentStatus, setAgentStatus] = useState<{
    online: boolean;
    secondsAgo: number | null;
    printerName: string;
    lastHeartbeat: string | null;
    checking: boolean;
  }>({
    online: false,
    secondsAgo: null,
    printerName: 'POS-80C',
    lastHeartbeat: null,
    checking: true,
  });

  // Local bridge status (direct localhost fallback)
  const [bridgeStatus, setBridgeStatus] = useState<'checking' | 'connected' | 'offline'>('checking');
  const [bridgeDetails, setBridgeDetails] = useState<any>(null);

  // Settings
  const [printerName, setPrinterName] = useState('POS-80C');
  const [bridgeUrl, setBridgeUrl] = useState('http://127.0.0.1:9123');
  const [cloudApiStatus, setCloudApiStatus] = useState<'checking' | 'connected' | 'error'>('checking');
  const [testingPrint, setTestingPrint] = useState(false);
  const [showSetupGuide, setShowSetupGuide] = useState(false);

  // Current Origin
  const [originUrl, setOriginUrl] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setOriginUrl(window.location.origin);

      const savedPrinter = localStorage.getItem('qdine_kot_printer_name');
      if (savedPrinter) setPrinterName(savedPrinter);

      const savedUrl = localStorage.getItem('qdine_printer_bridge_url');
      if (savedUrl) setBridgeUrl(savedUrl);
    }
  }, []);

  // 1. Check Cloud Print Agent status
  const checkAgentStatus = useCallback(async () => {
    setAgentStatus((prev) => ({ ...prev, checking: true }));
    try {
      const res = await fetch(`/api/print/agent?slug=${encodeURIComponent(slug)}`, {
        cache: 'no-store',
      });
      if (res.ok) {
        const data = await res.json();
        setAgentStatus({
          online: Boolean(data.online),
          secondsAgo: data.secondsAgo ?? null,
          printerName: data.printerName || 'POS-80C',
          lastHeartbeat: data.lastHeartbeat || null,
          checking: false,
        });
      } else {
        setAgentStatus((prev) => ({ ...prev, online: false, checking: false }));
      }
    } catch {
      setAgentStatus((prev) => ({ ...prev, online: false, checking: false }));
    }
  }, [slug]);

  // 2. Check Local Bridge status
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

  // 3. Check Cloud API status
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

  const refreshAllStatuses = useCallback(() => {
    checkAgentStatus();
    checkBridgeStatus();
    checkCloudApi();
  }, [checkAgentStatus, checkBridgeStatus, checkCloudApi]);

  useEffect(() => {
    refreshAllStatuses();
    const interval = setInterval(checkAgentStatus, 5000);
    return () => clearInterval(interval);
  }, [refreshAllStatuses, checkAgentStatus]);

  const handleSavePrinterSettings = (e: React.FormEvent) => {
    e.preventDefault();
    if (!printerName.trim()) {
      toast.error('Printer name cannot be empty');
      return;
    }
    localStorage.setItem('qdine_kot_printer_name', printerName.trim());
    localStorage.setItem('qdine_printer_bridge_url', bridgeUrl.trim());
    toast.success('Printer configuration saved!');
    refreshAllStatuses();
  };

  const handleCopyAgentConfig = () => {
    const configObj = {
      serverUrl: originUrl || 'http://localhost:3000',
      slug: slug,
      printerName: printerName.trim() || 'POS-80C',
      pollIntervalMs: 1200,
    };
    navigator.clipboard.writeText(JSON.stringify(configObj, null, 2));
    toast.success('Agent config copied! Paste into scripts/print-agent-config.json');
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
      notes: 'Connection verified successfully! Ready for 1-click silent KOT printing.',
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

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to send test print');
      }

      // If server printed locally (e.g. running locally on Windows)
      if (data.mode === 'server') {
        toast.success(data.message || 'Test print sent to POS-80C!', { id: toastId });
        return;
      }

      // If queued for Cloud Print Agent on Cashier PC
      if (data.mode === 'agent') {
        toast.success(
          data.message || `Test print sent to Cashier ${printerName} via Cloud Print Agent!`,
          { id: toastId, duration: 4000 }
        );
        setTimeout(checkAgentStatus, 1500);
        return;
      }

      // Fallback: local bridge or browser driver
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
        toast.success('Test print processed successfully!', { id: toastId });
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
            Monitor Cloud Print Agent, Windows POS-80C printer, and cloud backend connectivity.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            refreshAllStatuses();
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
          <RefreshCw size={13} className={agentStatus.checking ? 'animate-spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Status Badges Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px', marginBottom: '18px' }}>
        {/* 1. Cloud Print Agent (Primary for Cloud Hosting) */}
        <div style={{
          padding: '12px 14px',
          borderRadius: '8px',
          border: '1px solid',
          borderColor: agentStatus.online ? '#BBF7D0' : agentStatus.checking ? '#E2E8F0' : '#FED7AA',
          backgroundColor: agentStatus.online ? '#F0FDF4' : agentStatus.checking ? '#F8FAFC' : '#FFFBEB',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: '#475569', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <Radio size={13} style={{ color: agentStatus.online ? '#15803D' : '#C2410C' }} />
              Cloud Print Agent (Cashier PC)
            </span>
            {agentStatus.online ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 700, color: '#15803D' }}>
                <CheckCircle2 size={13} /> Active
              </span>
            ) : agentStatus.checking ? (
              <span style={{ fontSize: '11px', color: '#94A3B8' }}>Checking...</span>
            ) : (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 700, color: '#C2410C' }}>
                <WifiOff size={13} /> Offline
              </span>
            )}
          </div>
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#0F172A' }}>
            {agentStatus.online
              ? `Connected · 1-Click Silent Print Active`
              : `Agent Offline · Browser Driver Fallback`}
          </div>
          <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
            {agentStatus.online
              ? `Printer: ${agentStatus.printerName} (Heartbeat ${agentStatus.secondsAgo !== null ? `${agentStatus.secondsAgo}s ago` : 'active'})`
              : `Run start-print-agent.bat on Cashier PC to link POS-80C`}
          </div>
        </div>

        {/* 2. Cloud Database & API */}
        <div style={{
          padding: '12px 14px',
          borderRadius: '8px',
          border: '1px solid',
          borderColor: cloudApiStatus === 'connected' ? '#BBF7D0' : '#FED7AA',
          backgroundColor: cloudApiStatus === 'connected' ? '#F0FDF4' : '#FFFBEB',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: '#475569', letterSpacing: '0.04em' }}>
              Cloud Backend Queue
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
              Exact printer name in Windows Control Panel / Printers list.
            </span>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>
              Cloud Server Origin URL
            </label>
            <input
              type="text"
              readOnly
              value={originUrl || 'http://localhost:3000'}
              style={{
                width: '100%',
                padding: '9px 12px',
                border: '1px solid #E2E8F0',
                backgroundColor: '#F8FAFC',
                borderRadius: '8px',
                color: '#334155',
                fontSize: '13px',
                fontFamily: 'monospace',
                boxSizing: 'border-box',
              }}
            />
            <span style={{ fontSize: '11px', color: '#64748B', marginTop: '3px', display: 'block' }}>
              Your public web address for Cashier PC configuration.
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
            onClick={handleCopyAgentConfig}
            className="btn btn-secondary btn-sm"
            style={{
              padding: '0 12px',
              height: '34px',
              fontSize: '12px',
              fontWeight: 600,
              borderRadius: '8px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
            title="Copy configuration JSON for cashier PC"
          >
            <Copy size={13} />
            <span>Copy Agent Config</span>
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
            {showSetupGuide ? 'Hide Cashier Setup Guide' : 'How to set up Cashier PC for 1-click printing?'}
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
            Quick Setup: 1-Click Silent Thermal Printing for Cloud Hosted Web App
          </div>
          <p style={{ margin: '0 0 8px 0', color: '#64748B' }}>
            When your web app is hosted in the cloud (HTTPS), browsers block direct access to your local USB printer for security. The <strong>QDine Cloud Print Agent</strong> solves this by running quietly on your Cashier PC, listening for KOT slips from the cloud and printing them silently to <strong>POS-80C</strong>.
          </p>
          <ol style={{ paddingLeft: '18px', margin: '6px 0 0 0' }}>
            <li>Connect your <strong>POS-80C</strong> thermal printer via USB to the restaurant cashier PC.</li>
            <li>On the Cashier PC, open the project folder and verify <code style={{ background: '#EEF2F6', padding: '2px 6px', borderRadius: '4px', fontWeight: 700, color: '#1E293B' }}>scripts/print-agent-config.json</code> has your cloud URL:
              <pre style={{ margin: '6px 0', padding: '8px 12px', background: '#0F172A', color: '#F8FAFC', borderRadius: '6px', fontSize: '11px', fontFamily: 'monospace' }}>
{JSON.stringify({
  serverUrl: originUrl || 'https://your-domain.com',
  slug: slug,
  printerName: printerName || 'POS-80C',
  pollIntervalMs: 1200
}, null, 2)}
              </pre>
            </li>
            <li>Double-click:
              <code style={{ background: '#EEF2F6', padding: '2px 6px', borderRadius: '4px', fontWeight: 700, color: '#1E293B', marginLeft: '4px' }}>
                scripts/start-print-agent.bat
              </code>
            </li>
            <li>A terminal will open: <em>"QDine Cloud Thermal Print Agent Active · Listening for print jobs"</em>. Keep it running or minimized.</li>
            <li>Click <strong>"Refresh"</strong> above — the status will turn green <strong style={{ color: '#15803D' }}>Active</strong>!</li>
            <li>Every order printed from any device (admin panel, waiter phones) will now print instantly on <strong>POS-80C</strong> and cut paper with <strong>0 popups</strong>!</li>
          </ol>
        </div>
      )}
    </div>
  );
}
