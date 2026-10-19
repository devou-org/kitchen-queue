'use client';
import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { FinanceNav } from '@/components/modules/finance/FinanceNav';
import {
  Plus,
  Trash2,
  Receipt,
  Search,
  Calendar,
  IndianRupee,
  X,
  Loader2,
  QrCode,
  Banknote,
  CreditCard,
  Building,
} from 'lucide-react';
import { AdminPageHeader } from '@/components/AdminPageHeader';
import { AdminContentWrapper } from '@/components/AdminContentWrapper';
import { useRestaurant } from '@/hooks/useRestaurant';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { Pagination } from '@/components/ui/Pagination';
import toast, { Toaster } from 'react-hot-toast';

const EXPENSE_CATEGORIES = [
  'Electricity & Utilities',
  'Staff Wages & Salaries',
  'Store Rent & Maintenance',
  'Repairs & Servicing',
  'Marketing & Promotions',
  'Packaging & Disposables',
  'Fuel & Transportation',
  'Cleaning & Hygiene',
  'Software & Subscriptions',
  'Miscellaneous Operating Expense',
];

export default function PettyCashExpensesPage() {
  const params = useParams();
  const slug = (params?.slug as string) || '';
  const { restaurant } = useRestaurant();

  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const pageSize = 25;
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    category: EXPENSE_CATEGORIES[0],
    amount: '',
    taxAmount: '0',
    paymentMethod: 'UPI', // Default to UPI as requested
    transactionDate: new Date().toISOString().split('T')[0],
    referenceNumber: '',
    description: '',
  });

  const fetchExpenses = useCallback(async () => {
    if (!slug) return;
    setLoading(true);
    try {
      const q = new URLSearchParams({
        slug,
        entryType: 'EXPENSE',
        source: 'PETTY_CASH',
        page: String(page),
        limit: String(pageSize),
      });
      if (selectedCategory !== 'ALL') q.set('category', selectedCategory);
      if (search.trim()) q.set('search', search.trim());

      const res = await fetch(`/api/admin/finance/transactions?${q.toString()}`);
      const json = await res.json();
      if (json.success) {
        setTransactions(json.data || []);
        setTotalCount(json.pagination?.totalCount || 0);
        setTotalPages(json.pagination?.totalPages || 1);
      } else {
        toast.error(json.error || 'Failed to fetch expenses');
      }
    } catch {
      toast.error('Network error fetching expenses');
    } finally {
      setLoading(false);
    }
  }, [slug, selectedCategory, search, page]);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  const handleSubmitExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(form.amount);
    if (!numAmount || numAmount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/finance/transactions?slug=${slug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: form.category,
          amount: numAmount,
          taxAmount: parseFloat(form.taxAmount) || 0,
          paymentMethod: form.paymentMethod,
          transactionDate: form.transactionDate,
          referenceNumber: form.referenceNumber,
          description: form.description,
        }),
      });

      const json = await res.json();
      if (json.success) {
        toast.success('Expense recorded successfully');
        setIsModalOpen(false);
        setForm({
          category: EXPENSE_CATEGORIES[0],
          amount: '',
          taxAmount: '0',
          paymentMethod: 'UPI',
          transactionDate: new Date().toISOString().split('T')[0],
          referenceNumber: '',
          description: '',
        });
        fetchExpenses();
      } else {
        toast.error(json.error || 'Failed to log expense');
      }
    } catch {
      toast.error('Error logging expense');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteExpense = async (id: string) => {
    if (!confirm('Are you sure you want to delete this expense entry?')) return;
    try {
      const res = await fetch(`/api/admin/finance/transactions?slug=${slug}&id=${id}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (json.success) {
        toast.success('Expense deleted');
        fetchExpenses();
      } else {
        toast.error(json.error || 'Failed to delete');
      }
    } catch {
      toast.error('Network error deleting expense');
    }
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
              <button
                onClick={() => setIsModalOpen(true)}
                style={{
                  height: '36px',
                  padding: '0 14px',
                  background: 'var(--primary, #971345)',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '13px',
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
                <Plus size={15} />
                <span>Record Expense</span>
              </button>
            </div>
          </div>
        }
      />

      <AdminContentWrapper>
        {/* Title inside page content */}
        <div style={{ marginBottom: '16px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#0F172A', margin: 0, letterSpacing: '-0.01em' }}>
            Petty Cash & Overheads
          </h2>
        </div>
        {/* Filters */}
        <div
          style={{
            background: '#FFFFFF',
            border: '1px solid #F1F5F9',
            borderRadius: '12px',
            padding: '12px 16px',
            marginBottom: '16px',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.02)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: '240px' }}>
            <Search size={14} style={{ color: '#64748B' }} />
            <input
              type="text"
              placeholder="Search by description or reference..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: '100%',
                maxWidth: '320px',
                height: '32px',
                border: '1px solid #CBD5E1',
                borderRadius: '5px',
                padding: '0 10px',
                fontSize: '13px',
                color: '#334155',
                outline: 'none',
              }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', color: '#64748B', fontWeight: 500 }}>Category:</span>
            <div style={{ width: '220px' }}>
              <CustomSelect
                value={selectedCategory}
                onChange={(val) => {
                  setSelectedCategory(val);
                  setPage(1);
                }}
                options={[
                  { value: 'ALL', label: 'All Categories' },
                  ...EXPENSE_CATEGORIES.map((cat) => ({ value: cat, label: cat }))
                ]}
                buttonStyle={{ height: '34px', fontSize: '12.5px', borderRadius: '6px' }}
              />
            </div>
          </div>
        </div>

        {/* Expenses Table */}
        <div
          style={{
            background: '#FFFFFF',
            border: '1px solid #F1F5F9',
            borderRadius: '12px',
            overflow: 'hidden',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.02)',
          }}
        >
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '60px 0', color: '#64748B' }}>
              <Loader2 className="animate-spin" size={20} />
              <span style={{ marginLeft: '8px', fontSize: '13px' }}>Loading petty cash entries...</span>
            </div>
          ) : transactions.length === 0 ? (
            <div style={{ padding: '60px 20px', textAlign: 'center', color: '#64748B' }}>
              <Receipt size={32} style={{ margin: '0 auto 10px auto', color: '#94A3B8' }} />
              <p style={{ fontSize: '14px', fontWeight: 600, color: '#334155', margin: 0 }}>No expenses recorded yet</p>
              <p style={{ fontSize: '12px', color: '#94A3B8', margin: '4px 0 16px 0' }}>
                Log daily electricity bills, wages, repairs, and store overheads
              </p>
              <button
                onClick={() => setIsModalOpen(true)}
                style={{
                  height: '34px',
                  padding: '0 14px',
                  background: 'var(--primary, #971345)',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.08)',
                }}
              >
                Record First Expense
              </button>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#64748B', textAlign: 'left' }}>
                    <th style={{ padding: '10px 14px', fontWeight: 600 }}>Date</th>
                    <th style={{ padding: '10px 14px', fontWeight: 600 }}>Category</th>
                    <th style={{ padding: '10px 14px', fontWeight: 600 }}>Description</th>
                    <th style={{ padding: '10px 14px', fontWeight: 600 }}>Payment Method</th>
                    <th style={{ padding: '10px 14px', fontWeight: 600 }}>Tax / GST</th>
                    <th style={{ padding: '10px 14px', fontWeight: 600, textAlign: 'right' }}>Amount</th>
                    <th style={{ padding: '10px 14px', fontWeight: 600, textAlign: 'center' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx) => (
                    <tr key={tx.id} style={{ borderBottom: '1px solid #F1F5F9', color: '#334155' }}>
                      <td style={{ padding: '10px 14px', whiteSpace: 'nowrap', fontSize: '12px' }}>
                        {tx.transaction_date}
                      </td>
                      <td style={{ padding: '10px 14px', fontWeight: 500 }}>
                        <span
                          style={{
                            background: '#F1F5F9',
                            color: '#334155',
                            padding: '3px 8px',
                            borderRadius: '4px',
                            fontSize: '12px',
                          }}
                        >
                          {tx.category}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px', color: '#475569', maxWidth: '300px' }}>
                        <div>{tx.description || '—'}</div>
                        {tx.reference_number && (
                          <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '2px' }}>
                            Ref: {tx.reference_number}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: '12px' }}>
                        <span style={{ fontWeight: 600, color: '#0F172A' }}>{tx.payment_method || 'UPI'}</span>
                      </td>
                      <td style={{ padding: '10px 14px', color: '#64748B', fontSize: '12px' }}>
                        {Number(tx.tax_amount) > 0 ? formatCurrency(Number(tx.tax_amount)) : '₹0.00'}
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: '#E11D48' }}>
                        {formatCurrency(Number(tx.amount))}
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                        <button
                          onClick={() => handleDeleteExpense(tx.id)}
                          title="Delete entry"
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#94A3B8',
                            cursor: 'pointer',
                            padding: '4px',
                            borderRadius: '4px',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.color = '#DC2626')}
                          onMouseLeave={(e) => (e.currentTarget.style.color = '#94A3B8')}
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {totalPages > 1 && (
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              totalRecords={totalCount}
              pageSize={pageSize}
              onPageChange={(p) => setPage(p)}
            />
          )}
        </div>
      </AdminContentWrapper>

      {/* Record Expense Modal */}
      {isModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.45)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '16px',
          }}
        >
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: '10px',
              width: '100%',
              maxWidth: '480px',
              border: '1px solid #E2E8F0',
              boxShadow: '0 12px 36px rgba(0,0,0,0.12)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '16px 20px',
                borderBottom: '1px solid #E2E8F0',
              }}
            >
              <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#0F172A', margin: 0 }}>
                Record Operating Expense
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748B' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmitExpense} style={{ padding: '20px' }}>
              {/* Category */}
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Expense Category *
                </label>
                <CustomSelect
                  value={form.category}
                  onChange={(val) => setForm({ ...form, category: val })}
                  options={EXPENSE_CATEGORIES.map((cat) => ({ value: cat, label: cat }))}
                  buttonStyle={{ height: '36px', fontSize: '13px', borderRadius: '6px' }}
                />
              </div>

              {/* Amount & Tax */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                    Total Amount (₹) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    required
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    style={{
                      width: '100%',
                      height: '36px',
                      borderRadius: '6px',
                      border: '1px solid #CBD5E1',
                      padding: '0 10px',
                      fontSize: '13px',
                      outline: 'none',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                    Tax / GST Component (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={form.taxAmount}
                    onChange={(e) => setForm({ ...form, taxAmount: e.target.value })}
                    style={{
                      width: '100%',
                      height: '36px',
                      borderRadius: '6px',
                      border: '1px solid #CBD5E1',
                      padding: '0 10px',
                      fontSize: '13px',
                      outline: 'none',
                    }}
                  />
                </div>
              </div>

              {/* Payment Method (Default UPI) */}
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Payment Method *
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                  {[
                    { id: 'UPI', label: 'UPI', icon: QrCode },
                    { id: 'CASH', label: 'Cash', icon: Banknote },
                    { id: 'CARD', label: 'Card', icon: CreditCard },
                    { id: 'BANK_TRANSFER', label: 'Bank', icon: Building },
                  ].map((m) => {
                    const Icon = m.icon;
                    const selected = form.paymentMethod === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setForm({ ...form, paymentMethod: m.id })}
                        style={{
                          height: '34px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '4px',
                          borderRadius: '5px',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          border: selected ? '1.5px solid var(--primary, #971345)' : '1px solid #CBD5E1',
                          background: selected ? 'var(--primary, #971345)' : '#FFFFFF',
                          color: selected ? '#FFFFFF' : '#475569',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <Icon size={13} />
                        <span>{m.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Date & Voucher Ref */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                    Expense Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={form.transactionDate}
                    onChange={(e) => setForm({ ...form, transactionDate: e.target.value })}
                    style={{
                      width: '100%',
                      height: '36px',
                      borderRadius: '6px',
                      border: '1px solid #CBD5E1',
                      padding: '0 10px',
                      fontSize: '13px',
                      outline: 'none',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                    Bill / Voucher # (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. INV-2026-01"
                    value={form.referenceNumber}
                    onChange={(e) => setForm({ ...form, referenceNumber: e.target.value })}
                    style={{
                      width: '100%',
                      height: '36px',
                      borderRadius: '6px',
                      border: '1px solid #CBD5E1',
                      padding: '0 10px',
                      fontSize: '13px',
                      outline: 'none',
                    }}
                  />
                </div>
              </div>

              {/* Description */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Description / Remarks
                </label>
                <textarea
                  rows={2}
                  placeholder="Notes about this expense (e.g., Water bill for September)..."
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
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

              {/* Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  style={{
                    height: '36px',
                    padding: '0 14px',
                    borderRadius: '6px',
                    border: '1px solid #CBD5E1',
                    background: '#FFFFFF',
                    color: '#475569',
                    fontSize: '13px',
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    height: '36px',
                    padding: '0 16px',
                    borderRadius: '6px',
                    border: 'none',
                    background: 'var(--primary, #971345)',
                    color: '#FFFFFF',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: submitting ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.08)',
                  }}
                >
                  {submitting && <Loader2 size={14} className="animate-spin" />}
                  <span>Save Expense</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
