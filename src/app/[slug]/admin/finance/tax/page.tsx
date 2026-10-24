'use client';
import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { FinanceNav } from '@/components/modules/finance/FinanceNav';
import {
  Percent,
  Scale,
  Calendar,
  Download,
  Loader2,
  RefreshCw,
  Info,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import { AdminPageHeader } from '@/components/AdminPageHeader';
import { AdminContentWrapper } from '@/components/AdminContentWrapper';
import { useRestaurant } from '@/hooks/useRestaurant';

export default function TaxCompliancePage() {
  const params = useParams();
  const slug = (params?.slug as string) || '';
  const { restaurant } = useRestaurant();

  const [datePreset, setDatePreset] = useState<'month' | '30d' | 'last_week' | 'quarter' | 'year'>('month');
  const [startDate, setStartDate] = useState<string>(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });

  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<any>(null);

  const applyPreset = (preset: 'month' | '30d' | 'last_week' | 'quarter' | 'year') => {
    setDatePreset(preset);
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    if (preset === 'month') {
      const first = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
      setStartDate(first);
      setEndDate(todayStr);
    } else if (preset === '30d') {
      const s = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
      setStartDate(s);
      setEndDate(todayStr);
    } else if (preset === 'last_week') {
      const now = new Date();
      const currentDay = now.getDay();
      const daysToLastMonday = (currentDay === 0 ? 6 : currentDay - 1) + 7;
      const lastMonday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysToLastMonday);
      const lastSunday = new Date(lastMonday.getFullYear(), lastMonday.getMonth(), lastMonday.getDate() + 6);
      setStartDate(lastMonday.toISOString().split('T')[0]);
      setEndDate(lastSunday.toISOString().split('T')[0]);
    } else if (preset === 'quarter') {
      const qMonth = Math.floor(today.getMonth() / 3) * 3;
      const first = new Date(today.getFullYear(), qMonth, 1).toISOString().split('T')[0];
      setStartDate(first);
      setEndDate(todayStr);
    } else if (preset === 'year') {
      const first = new Date(today.getFullYear(), 0, 1).toISOString().split('T')[0];
      setStartDate(first);
      setEndDate(todayStr);
    }
  };

  const fetchTaxData = useCallback(async () => {
    if (!slug) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/finance/summary?slug=${slug}&startDate=${startDate}&endDate=${endDate}`
      );
      const json = await res.json();
      if (json.success) {
        setSummary(json.data);
      } else {
        toast.error(json.error || 'Failed to load tax data');
      }
    } catch {
      toast.error('Network error loading tax data');
    } finally {
      setLoading(false);
    }
  }, [slug, startDate, endDate]);

  useEffect(() => {
    fetchTaxData();
  }, [fetchTaxData]);

  const formatCurrency = (val: number = 0) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(val);
  };

  return (
    <div className="admin-page-container" style={{ padding: 0, minHeight: '100vh', background: restaurant?.secondary_color || '#FFFFFF' }}>
      <Toaster position="top-right" />

      <style>{`
        .finance-page-header,
        .finance-page-header.admin-page-header-container {
          height: 68px !important;
          min-height: 68px !important;
          display: flex !important;
          align-items: stretch !important;
          margin: 0 !important;
          padding: 0 20px 0 0 !important;
          border-bottom: 1px solid var(--border, #E2E8F0) !important;
          background: #FFFFFF !important;
          box-sizing: border-box !important;
        }
        .finance-toolbar {
          display: flex;
          align-items: stretch;
          justify-content: space-between;
          width: 100%;
          height: 68px;
        }
        .finance-tabs-wrapper {
          display: flex;
          align-items: stretch;
          height: 68px;
          padding-top: 10px;
          box-sizing: border-box;
        }
        .finance-actions {
          display: flex;
          align-items: center;
          gap: 8px;
          align-self: center;
        }
      `}</style>

      {/* Header Bar matching Analytics / Image 2 */}
      <AdminPageHeader
        className="finance-page-header"
        search={
          <div className="finance-toolbar">
            <div className="finance-tabs-wrapper">
              <FinanceNav inHeader={true} />
            </div>

            <div className="finance-actions">
              <button
                onClick={fetchTaxData}
                disabled={loading}
                title="Refresh"
                style={{
                  height: '36px',
                  padding: '0 10px',
                  background: '#FFFFFF',
                  border: '1px solid #CBD5E1',
                  borderRadius: '6px',
                  color: '#334155',
                  display: 'inline-flex',
                  alignItems: 'center',
                  cursor: 'pointer',
                }}
              >
                <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              </button>

              <button
                onClick={() => {
                  window.open(
                    `/api/admin/finance/export?slug=${slug}&startDate=${startDate}&endDate=${endDate}`,
                    '_blank'
                  );
                }}
                style={{
                  height: '36px',
                  padding: '0 14px',
                  background: 'var(--primary, #971345)',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  color: '#FFFFFF',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.08)',
                  transition: 'opacity 0.15s ease',
                }}
              >
                <Download size={13} />
                <span>Download Report</span>
              </button>
            </div>
          </div>
        }
      />

      <AdminContentWrapper>
        {/* Title inside page content */}
        <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#0F172A', margin: 0, letterSpacing: '-0.01em' }}>
              Tax & GST Compliance
            </h2>
            <p style={{ fontSize: '12.5px', color: '#64748B', margin: '2px 0 0 0' }}>
              {startDate} to {endDate}
            </p>
          </div>

          {/* Date Filter & Presets */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                backgroundColor: '#F1F5F9',
                padding: '3px',
                borderRadius: '8px',
                flexWrap: 'wrap',
              }}
            >
              {[
                { id: 'month', label: 'This Month' },
                { id: '30d', label: 'Last 30 Days' },
                { id: 'last_week', label: 'Last Week' },
                { id: 'quarter', label: 'This Quarter' },
                { id: 'year', label: 'Financial Year' },
              ].map((p) => {
                const isActive = datePreset === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => applyPreset(p.id as any)}
                    style={{
                      padding: '6px 12px',
                      fontSize: '12px',
                      fontWeight: isActive ? 600 : 500,
                      borderRadius: '6px',
                      border: 'none',
                      cursor: 'pointer',
                      backgroundColor: isActive ? '#FFFFFF' : 'transparent',
                      color: isActive ? '#0F172A' : '#64748B',
                      boxShadow: isActive ? '0 1px 3px rgba(0, 0, 0, 0.1)' : 'none',
                      display: 'flex',
                      alignItems: 'center',
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setDatePreset('custom' as any);
                  setStartDate(e.target.value);
                }}
                style={{
                  height: '32px',
                  padding: '0 8px',
                  fontSize: '12px',
                  borderRadius: '6px',
                  border: '1px solid #CBD5E1',
                  color: '#334155',
                  outline: 'none',
                  background: '#FFFFFF',
                }}
              />
              <span style={{ fontSize: '12px', color: '#94A3B8' }}>to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setDatePreset('custom' as any);
                  setEndDate(e.target.value);
                }}
                style={{
                  height: '32px',
                  padding: '0 8px',
                  fontSize: '12px',
                  borderRadius: '6px',
                  border: '1px solid #CBD5E1',
                  color: '#334155',
                  outline: 'none',
                  background: '#FFFFFF',
                }}
              />
            </div>
          </div>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px' }}>
            <div className="loader" />
          </div>
        ) : (
          <>
            {/* 3 Tax Stat Cards */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: '14px',
                marginBottom: '20px',
              }}
            >
              {/* Output Tax */}
              <div
                style={{
                  background: '#FFFFFF',
                  border: '1px solid #F1F5F9',
                  borderRadius: '12px',
                  padding: '16px 18px',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.02)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    1. Output GST (Collected)
                  </span>
                  <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#334155' }}>
                    <Percent size={14} />
                  </div>
                </div>
                <div style={{ fontSize: '22px', fontWeight: 700, color: '#0F172A', marginTop: '8px' }}>
                  {formatCurrency(summary?.taxCollected || 0)}
                </div>
              </div>

              {/* Input Tax Credit */}
              <div
                style={{
                  background: '#FFFFFF',
                  border: '1px solid #F1F5F9',
                  borderRadius: '12px',
                  padding: '16px 18px',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.02)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    2. Input Tax Credit (Paid)
                  </span>
                  <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#334155' }}>
                    <Scale size={14} />
                  </div>
                </div>
                <div style={{ fontSize: '22px', fontWeight: 700, color: '#0F172A', marginTop: '8px' }}>
                  {formatCurrency(summary?.taxPaid || 0)}
                </div>
              </div>

              {/* Net Liability */}
              <div
                style={{
                  background: '#FFFFFF',
                  border: '1px solid #F1F5F9',
                  borderRadius: '12px',
                  padding: '16px 18px',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.02)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    3. Net Tax Payable
                  </span>
                  <div
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '6px',
                      background: (summary?.netTaxLiability || 0) > 0 ? '#FEF2F2' : '#ECFDF5',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: (summary?.netTaxLiability || 0) > 0 ? '#DC2626' : '#059669',
                    }}
                  >
                    <Percent size={14} />
                  </div>
                </div>
                <div
                  style={{
                    fontSize: '22px',
                    fontWeight: 700,
                    color: (summary?.netTaxLiability || 0) > 0 ? '#DC2626' : '#059669',
                    marginTop: '8px',
                  }}
                >
                  {formatCurrency(summary?.netTaxLiability || 0)}
                </div>
              </div>
            </div>

            {/* Tax Computation Breakdown */}
            <div
              style={{
                background: '#FFFFFF',
                border: '1px solid #F1F5F9',
                borderRadius: '12px',
                padding: '20px',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.02)',
              }}
            >
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A', margin: '0 0 14px 0' }}>
                Tax Computation Formula
              </h3>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 16px',
                  background: '#F8FAFC',
                  borderRadius: '8px',
                  border: '1px solid #F1F5F9',
                  marginBottom: '16px',
                  fontSize: '13px',
                  color: '#334155',
                  flexWrap: 'wrap',
                }}
              >
                <span style={{ fontWeight: 600 }}>Net Tax Payable</span>
                <span>=</span>
                <span>Output GST ({formatCurrency(summary?.taxCollected || 0)})</span>
                <span>−</span>
                <span>Input GST Credit ({formatCurrency(summary?.taxPaid || 0)})</span>
                <span>=</span>
                <span style={{ fontWeight: 700, color: (summary?.netTaxLiability || 0) > 0 ? '#DC2626' : '#059669' }}>
                  {formatCurrency(summary?.netTaxLiability || 0)}
                </span>
              </div>

              <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', color: '#64748B', fontSize: '12px' }}>
                <Info size={15} style={{ flexShrink: 0, marginTop: '2px' }} />
                <span>
                  All sales orders punched in the POS terminal automatically categorize tax into Output GST.
                  Invoices received in Inventory Purchases automatically accumulate eligible Input Tax Credit (ITC).
                  Use this statement directly for GSTR-3B preparation.
                </span>
              </div>
            </div>
          </>
        )}
      </AdminContentWrapper>
    </div>
  );
}
