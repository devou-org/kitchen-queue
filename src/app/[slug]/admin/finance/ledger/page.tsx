'use client';
import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { FinanceNav } from '@/components/modules/finance/FinanceNav';
import {
  BookOpen,
  Search,
  Calendar,
  Download,
  Loader2,
  RefreshCw,
  Filter,
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import { AdminPageHeader } from '@/components/AdminPageHeader';
import { AdminContentWrapper } from '@/components/AdminContentWrapper';

export default function FinanceLedgerPage() {
  const params = useParams();
  const slug = (params?.slug as string) || '';

  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 50, totalCount: 0, totalPages: 1 });

  // Filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [entryType, setEntryType] = useState('ALL');
  const [source, setSource] = useState('ALL');
  const [paymentMethod, setPaymentMethod] = useState('ALL');
  const [search, setSearch] = useState('');

  const fetchLedger = useCallback(async (page = 1) => {
    if (!slug) return;
    setLoading(true);
    try {
      const q = new URLSearchParams({
        slug,
        page: String(page),
        limit: '50',
      });
      if (startDate) q.set('startDate', startDate);
      if (endDate) q.set('endDate', endDate);
      if (entryType !== 'ALL') q.set('entryType', entryType);
      if (source !== 'ALL') q.set('source', source);
      if (paymentMethod !== 'ALL') q.set('paymentMethod', paymentMethod);
      if (search.trim()) q.set('search', search.trim());

      const res = await fetch(`/api/admin/finance/transactions?${q.toString()}`);
      const json = await res.json();
      if (json.success) {
        setTransactions(json.data || []);
        if (json.pagination) setPagination(json.pagination);
      } else {
        toast.error(json.error || 'Failed to fetch ledger transactions');
      }
    } catch {
      toast.error('Network error fetching ledger');
    } finally {
      setLoading(false);
    }
  }, [slug, startDate, endDate, entryType, source, paymentMethod, search]);

  useEffect(() => {
    fetchLedger(1);
  }, [fetchLedger]);

  const handleExportCsv = () => {
    const q = new URLSearchParams({ slug });
    if (startDate) q.set('startDate', startDate);
    if (endDate) q.set('endDate', endDate);
    window.open(`/api/admin/finance/export?${q.toString()}`, '_blank');
  };

  const formatCurrency = (val: number = 0) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(val);
  };

  return (
    <div className="admin-page-container" style={{ padding: 0, minHeight: '100vh', background: '#F8FAFC' }}>
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
                onClick={() => fetchLedger(pagination.page)}
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
                  background: '#0F172A',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  color: '#FFFFFF',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                }}
              >
                <Download size={13} />
                <span>Export CSV</span>
              </button>
            </div>
          </div>
        }
      />

      <AdminContentWrapper>
        {/* Title inside page content */}
        <div style={{ marginBottom: '20px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#0F172A', margin: 0, letterSpacing: '-0.01em' }}>
            Financial Transactions Ledger
          </h2>
          <p style={{ fontSize: '13px', color: '#64748B', margin: '4px 0 0 0' }}>
            Complete chronological audit trail of all automated sales, inventory purchases, and manual operating expenses
          </p>
        </div>

        {/* Filters Bar */}
        <div
          style={{
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: '8px',
            padding: '14px 16px',
            marginBottom: '20px',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '12px',
            alignItems: 'center',
          }}
        >
          {/* Search */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '1 1 200px' }}>
            <Search size={14} style={{ color: '#64748B' }} />
            <input
              type="text"
              placeholder="Search reference # or description..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: '100%',
                height: '34px',
                border: '1px solid #CBD5E1',
                borderRadius: '5px',
                padding: '0 10px',
                fontSize: '13px',
                color: '#334155',
                outline: 'none',
              }}
            />
          </div>

          {/* Type Filter */}
          <select
            value={entryType}
            onChange={(e) => setEntryType(e.target.value)}
            style={{
              height: '34px',
              borderRadius: '5px',
              border: '1px solid #CBD5E1',
              padding: '0 10px',
              fontSize: '12.5px',
              color: '#334155',
              background: '#FFFFFF',
              outline: 'none',
            }}
          >
            <option value="ALL">All Flow Types</option>
            <option value="INCOME">Income (+)</option>
            <option value="EXPENSE">Expense (−)</option>
          </select>

          {/* Source Filter */}
          <select
            value={source}
            onChange={(e) => setSource(e.target.value)}
            style={{
              height: '34px',
              borderRadius: '5px',
              border: '1px solid #CBD5E1',
              padding: '0 10px',
              fontSize: '12.5px',
              color: '#334155',
              background: '#FFFFFF',
              outline: 'none',
            }}
          >
            <option value="ALL">All Sources</option>
            <option value="POS_SALES">POS Terminal Sales</option>
            <option value="INVENTORY_PURCHASE">Inventory Purchases</option>
            <option value="PETTY_CASH">Petty Cash & Overheads</option>
          </select>

          {/* Payment Method Filter */}
          <select
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
            style={{
              height: '34px',
              borderRadius: '5px',
              border: '1px solid #CBD5E1',
              padding: '0 10px',
              fontSize: '12.5px',
              color: '#334155',
              background: '#FFFFFF',
              outline: 'none',
            }}
          >
            <option value="ALL">All Methods</option>
            <option value="UPI">UPI</option>
            <option value="CASH">Cash</option>
            <option value="CARD">Card</option>
            <option value="BANK_TRANSFER">Bank Transfer</option>
          </select>

          {/* Dates */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Calendar size={14} style={{ color: '#64748B' }} />
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              style={{
                height: '34px',
                padding: '0 8px',
                fontSize: '12px',
                borderRadius: '5px',
                border: '1px solid #CBD5E1',
                color: '#334155',
                outline: 'none',
              }}
            />
            <span style={{ fontSize: '12px', color: '#94A3B8' }}>to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              style={{
                height: '34px',
                padding: '0 8px',
                fontSize: '12px',
                borderRadius: '5px',
                border: '1px solid #CBD5E1',
                color: '#334155',
                outline: 'none',
              }}
            />
          </div>
        </div>

        {/* Ledger Table */}
        <div
          style={{
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: '8px',
            overflow: 'hidden',
          }}
        >
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '60px 0', color: '#64748B' }}>
              <Loader2 className="animate-spin" size={20} />
              <span style={{ marginLeft: '8px', fontSize: '13px' }}>Loading ledger entries...</span>
            </div>
          ) : transactions.length === 0 ? (
            <div style={{ padding: '60px 20px', textAlign: 'center', color: '#64748B' }}>
              <BookOpen size={32} style={{ margin: '0 auto 10px auto', color: '#94A3B8' }} />
              <p style={{ fontSize: '14px', fontWeight: 600, color: '#334155', margin: 0 }}>No ledger transactions found</p>
              <p style={{ fontSize: '12px', color: '#94A3B8', margin: '4px 0 0 0' }}>
                Transactions will appear automatically when POS orders are closed or inventory bills are paid
              </p>
            </div>
          ) : (
            <>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#64748B', textAlign: 'left' }}>
                      <th style={{ padding: '10px 14px', fontWeight: 600 }}>Date</th>
                      <th style={{ padding: '10px 14px', fontWeight: 600 }}>Reference</th>
                      <th style={{ padding: '10px 14px', fontWeight: 600 }}>Flow / Source</th>
                      <th style={{ padding: '10px 14px', fontWeight: 600 }}>Category</th>
                      <th style={{ padding: '10px 14px', fontWeight: 600 }}>Method</th>
                      <th style={{ padding: '10px 14px', fontWeight: 600 }}>Tax / GST</th>
                      <th style={{ padding: '10px 14px', fontWeight: 600, textAlign: 'right' }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((tx) => {
                      const isIncome = tx.entry_type === 'INCOME';
                      return (
                        <tr key={tx.id} style={{ borderBottom: '1px solid #F1F5F9', color: '#334155' }}>
                          <td style={{ padding: '10px 14px', whiteSpace: 'nowrap', fontSize: '12px' }}>
                            {tx.transaction_date}
                          </td>
                          <td style={{ padding: '10px 14px' }}>
                            <div style={{ fontWeight: 600, color: '#0F172A', fontSize: '12.5px' }}>
                              {tx.reference_number || 'Direct Entry'}
                            </div>
                            {tx.description && (
                              <div style={{ fontSize: '11.5px', color: '#64748B', marginTop: '2px' }}>
                                {tx.description}
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '10px 14px' }}>
                            <span
                              style={{
                                display: 'inline-block',
                                padding: '2px 8px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: 600,
                                background: isIncome ? '#ECFDF5' : '#FEF2F2',
                                color: isIncome ? '#047857' : '#DC2626',
                              }}
                            >
                              {isIncome ? 'INCOME' : 'EXPENSE'} • {tx.source}
                            </span>
                          </td>
                          <td style={{ padding: '10px 14px', color: '#475569', fontSize: '12.5px' }}>
                            {tx.category}
                          </td>
                          <td style={{ padding: '10px 14px', fontSize: '12px', fontWeight: 600, color: '#0F172A' }}>
                            {tx.payment_method || 'UPI'}
                          </td>
                          <td style={{ padding: '10px 14px', fontSize: '12px', color: '#64748B' }}>
                            {Number(tx.tax_amount) > 0 ? formatCurrency(Number(tx.tax_amount)) : '—'}
                          </td>
                          <td
                            style={{
                              padding: '10px 14px',
                              textAlign: 'right',
                              fontWeight: 700,
                              color: isIncome ? '#059669' : '#E11D48',
                            }}
                          >
                            {isIncome ? `+${formatCurrency(Number(tx.amount))}` : `-${formatCurrency(Number(tx.amount))}`}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    borderTop: '1px solid #E2E8F0',
                    fontSize: '12.5px',
                    color: '#64748B',
                  }}
                >
                  <div>
                    Showing {transactions.length} of {pagination.totalCount} entries
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      disabled={pagination.page <= 1}
                      onClick={() => fetchLedger(pagination.page - 1)}
                      style={{
                        padding: '4px 10px',
                        border: '1px solid #CBD5E1',
                        borderRadius: '4px',
                        background: '#FFFFFF',
                        cursor: pagination.page <= 1 ? 'not-allowed' : 'pointer',
                        fontSize: '12px',
                      }}
                    >
                      Previous
                    </button>
                    <span style={{ padding: '4px 8px', fontWeight: 600, color: '#0F172A' }}>
                      Page {pagination.page} / {pagination.totalPages}
                    </span>
                    <button
                      disabled={pagination.page >= pagination.totalPages}
                      onClick={() => fetchLedger(pagination.page + 1)}
                      style={{
                        padding: '4px 10px',
                        border: '1px solid #CBD5E1',
                        borderRadius: '4px',
                        background: '#FFFFFF',
                        cursor: pagination.page >= pagination.totalPages ? 'not-allowed' : 'pointer',
                        fontSize: '12px',
                      }}
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </AdminContentWrapper>
    </div>
  );
}
