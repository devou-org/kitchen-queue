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
}

export default function BillingPage() {
  const { slug } = useParams();
  const [data, setData] = useState<BillingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [paginatedTransactions, setPaginatedTransactions] = useState<any[]>([]);
  const [totalTxs, setTotalTxs] = useState(0);
  const [txPage, setTxPage] = useState(1);
  const [txDateFrom, setTxDateFrom] = useState('');
  const [txDateTo, setTxDateTo] = useState('');
  const [txLoading, setTxLoading] = useState(false);

  useEffect(() => {
    fetch('/api/admin/billing', {
      headers: {
        'x-restaurant-slug': slug as string
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
        'x-restaurant-slug': slug as string
      }
    })
      .then((res) => res.json())
      .then((resData) => {
        if (resData.success) {
          setPaginatedTransactions(resData.data.transactions);
          setTotalTxs(resData.data.totalTransactions || 0);
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
            <div key={i} style={{ height: '140px', backgroundColor: '#e2e8f0', borderRadius: '12px', animation: 'pulse 2s infinite' }} />
          ))}
        </div>
        <div style={{ height: '300px', backgroundColor: '#e2e8f0', borderRadius: '12px', animation: 'pulse 2s infinite' }} />
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

  const currentCycleTransactions = transactions.filter(tx => {
    if (!restaurant.billing_start_date) return true;
    return new Date(tx.created_at) >= new Date(restaurant.billing_start_date);
  });

  const otpTxs = currentCycleTransactions.filter(tx => tx.transaction_type === 'OTP');
  const currentOtpCount = otpTxs.length;
  const currentOtpAmount = otpTxs.reduce((sum, tx) => sum + parseFloat(tx.amount || '0'), 0);

  const orderTxs = currentCycleTransactions.filter(tx => tx.transaction_type === 'PER_ORDER');
  const currentOrderAmount = orderTxs.reduce((sum, tx) => sum + parseFloat(tx.amount || '0'), 0);

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
    <AdminContentWrapper style={{ fontFamily: 'inherit' }}>
      <AdminPageHeader
        title="Billing & Invoices"
        description="Manage subscription tiers, view commission rates, and review past statement logs."
        action={
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px', 
            padding: '8px 16px', 
            borderRadius: '9999px', 
            backgroundColor: statusStyle.bg, 
            color: statusStyle.text,
            border: `1px solid ${statusStyle.border}`,
            fontWeight: 700,
            fontSize: '14px',
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}>
            {restaurant.billing_status === 'ACTIVE' ? <ShieldCheck size={16} /> : <AlertCircle size={16} />}
            {restaurant.billing_status || 'ACTIVE'} STATUS
          </div>
        }
      />

      {/* Pricing and Tier Overview Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '24px', marginBottom: '32px' }}>
        
        {/* Active Plan Card */}
        <div style={{ 
          backgroundColor: 'white', 
          borderRadius: '16px', 
          border: '1px solid #e5e7eb', 
          padding: '24px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
        }}>
          <h2 style={{ fontSize: '13px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '16px' }}>Current Plan</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '12px' }}>
            <span style={{ fontSize: '26px', fontWeight: 800, color: '#111827', lineHeight: 1.1 }}>{restaurant.billing_tier || 'BASIC'}</span>
            <span style={{ fontSize: '11px', color: '#059669', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{restaurant.billing_model || 'SUBSCRIPTION'} MODEL</span>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '16px', fontSize: '13px', color: '#4b5563' }}>
            {restaurant.billing_model === 'SUBSCRIPTION' ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed #f3f4f6', paddingBottom: '8px' }}>
                  <span>Base Subscription:</span>
                  <strong style={{ color: '#111827' }}>₹{pricingConfig?.subscriptionPrice || 0}/month</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed #f3f4f6', paddingBottom: '8px' }}>
                  <span>Cycle Start Date:</span>
                  <strong style={{ color: '#111827' }}>{formatDate(restaurant.billing_start_date)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Renewal/End Date:</span>
                  <strong style={{ color: '#111827' }}>{formatDate(restaurant.billing_end_date)}</strong>
                </div>
              </>
            ) : restaurant.billing_model === 'PER_ORDER' ? (
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px' }}>
                <span>Commission Structure:</span>
                <strong style={{ color: '#111827' }}>Pay-Per-Order</strong>
              </div>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px' }}>
                <span>Fee Structure:</span>
                <strong style={{ color: '#111827' }}>One-Time Payment</strong>
              </div>
            )}
          </div>
        </div>



        {/* OTP Usage & Accrued Charges Card */}
        <div style={{ 
          backgroundColor: 'white', 
          borderRadius: '16px', 
          border: '1px solid #e5e7eb', 
          padding: '24px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
        }}>
          <h2 style={{ fontSize: '13px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '16px' }}>Current Cycle Usage</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '12px' }}>
            <span style={{ fontSize: '26px', fontWeight: 800, color: '#111827', lineHeight: 1.1 }}>₹{(currentOtpAmount + currentOrderAmount).toFixed(2)}</span>
            <span style={{ fontSize: '11px', color: '#4b5563', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Accrued This Cycle</span>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '16px', fontSize: '13px', color: '#4b5563' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed #f3f4f6', paddingBottom: '8px' }}>
              <span>OTPs Successfully Sent:</span>
              <strong style={{ color: '#111827' }}>{currentOtpCount} SMS (₹{currentOtpAmount.toFixed(2)})</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed #f3f4f6', paddingBottom: '8px' }}>
              <span>Order Commissions Accrued:</span>
              <strong style={{ color: '#111827' }}>₹{currentOrderAmount.toFixed(2)}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Total Cycle Accrued Charges:</span>
              <strong style={{ color: '#111827' }}>₹{(currentOtpAmount + currentOrderAmount).toFixed(2)}</strong>
            </div>
          </div>
        </div>

      </div>

      {/* Main Billing Tables */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '32px' }}>
        
        {/* Monthly Billing Summaries (Invoices) */}
        <div style={{ backgroundColor: 'white', borderRadius: '16px', border: '1px solid #e5e7eb', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#111827', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Receipt size={18} style={{ color: '#6b7280' }} />
              Monthly Statements
            </h3>
            <span style={{ fontSize: '12px', color: '#6b7280' }}>Generated aggregates at the end of each billing cycle</span>
          </div>
          
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', minWidth: '800px', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb', color: '#4b5563', fontWeight: 600 }}>
                  <th style={{ padding: '12px 24px' }}>Billing Cycle</th>
                  <th style={{ padding: '12px 24px' }}>Sub. Fee</th>
                  <th style={{ padding: '12px 24px' }}>Order Commissions</th>
                  <th style={{ padding: '12px 24px' }}>OTP Delivery Costs</th>
                  <th style={{ padding: '12px 24px' }}>Adjustments</th>
                  <th style={{ padding: '12px 24px', textAlign: 'right' }}>Total Amount</th>
                  <th style={{ padding: '12px 24px', textAlign: 'center' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {summaries.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '32px', textAlign: 'center', color: '#9ca3af' }}>
                      No statements generated yet. Statements compile at the end of the monthly cycle.
                    </td>
                  </tr>
                ) : (
                  summaries.map((summary) => {
                    const cycleDay = restaurant.billing_start_date ? new Date(restaurant.billing_start_date).getDate() : 1;
                    const start = new Date(summary.year, summary.month - 1, cycleDay);
                    const end = new Date(start);
                    if (restaurant.billing_period === 'YEARLY') {
                      end.setFullYear(end.getFullYear() + 1);
                    } else {
                      end.setMonth(end.getMonth() + 1);
                    }
                    const startStr = start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
                    const endStr = end.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
                    const cycleName = `${startStr} to ${endStr}`;
                    return (
                      <tr key={summary.id} style={{ borderBottom: '1px solid #f3f4f6', color: '#374151' }}>
                        <td style={{ padding: '14px 24px', fontWeight: 600, color: '#111827' }}>{cycleName}</td>
                        <td style={{ padding: '14px 24px' }}>₹{parseFloat(summary.subscription_charges || '0').toFixed(2)}</td>
                        <td style={{ padding: '14px 24px' }}>₹{parseFloat(summary.order_charges || '0').toFixed(2)}</td>
                        <td style={{ padding: '14px 24px' }}>₹{parseFloat(summary.otp_charges || '0').toFixed(2)}</td>
                        <td style={{ 
                          padding: '14px 24px', 
                          color: parseFloat(summary.adjustments || '0') > 0 ? '#059669' : parseFloat(summary.adjustments || '0') < 0 ? '#dc2626' : 'inherit' 
                        }}>
                          ₹{parseFloat(summary.adjustments || '0').toFixed(2)}
                        </td>
                        <td style={{ padding: '14px 24px', textAlign: 'right', fontWeight: 700, color: '#111827' }}>
                          ₹{parseFloat(summary.total_amount || '0').toFixed(2)}
                        </td>
                        <td style={{ padding: '14px 24px', textAlign: 'center' }}>
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

        {/* Transaction History (Audit Logs) */}
        <div style={{ marginTop: '24px' }}>
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
