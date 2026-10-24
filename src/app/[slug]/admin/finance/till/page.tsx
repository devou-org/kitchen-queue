'use client';
import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { FinanceNav } from '@/components/modules/finance/FinanceNav';
import {
  Calculator,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Calendar,
  Lock,
  Loader2,
  RefreshCw,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import { AdminPageHeader } from '@/components/AdminPageHeader';
import { AdminContentWrapper } from '@/components/AdminContentWrapper';
import { useRestaurant } from '@/hooks/useRestaurant';
import toast, { Toaster } from 'react-hot-toast';

export default function TillReconciliationPage() {
  const params = useParams();
  const slug = (params?.slug as string) || '';
  const { restaurant } = useRestaurant();

  const [businessDate, setBusinessDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form states
  const [openingCash, setOpeningCash] = useState<string>('0');
  const [actualCountedCash, setActualCountedCash] = useState<string>('');
  const [notes, setNotes] = useState('');

  // Loaded data
  const [liveData, setLiveData] = useState<{ system_cash_sales: number; cash_expenses: number }>({
    system_cash_sales: 0,
    cash_expenses: 0,
  });
  const [storedRecord, setStoredRecord] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);

  const fetchTillData = useCallback(async () => {
    if (!slug) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/finance/till?slug=${slug}&date=${businessDate}`);
      const json = await res.json();
      if (json.success) {
        setLiveData(json.data?.live || { system_cash_sales: 0, cash_expenses: 0 });
        const stored = json.data?.stored;
        setStoredRecord(stored);
        if (stored) {
          setOpeningCash(String(stored.opening_cash));
          setActualCountedCash(String(stored.actual_counted_cash));
          setNotes(stored.notes || '');
        } else {
          setActualCountedCash('');
          setNotes('');
        }
        setHistory(json.history || []);
      } else {
        toast.error(json.error || 'Failed to load till data');
      }
    } catch {
      toast.error('Network error loading till data');
    } finally {
      setLoading(false);
    }
  }, [slug, businessDate]);

  useEffect(() => {
    fetchTillData();
  }, [fetchTillData]);

  // Derived calculations
  const numOpening = parseFloat(openingCash) || 0;
  const numSystemSales = storedRecord ? Number(storedRecord.system_cash_sales) : liveData.system_cash_sales;
  const numCashExpenses = storedRecord ? Number(storedRecord.cash_expenses) : liveData.cash_expenses;
  const expectedDrawerCash = numOpening + numSystemSales - numCashExpenses;

  const numCounted = actualCountedCash !== '' ? parseFloat(actualCountedCash) || 0 : null;
  const discrepancy = numCounted !== null ? numCounted - expectedDrawerCash : null;

  const formatCurrency = (val: number = 0) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(val);
  };

  const handleSaveReconciliation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (actualCountedCash === '') {
      toast.error('Please enter the physically counted cash amount');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/admin/finance/till?slug=${slug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessDate,
          openingCash: numOpening,
          actualCountedCash: Number(actualCountedCash),
          notes,
        }),
      });

      const json = await res.json();
      if (json.success) {
        toast.success('Till closed and reconciled successfully!');
        fetchTillData();
      } else {
        toast.error(json.error || 'Failed to save reconciliation');
      }
    } catch {
      toast.error('Network error saving reconciliation');
    } finally {
      setSaving(false);
    }
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
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748B' }}>Date:</span>
                <input
                  type="date"
                  value={businessDate}
                  onChange={(e) => setBusinessDate(e.target.value)}
                  style={{
                    height: '36px',
                    padding: '0 10px',
                    fontSize: '12.5px',
                    borderRadius: '6px',
                    border: '1px solid #CBD5E1',
                    color: '#334155',
                    outline: 'none',
                    background: '#FFFFFF',
                  }}
                />
              </div>

              <button
                onClick={fetchTillData}
                disabled={loading}
                style={{
                  height: '36px',
                  padding: '0 12px',
                  background: '#FFFFFF',
                  border: '1px solid #CBD5E1',
                  borderRadius: '6px',
                  fontSize: '12.5px',
                  fontWeight: 500,
                  color: '#334155',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                }}
              >
                <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                <span>Refresh</span>
              </button>
            </div>
          </div>
        }
      />

      <AdminContentWrapper>
        {/* Title inside page content */}
        <div style={{ marginBottom: '16px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#0F172A', margin: 0, letterSpacing: '-0.01em' }}>
            Till Reconciliation
          </h2>
          <p style={{ fontSize: '12.5px', color: '#64748B', margin: '2px 0 0 0' }}>
            Cash drawer audit for {businessDate}
          </p>
        </div>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px' }}>
            <div className="loader" />
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '20px', alignItems: 'start' }}>
            {/* Left: Reconciliation Workspace */}
            <div
              style={{
                background: '#FFFFFF',
                border: '1px solid #F1F5F9',
                borderRadius: '12px',
                padding: '20px',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.02)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0F172A', margin: 0 }}>
                    Reconciliation for {businessDate}
                  </h3>
                  <p style={{ fontSize: '12px', color: '#64748B', margin: '2px 0 0 0' }}>
                    {storedRecord ? 'Locked & Reconciled' : 'Open Register Session'}
                  </p>
                </div>

                {storedRecord && (
                  <span
                    style={{
                      background: storedRecord.status === 'BALANCED' ? '#ECFDF5' : '#FEF2F2',
                      color: storedRecord.status === 'BALANCED' ? '#047857' : '#DC2626',
                      border: `1px solid ${storedRecord.status === 'BALANCED' ? '#A7F3D0' : '#FECACA'}`,
                      padding: '3px 10px',
                      borderRadius: '5px',
                      fontSize: '11.5px',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                    }}
                  >
                    {storedRecord.status}
                  </span>
                )}
              </div>

              <form onSubmit={handleSaveReconciliation}>
                {/* Step 1: Starting Float */}
                <div style={{ marginBottom: '16px', padding: '14px', background: '#F8FAFC', borderRadius: '6px', border: '1px solid #E2E8F0' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                    1. Opening Cash Float (Morning Starting Drawer)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={openingCash}
                    onChange={(e) => setOpeningCash(e.target.value)}
                    style={{
                      width: '100%',
                      height: '36px',
                      borderRadius: '5px',
                      border: '1px solid #CBD5E1',
                      padding: '0 10px',
                      fontSize: '14px',
                      fontWeight: 600,
                      color: '#0F172A',
                      outline: 'none',
                    }}
                  />
                  <span style={{ fontSize: '11px', color: '#64748B', marginTop: '4px', display: 'block' }}>
                    Cash balance left in drawer before the first bill was punched.
                  </span>
                </div>

                {/* Step 2: System Calculated Movements */}
                <div style={{ marginBottom: '16px', padding: '14px', background: '#F8FAFC', borderRadius: '6px', border: '1px solid #E2E8F0' }}>
                  <span style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '10px' }}>
                    2. Automated Register Movements
                  </span>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div style={{ background: '#FFFFFF', padding: '10px 12px', borderRadius: '5px', border: '1px solid #E2E8F0' }}>
                      <span style={{ fontSize: '11px', color: '#64748B', display: 'block' }}>POS Cash Sales In</span>
                      <span style={{ fontSize: '16px', fontWeight: 700, color: '#059669', display: 'block', marginTop: '2px' }}>
                        +{formatCurrency(numSystemSales)}
                      </span>
                    </div>

                    <div style={{ background: '#FFFFFF', padding: '10px 12px', borderRadius: '5px', border: '1px solid #E2E8F0' }}>
                      <span style={{ fontSize: '11px', color: '#64748B', display: 'block' }}>Drawer Petty Cash Out</span>
                      <span style={{ fontSize: '16px', fontWeight: 700, color: '#E11D48', display: 'block', marginTop: '2px' }}>
                        -{formatCurrency(numCashExpenses)}
                      </span>
                    </div>
                  </div>

                  <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px dashed #CBD5E1', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#0F172A' }}>Expected Drawer Cash:</span>
                    <span style={{ fontSize: '16px', fontWeight: 700, color: '#0F172A' }}>{formatCurrency(expectedDrawerCash)}</span>
                  </div>
                </div>

                {/* Step 3: Counted Physical Cash */}
                <div style={{ marginBottom: '16px', padding: '14px', background: '#F8FAFC', borderRadius: '6px', border: '1px solid #E2E8F0' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                    3. Physical Cash Counted (Cashier Drawer Total) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Enter physical cash in drawer..."
                    required
                    value={actualCountedCash}
                    onChange={(e) => setActualCountedCash(e.target.value)}
                    style={{
                      width: '100%',
                      height: '38px',
                      borderRadius: '5px',
                      border: '1.5px solid #0F172A',
                      padding: '0 10px',
                      fontSize: '15px',
                      fontWeight: 700,
                      color: '#0F172A',
                      outline: 'none',
                    }}
                  />

                  {discrepancy !== null && (
                    <div
                      style={{
                        marginTop: '12px',
                        padding: '10px 12px',
                        borderRadius: '5px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        background: Math.abs(discrepancy) < 0.01 ? '#ECFDF5' : discrepancy < 0 ? '#FEF2F2' : '#EFF6FF',
                        border: `1px solid ${Math.abs(discrepancy) < 0.01 ? '#A7F3D0' : discrepancy < 0 ? '#FECACA' : '#BFDBFE'}`,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {Math.abs(discrepancy) < 0.01 ? (
                          <CheckCircle2 size={16} style={{ color: '#059669' }} />
                        ) : (
                          <AlertCircle size={16} style={{ color: discrepancy < 0 ? '#DC2626' : '#2563EB' }} />
                        )}
                        <span style={{ fontSize: '12.5px', fontWeight: 600, color: Math.abs(discrepancy) < 0.01 ? '#047857' : discrepancy < 0 ? '#DC2626' : '#1D4ED8' }}>
                          {Math.abs(discrepancy) < 0.01
                            ? 'Drawer Perfectly Balanced'
                            : discrepancy < 0
                            ? `Shortage of ${formatCurrency(Math.abs(discrepancy))}`
                            : `Overage of ${formatCurrency(discrepancy)}`}
                        </span>
                      </div>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: Math.abs(discrepancy) < 0.01 ? '#047857' : discrepancy < 0 ? '#DC2626' : '#1D4ED8' }}>
                        {discrepancy >= 0 ? `+${formatCurrency(discrepancy)}` : formatCurrency(discrepancy)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Notes */}
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                    Reconciliation Notes / Remarks
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Explanation for any cash discrepancy or shift notes..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    style={{
                      width: '100%',
                      borderRadius: '6px',
                      border: '1px solid #CBD5E1',
                      padding: '8px 10px',
                      fontSize: '13px',
                      outline: 'none',
                      resize: 'none',
                    }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    width: '100%',
                    height: '40px',
                    borderRadius: '6px',
                    border: 'none',
                    background: 'var(--primary, #971345)',
                    color: '#FFFFFF',
                    fontSize: '13.5px',
                    fontWeight: 600,
                    cursor: saving ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.08)',
                    transition: 'opacity 0.15s ease',
                  }}
                >
                  {saving ? <Loader2 size={15} className="animate-spin" /> : <Lock size={15} />}
                  <span>{storedRecord ? 'Update Reconciliation' : 'Lock & Reconcile Till'}</span>
                </button>
              </form>
            </div>

            {/* Right: Reconciliation History Log */}
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
                Recent Drawer Audits
              </h3>

              {history.length === 0 ? (
                <div style={{ padding: '30px 0', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>
                  No prior till audit logs found.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {history.map((h) => {
                    const diff = Number(h.discrepancy || 0);
                    return (
                      <div
                        key={h.id}
                        onClick={() => setBusinessDate(h.business_date)}
                        style={{
                          padding: '10px 12px',
                          borderRadius: '6px',
                          border: h.business_date === businessDate ? '1.5px solid #0F172A' : '1px solid #E2E8F0',
                          background: h.business_date === businessDate ? '#F8FAFC' : '#FFFFFF',
                          cursor: 'pointer',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: 600, color: '#0F172A' }}>
                            {h.business_date}
                          </div>
                          <div style={{ fontSize: '11.5px', color: '#64748B', marginTop: '2px' }}>
                            Expected: {formatCurrency(Number(h.expected_drawer_cash))} • Counted: {formatCurrency(Number(h.actual_counted_cash))}
                          </div>
                        </div>

                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: '4px',
                            background: Math.abs(diff) < 0.01 ? '#ECFDF5' : diff < 0 ? '#FEF2F2' : '#EFF6FF',
                            color: Math.abs(diff) < 0.01 ? '#047857' : diff < 0 ? '#DC2626' : '#1D4ED8',
                          }}
                        >
                          {Math.abs(diff) < 0.01 ? 'BALANCED' : diff < 0 ? `SHORT ${formatCurrency(Math.abs(diff))}` : `OVER ${formatCurrency(diff)}`}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </AdminContentWrapper>
    </div>
  );
}
