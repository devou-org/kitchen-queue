'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Cpu, ShieldCheck, ShieldAlert, Sliders, RefreshCw, ArrowLeft, BarChart2, Store, Clock, Zap } from 'lucide-react';
import Link from 'next/link';

export default function SuperAdminAIQuotaPage() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    model: 'gemini-flash-latest',
    rpm_limit: 10,
    tpm_limit: 200000,
    rpd_limit: 200,
    max_output_tokens: 1000,
    tokens_per_credit: 2000,
    is_enabled: true
  });

  const fetchOverview = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/super-admin/ai-quota', { credentials: 'include' });
      if (res.status === 401) {
        router.push('/super-admin/login');
        return;
      }
      const json = await res.json();
      if (json.success) {
        setData(json.data);
        if (json.data.config) {
          setForm({
            model: json.data.config.model || 'gemini-flash-latest',
            rpm_limit: json.data.config.rpm_limit || 10,
            tpm_limit: json.data.config.tpm_limit || 200000,
            rpd_limit: json.data.config.rpd_limit || 200,
            max_output_tokens: json.data.config.max_output_tokens || 1000,
            tokens_per_credit: json.data.config.tokens_per_credit || 2000,
            is_enabled: json.data.config.is_enabled ?? true
          });
        }
      } else {
        toast.error(json.error || 'Failed to load AI quota data');
      }
    } catch {
      toast.error('Network error fetching AI quota metrics');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  const handleUpdateConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/super-admin/ai-quota', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(form)
      });
      const json = await res.json();
      if (json.success) {
        toast.success('Gemini configuration updated!');
        setEditing(false);
        fetchOverview();
      } else {
        toast.error(json.error || 'Failed to update config');
      }
    } catch {
      toast.error('Network error updating config');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleGlobalStatus = async (currentStatus: boolean) => {
    try {
      const res = await fetch('/api/super-admin/ai-quota', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ is_enabled: !currentStatus })
      });
      const json = await res.json();
      if (json.success) {
        toast.success(`Gemini AI globally ${!currentStatus ? 'ENABLED' : 'DISABLED'}`);
        fetchOverview();
      }
    } catch {
      toast.error('Failed to toggle Gemini status');
    }
  };

  if (loading && !data) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', padding: '40px', fontFamily: "'Inter', sans-serif" }}>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px', color: '#64748b' }}>
          <RefreshCw size={24} className="spin" style={{ marginRight: '8px' }} /> Loading AI Quota Overview...
        </div>
      </div>
    );
  }

  const config = data?.config || {};
  const daily = data?.dailyUsage || {};
  const restaurants = data?.restaurantBreakdown || [];
  const recentLogs = data?.recentLogs || [];

  const isGloballyEnabled = config.is_enabled && daily.is_enabled !== false;
  const disabledReason = daily.disabled_reason || (!config.is_enabled ? 'MANUAL_CONFIG_DISABLED' : null);

  const reqPct = Math.min(100, Math.round(((daily.request_count || 0) / (config.rpd_limit || 1)) * 100));
  const tpmPct = Math.min(100, Math.round(((daily.input_tokens || 0) / (config.tpm_limit || 1)) * 100));

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', fontFamily: "'Inter', sans-serif", paddingBottom: '60px', color: '#0f172a' }}>

      {/* Top Header */}
      <div style={{ backgroundColor: '#ffffff', borderBottom: '1px solid #e2e8f0', padding: '24px 32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <Link prefetch={false} href="/super-admin" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '40px', height: '40px', borderRadius: '10px', backgroundColor: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0' }}>
              <ArrowLeft size={18} />
            </Link>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Cpu size={24} style={{ color: '#6366f1' }} />
                <h1 style={{ fontSize: '22px', fontWeight: 800, margin: 0, color: '#0f172a' }}>Gemini AI Quotas & Global Limits</h1>
              </div>
              {/* <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0 0' }}>
                Global safety limits for the entire Qdine platform. Attributed per restaurant without per-tenant quotas.
              </p> */}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              onClick={() => handleToggleGlobalStatus(isGloballyEnabled)}
              style={{
                padding: '10px 18px',
                borderRadius: '8px',
                border: 'none',
                fontWeight: 700,
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                backgroundColor: isGloballyEnabled ? '#fef2f2' : '#ecfdf5',
                color: isGloballyEnabled ? '#dc2626' : '#059669',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
              }}
            >
              {isGloballyEnabled ? <ShieldAlert size={16} /> : <ShieldCheck size={16} />}
              {isGloballyEnabled ? 'Disable Gemini Globally' : 'Enable Gemini Globally'}
            </button>

            <button
              onClick={() => setEditing(true)}
              style={{
                padding: '10px 18px',
                borderRadius: '8px',
                backgroundColor: '#6366f1',
                color: '#ffffff',
                border: 'none',
                fontWeight: 700,
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 2px 10px rgba(99,102,241,0.25)'
              }}
            >
              <Sliders size={16} /> Edit Limits
            </button>
          </div>
        </div>
      </div>

      {/* Dashboard Body */}
      <div style={{ padding: '32px' }}>
        
        {/* Status Banner */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          border: `1px solid ${isGloballyEnabled ? '#a7f3d0' : '#fecaca'}`,
          padding: '24px',
          marginBottom: '24px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{
              width: '52px',
              height: '52px',
              borderRadius: '14px',
              backgroundColor: isGloballyEnabled ? '#ecfdf5' : '#fef2f2',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: isGloballyEnabled ? '#059669' : '#dc2626'
            }}>
              {isGloballyEnabled ? <ShieldCheck size={28} /> : <ShieldAlert size={28} />}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>Global Gemini Status:</span>
                <span style={{
                  padding: '4px 12px',
                  borderRadius: '999px',
                  fontSize: '12px',
                  fontWeight: 800,
                  letterSpacing: '0.05em',
                  backgroundColor: isGloballyEnabled ? '#dcfce7' : '#fee2e2',
                  color: isGloballyEnabled ? '#15803d' : '#b91c1c',
                  border: `1px solid ${isGloballyEnabled ? '#86efac' : '#fca5a5'}`
                }}>
                  {isGloballyEnabled ? 'ACTIVE / ONLINE' : 'DISABLED'}
                </span>
              </div>
              <p style={{ fontSize: '13px', color: '#64748b', marginTop: '4px', margin: 0 }}>
                {isGloballyEnabled
                  ? 'All Gemini AI features are active across all Qdine restaurants.'
                  : `Gemini API calls are currently rejected across all restaurants. Reason: ${disabledReason || 'UNKNOWN'}`}
              </p>
            </div>
          </div>

          {!isGloballyEnabled && (
            <div style={{ textAlign: 'right', fontSize: '12px', color: '#dc2626', fontWeight: 600 }}>
              <div>Disabled at: {daily.disabled_at ? new Date(daily.disabled_at).toLocaleString() : 'N/A'}</div>
              <div>Reason Code: <code style={{ background: '#fef2f2', padding: '2px 6px', borderRadius: '4px' }}>{disabledReason}</code></div>
            </div>
          )}
        </div>

        {/* Meters & Config Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px', marginBottom: '32px' }}>
          
          {/* Requests Per Day Meter */}
          <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Daily Requests (RPD)
              </span>
              <Zap size={18} style={{ color: '#6366f1' }} />
            </div>
            <div style={{ fontSize: '28px', fontWeight: 900, color: '#0f172a', lineHeight: 1 }}>
              {daily.request_count || 0} <span style={{ fontSize: '14px', color: '#94a3b8', fontWeight: 600 }}>/ {config.rpd_limit}</span>
            </div>
            <div style={{ height: '8px', backgroundColor: '#f1f5f9', borderRadius: '999px', marginTop: '16px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${reqPct}%`, backgroundColor: reqPct > 90 ? '#ef4444' : reqPct > 70 ? '#f59e0b' : '#6366f1', borderRadius: '999px', transition: 'width 0.3s' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#64748b', marginTop: '8px' }}>
              <span>{reqPct}% of daily limit used</span>
              <span>Reset at 00:00 UTC</span>
            </div>
          </div>

          {/* Input Tokens Per Day Meter */}
          <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Daily Tokens (TPD / Tokens/Day)
              </span>
              <BarChart2 size={18} style={{ color: '#10b981' }} />
            </div>
            <div style={{ fontSize: '28px', fontWeight: 900, color: '#0f172a', lineHeight: 1 }}>
              {(daily.input_tokens || 0).toLocaleString()} <span style={{ fontSize: '14px', color: '#94a3b8', fontWeight: 600 }}>/ {(config.tpm_limit || 0).toLocaleString()}</span>
            </div>
            <div style={{ height: '8px', backgroundColor: '#f1f5f9', borderRadius: '999px', marginTop: '16px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${tpmPct}%`, backgroundColor: tpmPct > 90 ? '#ef4444' : tpmPct > 70 ? '#f59e0b' : '#10b981', borderRadius: '999px', transition: 'width 0.3s' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#64748b', marginTop: '8px' }}>
              <span>{tpmPct}% of daily token budget</span>
              {/* <span>Calculated via countTokens()</span> */}
            </div>
          </div>

          {/* Configuration Summary Card */}
          <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Active AI Config
              </span>
              <Cpu size={18} style={{ color: '#0891b2' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px', marginTop: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed #f1f5f9', paddingBottom: '6px' }}>
                <span style={{ color: '#64748b' }}>Selected Model:</span>
                <strong style={{ color: '#0f172a', fontFamily: 'monospace' }}>{config.model}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed #f1f5f9', paddingBottom: '6px' }}>
                <span style={{ color: '#64748b' }}>RPM Limit:</span>
                <strong style={{ color: '#0f172a' }}>{config.rpm_limit} req/min</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed #f1f5f9', paddingBottom: '6px' }}>
                <span style={{ color: '#64748b' }}>Max Output Tokens:</span>
                <strong style={{ color: '#0f172a' }}>{config.max_output_tokens} tokens</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Credit Token Ratio:</span>
                <strong style={{ color: '#059669' }}>1 credit = {(config.tokens_per_credit || 2000).toLocaleString()} tok</strong>
              </div>
            </div>
          </div>

        </div>

        {/* Restaurant Usage Attribution Table */}
        <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.03)', marginBottom: '32px' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Store size={18} style={{ color: '#6366f1' }} />
                Per-Restaurant Usage Attribution (Today)
              </h3>
              <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 0 0' }}>
                Shows individual consumption for reporting. (All restaurants share the same global limit).
              </p>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 700 }}>
                  <th style={{ padding: '12px 24px' }}>Restaurant</th>
                  <th style={{ padding: '12px 24px' }}>Requests</th>
                  <th style={{ padding: '12px 24px' }}>Input Tokens</th>
                  <th style={{ padding: '12px 24px' }}>Output Tokens</th>
                  <th style={{ padding: '12px 24px' }}>Total Tokens</th>
                  <th style={{ padding: '12px 24px', textAlign: 'right' }}>Success / Errors</th>
                </tr>
              </thead>
              <tbody>
                {restaurants.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '32px', textAlign: 'center', color: '#94a3b8' }}>
                      No Gemini requests sent by any restaurant today.
                    </td>
                  </tr>
                ) : (
                  restaurants.map((r: any) => (
                    <tr key={r.restaurant_id || 'global'} style={{ borderBottom: '1px solid #f1f5f9', color: '#334155' }}>
                      <td style={{ padding: '14px 24px', fontWeight: 700, color: '#0f172a' }}>
                        {r.restaurant_name || 'System / Unattributed'}
                        {r.restaurant_slug && <span style={{ fontSize: '11px', color: '#64748b', marginLeft: '6px', fontWeight: 500 }}>({r.restaurant_slug})</span>}
                      </td>
                      <td style={{ padding: '14px 24px', fontWeight: 600 }}>{r.request_count}</td>
                      <td style={{ padding: '14px 24px' }}>{parseInt(r.input_tokens).toLocaleString()}</td>
                      <td style={{ padding: '14px 24px' }}>{parseInt(r.output_tokens).toLocaleString()}</td>
                      <td style={{ padding: '14px 24px', fontWeight: 700 }}>{parseInt(r.total_tokens).toLocaleString()}</td>
                      <td style={{ padding: '14px 24px', textAlign: 'right' }}>
                        <span style={{ color: '#059669', fontWeight: 700, marginRight: '8px' }}>{r.success_count} success</span>
                        {r.error_count > 0 && <span style={{ color: '#dc2626', fontWeight: 700 }}>({r.error_count} err)</span>}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Request History */}
        <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock size={18} style={{ color: '#0891b2' }} />
              Recent Gemini Request Log
            </h3>
            <span style={{ fontSize: '12px', color: '#64748b' }}>Latest 50 execution logs</span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 700 }}>
                  <th style={{ padding: '12px 20px' }}>Timestamp</th>
                  <th style={{ padding: '12px 20px' }}>Restaurant</th>
                  <th style={{ padding: '12px 20px' }}>Operation</th>
                  <th style={{ padding: '12px 20px' }}>Tokens (In/Out)</th>
                  <th style={{ padding: '12px 20px' }}>Latency</th>
                  <th style={{ padding: '12px 20px', textAlign: 'right' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '32px', textAlign: 'center', color: '#94a3b8' }}>
                      No recent Gemini logs recorded.
                    </td>
                  </tr>
                ) : (
                  recentLogs.map((log: any) => (
                    <tr key={log.id} style={{ borderBottom: '1px solid #f1f5f9', color: '#334155' }}>
                      <td style={{ padding: '12px 20px', fontSize: '12px', color: '#64748b' }}>
                        {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </td>
                      <td style={{ padding: '12px 20px', fontWeight: 600 }}>
                        {log.restaurant_name || 'N/A'}
                      </td>
                      <td style={{ padding: '12px 20px' }}>
                        <code style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px', fontSize: '11px' }}>{log.request_type}</code>
                      </td>
                      <td style={{ padding: '12px 20px' }}>
                        {log.input_tokens} / {log.output_tokens}
                      </td>
                      <td style={{ padding: '12px 20px', color: '#64748b' }}>
                        {log.response_time_ms ? `${log.response_time_ms} ms` : 'N/A'}
                      </td>
                      <td style={{ padding: '12px 20px', textAlign: 'right' }}>
                        <span style={{
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: 700,
                          backgroundColor: log.status === 'SUCCESS' ? '#ecfdf5' : log.status === 'REJECTED' ? '#fff7ed' : '#fef2f2',
                          color: log.status === 'SUCCESS' ? '#059669' : log.status === 'REJECTED' ? '#ea580c' : '#dc2626'
                        }}>
                          {log.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* Edit Config Modal */}
      {editing && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '28px', width: '100%', maxWidth: '500px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a', margin: '0 0 20px 0' }}>Configure Global Gemini Limits</h2>

            <form onSubmit={handleUpdateConfig} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '6px', textTransform: 'uppercase' }}>Gemini Model</label>
                <input
                  type="text"
                  value={form.model}
                  onChange={e => setForm(f => ({ ...f, model: e.target.value }))}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '6px', textTransform: 'uppercase' }}>RPM Limit</label>
                  <input
                    type="number"
                    value={form.rpm_limit}
                    onChange={e => setForm(f => ({ ...f, rpm_limit: parseInt(e.target.value, 10) }))}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                    required
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '6px', textTransform: 'uppercase' }}>RPD Limit (Requests/Day)</label>
                  <input
                    type="number"
                    value={form.rpd_limit}
                    onChange={e => setForm(f => ({ ...f, rpd_limit: parseInt(e.target.value, 10) }))}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '6px', textTransform: 'uppercase' }}>Max Output Tokens</label>
                  <input
                    type="number"
                    value={form.max_output_tokens}
                    onChange={e => setForm(f => ({ ...f, max_output_tokens: parseInt(e.target.value, 10) }))}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                    required
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '6px', textTransform: 'uppercase' }}>Tokens Per 1 AI Credit</label>
                  <input
                    type="number"
                    value={form.tokens_per_credit}
                    onChange={e => setForm(f => ({ ...f, tokens_per_credit: parseInt(e.target.value, 10) }))}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                    placeholder="2000"
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '4px' }}>
                <input
                  type="checkbox"
                  id="is_enabled_chk"
                  checked={form.is_enabled}
                  onChange={e => setForm(f => ({ ...f, is_enabled: e.target.checked }))}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <label htmlFor="is_enabled_chk" style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a', cursor: 'pointer' }}>
                  Enable Gemini Globally
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  style={{ padding: '10px 16px', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', color: '#475569', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', backgroundColor: '#6366f1', color: '#ffffff', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
