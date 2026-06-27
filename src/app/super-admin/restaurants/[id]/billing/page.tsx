'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Receipt,
  Settings,
  PlusCircle,
  CreditCard,
  Calendar,
  AlertCircle,
  CheckCircle,
  Clock,
  TrendingUp,
  DollarSign
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

interface RestaurantBilling {
  id: string;
  name: string;
  slug: string;
  billing_tier: string;
  billing_model: string;
  billing_status: string;
  billing_start_date: string | null;
  billing_end_date: string | null;
}

interface Transaction {
  id: string;
  transaction_type: string;
  amount: string;
  reference_id: string;
  description: string;
  created_at: string;
}

interface Summary {
  id: string;
  month: number;
  year: number;
  order_charges: string;
  otp_charges: string;
  subscription_charges: string;
  adjustments: string;
  total_amount: string;
  created_at: string;
}

export default function SuperAdminRestaurantBilling() {
  const { id } = useParams();
  const router = useRouter();
  const [restaurant, setRestaurant] = useState<RestaurantBilling | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [summaries, setSummaries] = useState<Summary[]>([]);
  const [loading, setLoading] = useState(true);

  // Form states for updating billing details
  const [billingTier, setBillingTier] = useState('BASIC');
  const [billingModel, setBillingModel] = useState('SUBSCRIPTION');
  const [billingStatus, setBillingStatus] = useState('ACTIVE');
  const [billingEndDate, setBillingEndDate] = useState('');
  const [updatingDetails, setUpdatingDetails] = useState(false);

  // Form states for new adjustment
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustDesc, setAdjustDesc] = useState('');
  const [submittingAdjust, setSubmittingAdjust] = useState(false);

  const authHeaders = { credentials: 'include' as const };

  const fetchBillingData = useCallback(async () => {
    if (!id) return;
    try {
      // 1. Fetch restaurant info
      const resRes = await fetch(`/api/super-admin/restaurants/${id}`, authHeaders);
      if (resRes.status === 401) {
        router.push('/super-admin/login');
        return;
      }
      const resData = await resRes.json();
      if (!resData.success || !resData.data) {
        toast.error('Restaurant not found');
        router.push('/super-admin');
        return;
      }
      const r = resData.data;
      setRestaurant(r);
      setBillingTier(r.billing_tier || 'BASIC');
      setBillingModel(r.billing_model || 'SUBSCRIPTION');
      setBillingStatus(r.billing_status || 'ACTIVE');
      setBillingEndDate(r.billing_end_date ? r.billing_end_date.split('T')[0] : '');

      // 2. Fetch all transactions and summaries from super-admin billing endpoint
      const billRes = await fetch(`/api/super-admin/billing`, authHeaders);
      const billData = await billRes.json();
      if (billData.success) {
        // Filter transactions for this restaurant
        const rTxs = billData.data.transactions.filter((t: any) => t.restaurant_id === id);
        setTransactions(rTxs);

        // Filter summaries for this restaurant
        const rSummaries = billData.data.summaries.filter((s: any) => s.restaurant_id === id);
        setSummaries(rSummaries);
      }
    } catch (err) {
      toast.error('Failed to load billing data');
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    fetchBillingData();
  }, [fetchBillingData]);



  const handleUpdateBilling = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdatingDetails(true);
    try {
      const res = await fetch(`/api/super-admin/restaurants/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        ...authHeaders,
        body: JSON.stringify({
          billing_tier: billingTier,
          billing_model: billingModel,
          billing_status: billingStatus,
          billing_end_date: billingEndDate || null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Billing details updated successfully!');
        setRestaurant(data.data);
      } else {
        toast.error(data.error || 'Failed to update billing details');
      }
    } catch {
      toast.error('Network error updating billing');
    } finally {
      setUpdatingDetails(false);
    }
  };

  const handleAddAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(adjustAmount);
    if (isNaN(amt)) {
      toast.error('Please enter a valid amount');
      return;
    }
    if (!adjustDesc.trim()) {
      toast.error('Description is required');
      return;
    }

    setSubmittingAdjust(true);
    try {
      const res = await fetch('/api/super-admin/billing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        ...authHeaders,
        body: JSON.stringify({
          restaurant_id: id,
          amount: amt,
          description: adjustDesc,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Adjustment processed successfully!');
        setAdjustAmount('');
        setAdjustDesc('');
        fetchBillingData();
      } else {
        toast.error(data.error || 'Failed to process adjustment');
      }
    } catch {
      toast.error('Network error processing adjustment');
    } finally {
      setSubmittingAdjust(false);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <Clock size={40} className="animate-spin" style={{ color: '#059669', marginBottom: '12px' }} />
        <p style={{ color: '#4b5563', fontWeight: 600 }}>Loading restaurant billing console...</p>
      </div>
    );
  }

  if (!restaurant) return null;

  const currentCycleTransactions = transactions.filter(tx => {
    if (!restaurant.billing_start_date) return true;
    return new Date(tx.created_at) >= new Date(restaurant.billing_start_date);
  });

  const otpTxs = currentCycleTransactions.filter(tx => tx.transaction_type === 'OTP');
  const currentOtpCount = otpTxs.length;
  const currentOtpAmount = otpTxs.reduce((sum, tx) => sum + parseFloat(tx.amount || '0'), 0);

  const orderTxs = currentCycleTransactions.filter(tx => tx.transaction_type === 'PER_ORDER');
  const currentOrderAmount = orderTxs.reduce((sum, tx) => sum + parseFloat(tx.amount || '0'), 0);

  return (
    <div style={styles.page}>
      <Toaster position="top-right" />

      {/* Top Banner Navigation */}
      <div style={styles.topNav}>
        <Link href={`/super-admin/restaurants/${id}`} style={styles.backBtn}>
          <ArrowLeft size={16} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'text-bottom' }} />
          Back to Restaurant Config
        </Link>
        <span style={{ color: '#e2e8f0', margin: '0 12px' }}>|</span>
        <span style={{ color: '#4b5563', fontSize: '13px', fontWeight: 600 }}>
          Billing Engine for <strong>{restaurant.name}</strong>
        </span>
      </div>

      <div style={styles.container}>

        {/* Header */}
        <div style={styles.header}>
          <div>
            <span style={styles.badge}>Billing Dashboard</span>
            <h1 style={styles.title}>{restaurant.name}</h1>
            <p style={styles.subtitle}>Tenant ID: {restaurant.id} • Slug: /{restaurant.slug}</p>
          </div>
          <div style={styles.headerStats}>
            <div style={styles.headerStat}>
              <span style={styles.headerStatLabel}>Tier</span>
              <span style={styles.headerStatVal}>{restaurant.billing_tier || 'BASIC'}</span>
            </div>
            <div style={styles.headerStat}>
              <span style={styles.headerStatLabel}>Model</span>
              <span style={styles.headerStatVal}>{restaurant.billing_model || 'SUBSCRIPTION'}</span>
            </div>
            <div style={styles.headerStat}>
              <span style={styles.headerStatLabel}>Cycle OTPs</span>
              <span style={styles.headerStatVal}>{currentOtpCount} SMS (₹{currentOtpAmount.toFixed(2)})</span>
            </div>
            <div style={styles.headerStat}>
              <span style={styles.headerStatLabel}>Cycle Comm.</span>
              <span style={styles.headerStatVal}>₹{currentOrderAmount.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div style={styles.grid}>
          {/* Left Column: Forms */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

            {/* Form: Update Billing Parameters */}
            <div style={styles.card}>
              <h2 style={styles.cardTitle}>
                <Settings size={18} style={{ marginRight: '8px', color: '#6b7280' }} />
                Update Billing Settings
              </h2>
              <form onSubmit={handleUpdateBilling} style={styles.form}>
                <div style={styles.formRow}>
                  <div style={styles.formField}>
                    <label style={styles.label}>Pricing Tier <span style={{ color: '#059669', fontSize: '9px', marginLeft: '4px' }}>(AUTO)</span></label>
                    <select
                      value={billingTier}
                      onChange={e => setBillingTier(e.target.value)}
                      style={{ ...styles.select, backgroundColor: '#f1f5f9', color: '#64748b', cursor: 'not-allowed' }}
                      disabled
                    >
                      <option value="BASIC">BASIC (₹399/mo, digital menu)</option>
                      <option value="PRO">PRO (₹999/mo, queue)</option>
                      <option value="COMPLETE">COMPLETE (₹1499/mo, queue/ordering)</option>
                    </select>
                    <span style={{ fontSize: '10px', color: '#64748b', marginTop: '-4px' }}>
                      Pricing tier is automatically locked to active modules.
                    </span>
                  </div>

                  <div style={styles.formField}>
                    <label style={styles.label}>Billing Model</label>
                    <select
                      value={billingModel}
                      onChange={e => setBillingModel(e.target.value)}
                      style={styles.select}
                    >
                      <option value="SUBSCRIPTION">SUBSCRIPTION</option>
                      {billingTier === 'COMPLETE' && (
                        <option value="PER_ORDER">COMMISSION (Per-Order)</option>
                      )}
                      {(billingTier === 'PRO' || billingTier === 'COMPLETE') && (
                        <option value="ONE_TIME">ONE-TIME FEE</option>
                      )}
                    </select>
                  </div>
                </div>

                <div style={styles.formRow}>
                  <div style={styles.formField}>
                    <label style={styles.label}>Billing Status</label>
                    <select
                      value={billingStatus}
                      onChange={e => setBillingStatus(e.target.value)}
                      style={styles.select}
                    >
                      <option value="ACTIVE">ACTIVE</option>
                      <option value="TRIAL">TRIAL</option>
                      <option value="OVERDUE">OVERDUE</option>
                      <option value="SUSPENDED">SUSPENDED</option>
                    </select>
                  </div>

                  <div style={styles.formField}>
                    <label style={styles.label}>Billing End Date (Renewal)</label>
                    <input
                      type="date"
                      value={billingEndDate}
                      onChange={e => setBillingEndDate(e.target.value)}
                      style={styles.input}
                    />
                  </div>
                </div>

                <button type="submit" disabled={updatingDetails} style={styles.submitBtn}>
                  {updatingDetails ? 'Saving...' : 'Apply Billing Policy'}
                </button>
              </form>
            </div>

            {/* Form: Add Financial Adjustment */}
            <div style={styles.card}>
              <h2 style={styles.cardTitle}>
                <PlusCircle size={18} style={{ marginRight: '8px', color: '#6b7280' }} />
                Post Credit / Adjustment
              </h2>
              <p style={styles.cardDesc}>Post a financial adjustment (positive for credits/refunds, negative for additional charges) to the restaurant's current cycle ledger.</p>

              <form onSubmit={handleAddAdjustment} style={styles.form}>
                <div style={styles.formField}>
                  <label style={styles.label}>Adjustment Amount (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="e.g. 150.00 or -50.00"
                    value={adjustAmount}
                    onChange={e => setAdjustAmount(e.target.value)}
                    style={styles.input}
                    required
                  />
                </div>

                <div style={styles.formField}>
                  <label style={styles.label}>Description / Reference Reason</label>
                  <input
                    type="text"
                    placeholder="e.g. Loyalty Refund or Excess SMS waiver"
                    value={adjustDesc}
                    onChange={e => setAdjustDesc(e.target.value)}
                    style={styles.input}
                    required
                  />
                </div>

                <button type="submit" disabled={submittingAdjust} style={{ ...styles.submitBtn, backgroundColor: '#0f172a' }}>
                  {submittingAdjust ? 'Processing...' : 'Apply Ledger Adjustment'}
                </button>
              </form>
            </div>

          </div>

          {/* Right Column: Statement Tables */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

            {/* Monthly Statements */}
            <div style={styles.tableCard}>
              <div style={styles.tableHeader}>
                <h3 style={styles.tableTitle}>
                  <Receipt size={16} style={{ marginRight: '6px' }} />
                  Billing Cycles Summary
                </h3>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={styles.table}>
                  <thead>
                    <tr style={styles.trHead}>
                      <th style={styles.th}>Month</th>
                      <th style={styles.th}>Subscription</th>
                      <th style={styles.th}>Commissions</th>
                      <th style={styles.th}>OTP Charges</th>
                      <th style={styles.th}>Adjustments</th>
                      <th style={styles.thAlignRight}>Total Due</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summaries.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={styles.tdEmpty}>No summaries generated.</td>
                      </tr>
                    ) : (
                      summaries.map(s => {
                        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                        return (
                          <tr key={s.id} style={styles.tr}>
                            <td style={styles.tdHighlight}>{months[s.month - 1]} {s.year}</td>
                            <td style={styles.td}>₹{parseFloat(s.subscription_charges || '0').toFixed(2)}</td>
                            <td style={styles.td}>₹{parseFloat(s.order_charges || '0').toFixed(2)}</td>
                            <td style={styles.td}>₹{parseFloat(s.otp_charges || '0').toFixed(2)}</td>
                            <td style={{ ...styles.td, color: parseFloat(s.adjustments || '0') > 0 ? '#059669' : parseFloat(s.adjustments || '0') < 0 ? '#dc2626' : 'inherit' }}>
                              ₹{parseFloat(s.adjustments || '0').toFixed(2)}
                            </td>
                            <td style={styles.tdAlignRightHighlight}>₹{parseFloat(s.total_amount || '0').toFixed(2)}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Audit Logs */}
            <div style={styles.tableCard}>
              <div style={styles.tableHeader}>
                <h3 style={styles.tableTitle}>
                  <TrendingUp size={16} style={{ marginRight: '6px' }} />
                  Recent Billing Operations
                </h3>
              </div>
              <div style={{ overflowX: 'auto', maxHeight: '420px' }}>
                <table style={styles.table}>
                  <thead>
                    <tr style={styles.trHead}>
                      <th style={styles.th}>Date</th>
                      <th style={styles.th}>Type</th>
                      <th style={styles.th}>Description</th>
                      <th style={styles.thAlignRight}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.length === 0 ? (
                      <tr>
                        <td colSpan={4} style={styles.tdEmpty}>No transactions logged.</td>
                      </tr>
                    ) : (
                      transactions.slice(0, 15).map(t => (
                        <tr key={t.id} style={styles.tr}>
                          <td style={styles.td}>{new Date(t.created_at).toLocaleDateString('en-IN')}</td>
                          <td style={styles.td}>
                            <span style={{
                              display: 'inline-block',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontSize: '10px',
                              fontWeight: 700,
                              backgroundColor: t.transaction_type === 'PAYMENT' ? '#ecfdf5' : '#f1f5f9',
                              color: t.transaction_type === 'PAYMENT' ? '#047857' : '#475569'
                            }}>
                              {t.transaction_type}
                            </span>
                          </td>
                          <td style={{ ...styles.td, maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {t.description}
                          </td>
                          <td style={styles.tdAlignRight}>₹{parseFloat(t.amount || '0').toFixed(2)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', backgroundColor: '#f8fafc', fontFamily: "'Inter', sans-serif", paddingBottom: '80px', color: '#0f172a' },
  topNav: { display: 'flex', alignItems: 'center', backgroundColor: '#ffffff', borderBottom: '1px solid #e2e8f0', padding: '12px 32px' },
  backBtn: { fontSize: '13px', color: '#059669', textDecoration: 'none', fontWeight: 700 },
  container: { maxWidth: '1200px', margin: '0 auto', padding: '24px 20px 0' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '24px', backgroundColor: '#ffffff', padding: '24px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.01)' },
  badge: { display: 'inline-block', padding: '3px 8px', borderRadius: '6px', backgroundColor: '#f1f5f9', color: '#475569', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' },
  title: { fontSize: '28px', fontWeight: 800, color: '#0f172a', margin: 0, letterSpacing: '-0.02em' },
  subtitle: { fontSize: '13px', color: '#64748b', marginTop: '4px', margin: 0 },
  headerStats: { display: 'flex', gap: '20px' },
  headerStat: { display: 'flex', flexDirection: 'column', padding: '8px 16px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' },
  headerStatLabel: { fontSize: '10px', textTransform: 'uppercase', fontWeight: 700, color: '#64748b', letterSpacing: '0.04em' },
  headerStatVal: { fontSize: '16px', fontWeight: 800, color: '#0f172a', marginTop: '2px' },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: '24px', alignItems: 'start' },
  card: { backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.01)' },
  cardTitle: { fontSize: '16px', fontWeight: 800, color: '#0f172a', margin: '0 0 16px', display: 'flex', alignItems: 'center' },
  cardDesc: { fontSize: '12px', color: '#64748b', marginTop: '-8px', marginBottom: '16px', lineHeight: '1.5' },
  form: { display: 'flex', flexDirection: 'column', gap: '16px' },
  formRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' },
  formField: { display: 'flex', flexDirection: 'column', gap: '6px' },
  label: { display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' },
  input: { width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', color: '#0f172a', fontSize: '14px', outline: 'none', transition: 'border-color 0.2s', boxSizing: 'border-box' },
  select: { width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', color: '#0f172a', backgroundColor: 'white', fontSize: '14px', outline: 'none', boxSizing: 'border-box' },
  submitBtn: { padding: '12px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 700, cursor: 'pointer', boxShadow: '0 2px 8px rgba(16,185,129,0.2)', transition: 'all 0.2s' },
  tableCard: { backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.01)' },
  tableHeader: { padding: '16px 20px', borderBottom: '1px solid #f1f5f9', backgroundColor: '#ffffff' },
  tableTitle: { fontSize: '14px', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', margin: 0 },
  table: { width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' },
  trHead: { backgroundColor: '#f9fafb', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 600 },
  th: { padding: '10px 16px' },
  thAlignRight: { padding: '10px 16px', textAlign: 'right' },
  tr: { borderBottom: '1px solid #f1f5f9', color: '#334155' },
  tdHighlight: { padding: '12px 16px', fontWeight: 700, color: '#0f172a' },
  td: { padding: '12px 16px' },
  tdAlignRight: { padding: '12px 16px', textAlign: 'right' },
  tdAlignRightHighlight: { padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: '#0f172a' },
  tdEmpty: { padding: '24px', textAlign: 'center', color: '#94a3b8' }
};
