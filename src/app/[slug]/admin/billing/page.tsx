'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { 
  Receipt, 
  CreditCard, 
  Calendar, 
  AlertCircle, 
  ShieldCheck, 
  Info, 
  DollarSign,
  TrendingUp
} from 'lucide-react';
import toast from 'react-hot-toast';
import RecentBillingOperations from '@/components/billing/RecentBillingOperations';
import { AdminContentWrapper } from '@/components/AdminContentWrapper';
import { AdminPageHeader } from '@/components/AdminPageHeader';
import { LayoutMaximizeToggle } from '@/components/LayoutMaximizeToggle';

interface BillingData {
  restaurant: {
    id: string;
    name: string;
    slug: string;
    billing_tier: string;
    billing_model: string;
    billing_period: string;
    billing_status: string;
    billing_start_date: string | null;
    billing_end_date: string | null;
  };
  transactions: Array<{
    id: string;
    transaction_type: string;
    amount: string;
    reference_id: string;
    description: string;
    created_at: string;
  }>;
  summaries: Array<{
    id: string;
    month: number;
    year: number;
    order_charges: string;
    otp_charges: string;
    subscription_charges: string;
    adjustments: string;
    total_amount: string;
    status?: string;
    created_at: string;
  }>;
  pricingConfig: {
    name: string;
    subscriptionPrice: number;
    features: string[];
    perOrderCommission?: {
      threshold: number;
      belowPercent: number;
      aboveFlat: number;
    };
    otpCharge?: number;
  } | null;
  todayOtpUsage?: {
    count: number;
    amount: number;
  };
}

