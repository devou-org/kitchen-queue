'use client';
import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { FinanceNav } from '@/components/modules/finance/FinanceNav';
import {
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Download,
  Calendar,
  IndianRupee,
  Receipt,
  Boxes,
  Loader2,
  RefreshCw,
  Wallet,
  Scale,
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import { AdminPageHeader } from '@/components/AdminPageHeader';
import { AdminContentWrapper } from '@/components/AdminContentWrapper';
import { useRestaurant } from '@/hooks/useRestaurant';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

export default function FinanceOverviewPage() {
  const params = useParams();
  const slug = (params?.slug as string) || '';
  const { restaurant } = useRestaurant();

  const [datePreset, setDatePreset] = useState<'today' | 'yesterday' | '7d' | 'last_week' | 'month' | '30d' | 'custom'>('month');
  const [startDate, setStartDate] = useState<string>(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });

  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<any>(null);

  const applyPreset = (preset: 'today' | 'yesterday' | '7d' | 'last_week' | 'month' | '30d') => {
    setDatePreset(preset);
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    if (preset === 'today') {
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === 'yesterday') {
      const y = new Date(Date.now() - 86400000).toISOString().split('T')[0];
      setStartDate(y);
      setEndDate(y);
    } else if (preset === '7d') {
      const s = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
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
    } else if (preset === 'month') {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
      setStartDate(firstDay);
      setEndDate(todayStr);
    } else if (preset === '30d') {
      const s = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
      setStartDate(s);
      setEndDate(todayStr);
    }
  };

  const fetchSummary = useCallback(async () => {
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
        toast.error(json.error || 'Failed to load finance data');
      }
    } catch {
      toast.error('Network error loading finance data');
    } finally {
      setLoading(false);
    }
  }, [slug, startDate, endDate]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  const handleExportCsv = () => {
    window.open(
      `/api/admin/finance/export?slug=${slug}&startDate=${startDate}&endDate=${endDate}`,
      '_blank'
    );
  };

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
          position: relative !important;
        }

        .finance-page-header .admin-page-header-container {
          height: 68px !important;
          min-height: 68px !important;
          display: flex !important;
          align-items: stretch !important;
          margin: 0 !important;
          padding: 0 !important;
          gap: 12px !important;
          width: 100% !important;
        }

        .finance-page-header .admin-header-left,
        .finance-page-header .admin-header-search {
          height: 68px !important;
          display: flex !important;
          align-items: stretch !important;
          flex-wrap: nowrap !important;
          width: 100% !important;
          margin: 0 !important;
          padding: 0 !important;
        }

        .finance-toolbar {
          display: flex !important;
          flex-wrap: nowrap !important;
          align-items: stretch !important;
          justify-content: space-between !important;
          gap: 12px !important;
          width: 100% !important;
          height: 68px !important;
          min-width: 0 !important;
          margin: 0 !important;
          padding: 0 !important;
        }

        .finance-tabs-wrapper {
          display: flex !important;
          align-items: stretch !important;
          height: 68px !important;
          min-height: 68px !important;
          padding-top: 10px !important;
          padding-right: 0 !important;
          padding-bottom: 0 !important;
          padding-left: 0 !important;
          box-sizing: border-box !important;
          flex-shrink: 0 !important;
          margin: 0 !important;
        }

        .finance-actions {
          display: flex !important;
          flex-wrap: nowrap !important;
          align-items: center !important;
          gap: 8px !important;
          margin-left: auto !important;
          flex-shrink: 0 !important;
          height: 68px !important;
        }

        @media (max-width: 768px) {
          .finance-page-header {
            height: auto !important;
            padding: 0 !important;
          }
          .finance-toolbar {
            flex-direction: column !important;
            height: auto !important;
          }
          .finance-tabs-wrapper {
            width: 100% !important;
            height: 44px !important;
            border-bottom: 1px solid var(--border, #E2E8F0) !important;
          }
          .finance-actions {
            height: auto !important;
            padding: 10px 14px !important;
            margin-left: 0 !important;
            width: 100% !important;
            box-sizing: border-box !important;
            flex-wrap: wrap !important;
          }
        }
      `}</style>

      {/* Top Header flush with navbar, identical to Analytics (Image 2) */}
      <AdminPageHeader
        className="finance-page-header"
        style={{ paddingTop: 0, marginBottom: 0 }}
        hideMaximize={true}
        search={
          <div className="finance-toolbar">
            <div className="finance-tabs-wrapper">
              <FinanceNav inHeader={true} />
            </div>

            <div className="finance-actions">
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748B' }}>From</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setDatePreset('custom');
                    setStartDate(e.target.value);
                  }}
                  style={{
                    height: '36px',
                    width: '135px',
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

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748B' }}>To</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setDatePreset('custom');
                    setEndDate(e.target.value);
                  }}
                  style={{
                    height: '36px',
                    width: '135px',
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

              <button
                onClick={fetchSummary}
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
                onClick={handleExportCsv}
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
                <span>Export</span>
              </button>
            </div>
          </div>
        }
      />

      <AdminContentWrapper>
        {/* Loading State */}
        {loading && !summary ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '80px 0', color: '#64748B' }}>
            <Loader2 className="animate-spin" size={24} />
            <span style={{ marginLeft: '10px', fontSize: '14px', fontWeight: 500 }}>Calculating financial performance...</span>
          </div>
        ) : (
          <>
            {/* Unified Performance Graph & Quick Stats Card (Matching Analytics Layout) */}
            <div
              style={{
                background: '#FFFFFF',
                border: '1px solid #F1F5F9',
                borderRadius: '12px',
                padding: '18px 20px',
                marginBottom: '20px',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.02)',
              }}
            >
              {/* Card Header: Title + Date Subtitle & Pill Switcher Buttons */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '12px',
                  marginBottom: '16px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '8px',
                      backgroundColor: '#F8FAFC',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: restaurant?.primary_color || '#971345',
                    }}
                  >
                    <TrendingUp size={20} strokeWidth={2.5} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '15px', fontWeight: 600, margin: 0, color: '#0F172A' }}>
                      Profit & Loss Performance
                    </h3>
                    <p style={{ fontSize: '12px', color: '#64748B', margin: '2px 0 0 0', fontWeight: 400 }}>
                      {startDate} to {endDate}
                    </p>
                  </div>
                </div>

                {/* Date Switcher Pill Container (Arranged like screenshot) */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    backgroundColor: '#F1F5F9',
                    padding: '3px',
                    borderRadius: '8px',
                    flexWrap: 'wrap',
                  }}
                >
                  {[
                    { id: 'today', label: 'Today' },
                    { id: 'yesterday', label: 'Yesterday' },
                    { id: '7d', label: '7 Days' },
                    { id: 'last_week', label: 'Last Week' },
                    { id: 'month', label: 'This Month' },
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
                          gap: '6px',
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
              </div>

              {/* Metric Quick Stats Ribbon (Reduced border, clean horizontal strip) */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: '12px',
                  marginBottom: '16px',
                  padding: '10px 16px',
                  backgroundColor: '#F8FAFC',
                  borderRadius: '10px',
                  border: '1px solid #F1F5F9',
                }}
              >
                <div>
                  <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 500 }}>Period Revenue</span>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: '#0F172A', marginTop: '2px' }}>
                    {formatCurrency(summary?.totalRevenue || 0)}
                  </div>
                </div>

                <div>
                  <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 500 }}>Total Expenses</span>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: '#0F172A', marginTop: '2px' }}>
                    {formatCurrency(summary?.totalExpenses || 0)}
                  </div>
                </div>

                <div>
                  <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 500 }}>Net Profit / (Loss)</span>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: (summary?.netProfit || 0) >= 0 ? '#059669' : '#DC2626', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>{formatCurrency(summary?.netProfit || 0)}</span>
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        padding: '1px 6px',
                        borderRadius: '4px',
                        backgroundColor: (summary?.netProfit || 0) >= 0 ? '#ECFDF5' : '#FEF2F2',
                        color: (summary?.netProfit || 0) >= 0 ? '#059669' : '#DC2626',
                      }}
                    >
                      {summary?.profitMarginPercent || 0}%
                    </span>
                  </div>
                </div>

                <div>
                  <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 500 }}>Net Tax Liability</span>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: '#0F172A', marginTop: '2px' }}>
                    {formatCurrency(summary?.netTaxLiability || 0)}
                  </div>
                </div>
              </div>

              {/* Chart Visual Timeline */}
              {summary?.dailyTrends && summary.dailyTrends.length > 0 ? (
                <div style={{ height: '280px', width: '100%', marginTop: '8px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={summary.dailyTrends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#0F172A" stopOpacity={0.15} />
                          <stop offset="95%" stopColor="#0F172A" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="colorExp" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#E11D48" stopOpacity={0.15} />
                          <stop offset="95%" stopColor="#E11D48" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                      <XAxis
                        dataKey="date"
                        stroke="#94A3B8"
                        fontSize={11}
                        tickLine={false}
                        tickFormatter={(v) => v.slice(5)}
                      />
                      <YAxis stroke="#94A3B8" fontSize={11} tickLine={false} />
                      <Tooltip
                        formatter={(value: any, name: any) => [
                          formatCurrency(Number(value)),
                          name === 'revenue' ? 'Sales Revenue' : 'Expenses',
                        ]}
                        contentStyle={{
                          background: '#FFFFFF',
                          border: '1px solid #F1F5F9',
                          borderRadius: '8px',
                          fontSize: '12px',
                          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="revenue"
                        stroke="#0F172A"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#colorRev)"
                      />
                      <Area
                        type="monotone"
                        dataKey="expenses"
                        stroke="#E11D48"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#colorExp)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div style={{ height: '160px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', fontSize: '13px' }}>
                  No transaction data available for selected period.
                </div>
              )}
            </div>

            {/* Profit & Loss Statement Table (Clean, reduced borders) */}
            <div
              style={{
                background: '#FFFFFF',
                border: '1px solid #F1F5F9',
                borderRadius: '12px',
                padding: '20px',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.02)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#0F172A', margin: 0 }}>
                  Profit & Loss Statement
                </h3>
                <span style={{ fontSize: '12px', color: '#64748B' }}>
                  {startDate} to {endDate}
                </span>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #E2E8F0', color: '#64748B', textAlign: 'left' }}>
                      <th style={{ padding: '8px 12px', fontWeight: 600 }}>Accounting Line Item</th>
                      <th style={{ padding: '8px 12px', fontWeight: 600 }}>Source</th>
                      <th style={{ padding: '8px 12px', fontWeight: 600, textAlign: 'right' }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Income */}
                    <tr style={{ background: '#F8FAFC', fontWeight: 600, color: '#0F172A' }}>
                      <td style={{ padding: '9px 12px' }} colSpan={2}>
                        1. Operating Revenue (Income)
                      </td>
                      <td style={{ padding: '9px 12px', textAlign: 'right', color: '#059669' }}>
                        {formatCurrency(summary?.totalRevenue || 0)}
                      </td>
                    </tr>
                    {summary?.paymentMethodBreakdown?.map((pm: any) => (
                      <tr key={pm.method} style={{ borderBottom: '1px solid #F8FAFC', color: '#475569' }}>
                        <td style={{ padding: '7px 12px 7px 24px' }}>
                          Sales via {pm.method} ({pm.count} orders)
                        </td>
                        <td style={{ padding: '7px 12px', color: '#64748B', fontSize: '12px' }}>POS Terminal</td>
                        <td style={{ padding: '7px 12px', textAlign: 'right' }}>{formatCurrency(pm.total)}</td>
                      </tr>
                    ))}

                    {/* Cost of Goods Sold */}
                    <tr style={{ background: '#F8FAFC', fontWeight: 600, color: '#0F172A' }}>
                      <td style={{ padding: '9px 12px' }} colSpan={2}>
                        2. Cost of Goods Sold (COGS)
                      </td>
                      <td style={{ padding: '9px 12px', textAlign: 'right', color: '#E11D48' }}>
                        ({formatCurrency(summary?.cogsExpenses || 0)})
                      </td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #F8FAFC', color: '#475569' }}>
                      <td style={{ padding: '7px 12px 7px 24px' }}>Inventory Raw Materials & Purchases</td>
                      <td style={{ padding: '7px 12px', color: '#64748B', fontSize: '12px' }}>Inventory Receiving</td>
                      <td style={{ padding: '7px 12px', textAlign: 'right' }}>
                        {formatCurrency(summary?.cogsExpenses || 0)}
                      </td>
                    </tr>

                    {/* Operating Overheads */}
                    <tr style={{ background: '#F8FAFC', fontWeight: 600, color: '#0F172A' }}>
                      <td style={{ padding: '9px 12px' }} colSpan={2}>
                        3. Operating Expenses & Overheads
                      </td>
                      <td style={{ padding: '9px 12px', textAlign: 'right', color: '#E11D48' }}>
                        ({formatCurrency(summary?.operatingExpenses || 0)})
                      </td>
                    </tr>
                    {summary?.expenseCategoryBreakdown?.filter((c: any) => c.category !== 'Cost of Goods Sold (Raw Materials)')?.map((c: any) => (
                      <tr key={c.category} style={{ borderBottom: '1px solid #F8FAFC', color: '#475569' }}>
                        <td style={{ padding: '7px 12px 7px 24px' }}>{c.category}</td>
                        <td style={{ padding: '7px 12px', color: '#64748B', fontSize: '12px' }}>Petty Cash</td>
                        <td style={{ padding: '7px 12px', textAlign: 'right' }}>{formatCurrency(c.total)}</td>
                      </tr>
                    ))}

                    {/* Summary Totals */}
                    <tr style={{ borderTop: '1px solid #E2E8F0', background: '#F8FAFC', fontWeight: 700, fontSize: '13.5px' }}>
                      <td style={{ padding: '10px 12px' }} colSpan={2}>
                        Net Profit / (Loss) Before Taxes
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', color: (summary?.netProfit || 0) >= 0 ? '#059669' : '#DC2626' }}>
                        {formatCurrency(summary?.netProfit || 0)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </AdminContentWrapper>
    </div>
  );
}