const getTodayStr = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function BillingPage() {
  const { slug } = useParams();
  const [data, setData] = useState<BillingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [paginatedTransactions, setPaginatedTransactions] = useState<any[]>([]);
  const [totalTxs, setTotalTxs] = useState(0);
  const [rangeOtpStats, setRangeOtpStats] = useState<{ count: number; amount: number } | null>(null);
  const [txPage, setTxPage] = useState(1);
  const [txDateFrom, setTxDateFrom] = useState(getTodayStr());
  const [txDateTo, setTxDateTo] = useState(getTodayStr());
  const [txLoading, setTxLoading] = useState(false);

  useEffect(() => {
    const todayStr = getTodayStr();
    fetch(`/api/admin/billing?today=${todayStr}`, {
      headers: {
        'x-restaurant-slug': slug as string,
        'Authorization': `Bearer ${localStorage.getItem('admin_token') || localStorage.getItem('staff_token') || localStorage.getItem('auth_token') || ''}`
      }
    })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load billing information.');
        return res.json();
      })
      .then((resData) => {
        if (resData.success) {
          setData(resData.data);
        } else {
          throw new Error(resData.error || 'Failed to fetch billing data.');
        }
      })
      .catch((err) => {
        setError(err.message);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [slug]);

  useEffect(() => {
    if (!slug) return;
    setTxLoading(true);
    
    const url = new URL(window.location.origin + '/api/admin/billing/transactions');
    url.searchParams.append('page', txPage.toString());
    url.searchParams.append('limit', '10');
    if (txDateFrom) url.searchParams.append('dateFrom', txDateFrom);
    if (txDateTo) url.searchParams.append('dateTo', txDateTo);

    fetch(url.toString(), {
      headers: {
        'x-restaurant-slug': slug as string,
        'Authorization': `Bearer ${localStorage.getItem('admin_token') || localStorage.getItem('staff_token') || localStorage.getItem('auth_token') || ''}`
      }
    })
      .then((res) => res.json())
      .then((resData) => {
        if (resData.success) {
          setPaginatedTransactions(resData.data.transactions);
          setTotalTxs(resData.data.totalTransactions || 0);
          if (resData.data.otpStats) {
            setRangeOtpStats(resData.data.otpStats);
          }
        } else {
          toast.error('Failed to load transactions');
        }
      })
      .catch(() => {
        toast.error('Network error loading transactions');
      })
      .finally(() => {
        setTxLoading(false);
      });
  }, [slug, txPage, txDateFrom, txDateTo]);

  if (loading) {
    return (
      <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ height: '40px', width: '200px', backgroundColor: '#e2e8f0', borderRadius: '6px', marginBottom: '24px', animation: 'pulse 2s infinite' }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginBottom: '30px' }}>
          {[1, 2, 3].map((i) => (
            <div key={i} style={{ height: '140px', backgroundColor: '#e2e8f0', borderRadius: '8px', animation: 'pulse 2s infinite' }} />
          ))}
        </div>
        <div style={{ height: '300px', backgroundColor: '#e2e8f0', borderRadius: '8px', animation: 'pulse 2s infinite' }} />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ padding: '24px', maxWidth: '600px', margin: '40px auto', textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', padding: '16px', borderRadius: '50%', backgroundColor: '#fef2f2', color: '#ef4444', marginBottom: '16px' }}>
          <AlertCircle size={36} />
        </div>
        <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '8px', color: '#1f2937' }}>Billing Loading Error</h2>
        <p style={{ color: '#6b7280', marginBottom: '20px' }}>{error || 'Could not load your billing dashboard.'}</p>
      </div>
    );
  }

  const { restaurant, transactions, summaries, pricingConfig } = data;

  const currentOtpCount = rangeOtpStats ? rangeOtpStats.count : (data.todayOtpUsage?.count ?? 0);
  const currentOtpAmount = rangeOtpStats ? rangeOtpStats.amount : (data.todayOtpUsage?.amount ?? 0);

  const getDateRangeLabel = () => {
    if (txDateFrom && txDateTo) {
      if (txDateFrom === txDateTo) {
        return `Date: ${new Date(txDateFrom).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`;
      }
      return `${new Date(txDateFrom).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} - ${new Date(txDateTo).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`;
    } else if (txDateFrom) {
      return `From ${new Date(txDateFrom).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`;
    } else if (txDateTo) {
      return `Until ${new Date(txDateTo).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`;
    }
    return 'All Time Total Accrued';
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status.toUpperCase()) {
      case 'ACTIVE':
        return { bg: '#ecfdf5', text: '#059669', border: '#a7f3d0' };
      case 'TRIAL':
        return { bg: '#eff6ff', text: '#2563eb', border: '#bfdbfe' };
      case 'OVERDUE':
        return { bg: '#fff7ed', text: '#ea580c', border: '#ffedd5' };
      default:
        return { bg: '#fef2f2', text: '#dc2626', border: '#fecaca' };
    }
  };

  const statusStyle = getStatusColor(restaurant.billing_status || 'ACTIVE');

  return (
    <AdminContentWrapper fullWidth style={{ paddingTop: 0, paddingLeft: 0, paddingRight: 0, maxWidth: '100%', fontFamily: 'inherit' }}>
      <style>{`
        .billing-page-header {
          height: 68px !important;
          min-height: 68px !important;
          display: flex !important;
          align-items: center !important;
          margin: 0 !important;
          padding: 0 20px !important;
          border-bottom: 1px solid var(--border) !important;
          background: #FFFFFF !important;
          box-sizing: border-box !important;
        }

        .billing-page-header .admin-page-header-container {
          height: 68px !important;
          min-height: 68px !important;
          display: flex !important;
          align-items: center !important;
          margin: 0 !important;
          padding: 0 !important;
          gap: 12px !important;
          width: 100% !important;
        }

        .billing-toolbar {
          display: flex !important;
          flex-wrap: nowrap !important;
          align-items: center !important;
          gap: 10px !important;
          width: 100% !important;
          min-width: 0 !important;
        }

        .billing-actions {
          display: flex !important;
          flex-wrap: nowrap !important;
          align-items: center !important;
          gap: 8px !important;
          margin-left: auto !important;
          flex-shrink: 0 !important;
        }

        @media (max-width: 768px) {
          .billing-page-header {
            height: auto !important;
            min-height: auto !important;
            padding: 12px 16px !important;
          }

          .billing-toolbar {
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 10px !important;
          }

          .billing-actions {
            width: 100% !important;
            margin-left: 0 !important;
            justify-content: space-between !important;
            flex-wrap: wrap !important;
          }
        }
      `}</style>
      <AdminPageHeader
        className="billing-page-header"
        style={{ paddingTop: 0, minHeight: '68px', display: 'flex', alignItems: 'center', marginBottom: 0 }}
        hideMaximize={true}
        search={
          <div className="billing-toolbar">
            {/* Left: Status Control */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                height: '38px',
                padding: '0 12px',
                borderRadius: '8px',
                backgroundColor: statusStyle.bg,
                color: statusStyle.text,
                border: `1px solid ${statusStyle.border}`,
                fontWeight: 700,
                fontSize: '11px',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                whiteSpace: 'nowrap'
              }}>
                {restaurant.billing_status === 'ACTIVE' ? <ShieldCheck size={14} /> : <AlertCircle size={14} />}
                <span>{restaurant.billing_status || 'ACTIVE'} STATUS</span>
              </div>
            </div>

            {/* Right: Maximize Toggle */}
            <div className="billing-actions">
              <div style={{ borderLeft: '1px solid #E2E8F0', paddingLeft: '8px', display: 'flex', alignItems: 'center', height: '32px' }}>
                <LayoutMaximizeToggle />
              </div>
            </div>
          </div>
        }
      />

      <div style={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box', margin: 0, padding: 0 }}>
        {/* Pricing and Tier Overview Cards */}
        <div style={{ padding: '20px', background: '#F8FAFC', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
            {/* Active Plan Card */}
            <div style={{ 
              backgroundColor: 'white', 
              borderRadius: '8px', 
              border: '1px solid #e5e7eb', 
              padding: '20px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
            }}>
              <h2 style={{ fontSize: '12px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>Current Plan</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginBottom: '12px' }}>
                <span style={{ fontSize: '24px', fontWeight: 800, color: '#111827', lineHeight: 1.1 }}>{restaurant.billing_tier || 'BASIC'}</span>
                <span style={{ fontSize: '11px', color: '#059669', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{restaurant.billing_model || 'SUBSCRIPTION'} MODEL</span>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '14px', fontSize: '13px', color: '#4b5563' }}>
                {restaurant.billing_model === 'SUBSCRIPTION' ? (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed #f3f4f6', paddingBottom: '6px' }}>
                      <span>Base Subscription:</span>
                      <strong style={{ color: '#111827' }}>₹{pricingConfig?.subscriptionPrice || 0}/month</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed #f3f4f6', paddingBottom: '6px' }}>
                      <span>Cycle Start Date:</span>
                      <strong style={{ color: '#111827' }}>{formatDate(restaurant.billing_start_date)}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Renewal/End Date:</span>
                      <strong style={{ color: '#111827' }}>{formatDate(restaurant.billing_end_date)}</strong>
                    </div>
                  </>
                ) : restaurant.billing_model === 'PER_ORDER' ? (
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '6px' }}>
                    <span>Commission Structure:</span>
                    <strong style={{ color: '#111827' }}>Pay-Per-Order</strong>
                  </div>
                ) : (
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '6px' }}>
                    <span>Fee Structure:</span>
                    <strong style={{ color: '#111827' }}>One-Time Payment</strong>
                  </div>
                )}
              </div>
            </div>

            {/* Total OTP Usage Card */}
            <div style={{ 
              backgroundColor: 'white', 
              borderRadius: '8px', 
              border: '1px solid #e5e7eb', 
              padding: '20px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
            }}>
              <h2 style={{ fontSize: '12px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>Total OTP Usage</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginBottom: '12px' }}>
                <span style={{ fontSize: '24px', fontWeight: 800, color: '#111827', lineHeight: 1.1 }}>₹{currentOtpAmount.toFixed(2)}</span>
                <span style={{ fontSize: '11px', color: '#4b5563', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{getDateRangeLabel()}</span>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '14px', fontSize: '13px', color: '#4b5563' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>OTPs Successfully Sent:</span>
                  <strong style={{ color: '#111827' }}>{currentOtpCount} SMS (₹{currentOtpAmount.toFixed(2)})</strong>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Monthly Billing Summaries (Invoices) Table - Flush edge-to-edge */}
        <div style={{ width: '100%', background: '#FFFFFF', borderBottom: '1px solid var(--border)', overflow: 'hidden', borderRadius: 0, margin: 0, padding: 0 }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', background: '#FFFFFF' }}>
            <h2 style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              <Receipt size={16} style={{ color: 'var(--primary, #971345)' }} />
              <span>Monthly Statements</span>
            </h2>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Generated aggregates at the end of each billing cycle</span>
          </div>
          
          <div className="table-wrapper" style={{ border: 'none', borderRadius: 0, overflowX: 'auto', width: '100%' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#F8FAFC', borderBottom: '1px solid var(--border)', color: '#475569', fontWeight: 600 }}>
                  <th style={{ paddingLeft: '20px' }}>Billing Cycle</th>
                  <th>Sub. Fee</th>
                  <th>Order Commissions</th>
                  <th>OTP Delivery Costs</th>
                  <th>Adjustments</th>
                  <th style={{ textAlign: 'right' }}>Total Amount</th>
                  <th style={{ textAlign: 'center', paddingRight: '20px' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {summaries.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: '48px 20px', textAlign: 'center', color: '#9ca3af' }}>
                      No statements generated yet. Statements compile at the end of the monthly cycle.
                    </td>
                  </tr>
                ) : (
                  summaries.map((summary) => {
                    const cycleDay = restaurant.billing_start_date ? new Date(restaurant.billing_start_date).getDate() : 1;
                    const start = new Date(summary.year, summary.month - 1, cycleDay);
                    const end = new Date(start);
                    end.setMonth(end.getMonth() + 1);
                    const startStr = start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
                    const endStr = end.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
                    const cycleName = `${startStr} to ${endStr}`;
                    return (
                      <tr key={summary.id} style={{ borderBottom: '1px solid #f3f4f6', color: '#374151' }}>
                        <td style={{ paddingLeft: '20px', fontWeight: 600, color: '#111827' }}>{cycleName}</td>
                        <td>₹{parseFloat(summary.subscription_charges || '0').toFixed(2)}</td>
                        <td>₹{parseFloat(summary.order_charges || '0').toFixed(2)}</td>
                        <td>₹{parseFloat(summary.otp_charges || '0').toFixed(2)}</td>
                        <td style={{ 
                          color: parseFloat(summary.adjustments || '0') > 0 ? '#059669' : parseFloat(summary.adjustments || '0') < 0 ? '#dc2626' : 'inherit' 
                        }}>
                          ₹{parseFloat(summary.adjustments || '0').toFixed(2)}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: '#111827' }}>
                          ₹{parseFloat(summary.total_amount || '0').toFixed(2)}
                        </td>
                        <td style={{ textAlign: 'center', paddingRight: '20px' }}>
                          <span style={{
                            padding: '3px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 700,
                            background: summary.status === 'PAID' ? '#dcfce7' : '#fee2e2',
                            color: summary.status === 'PAID' ? '#166534' : '#991b1b',
                            border: `1px solid ${summary.status === 'PAID' ? '#bbf7d0' : '#fecaca'}`
                          }}>
                            {summary.status || 'UNPAID'}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Transaction History (Audit Logs) - Flush edge-to-edge */}
        <div style={{ width: '100%', background: '#FFFFFF', borderBottom: '1px solid var(--border)', overflow: 'hidden', borderRadius: 0, margin: 0, padding: 0 }}>
          <RecentBillingOperations
            transactions={paginatedTransactions}
            totalTxs={totalTxs}
            txPage={txPage}
            setTxPage={setTxPage}
            txDateFrom={txDateFrom}
            setTxDateFrom={setTxDateFrom}
            txDateTo={txDateTo}
            setTxDateTo={setTxDateTo}
            txLoading={txLoading}
          />
        </div>
      </div>
    </AdminContentWrapper>
  );
}
