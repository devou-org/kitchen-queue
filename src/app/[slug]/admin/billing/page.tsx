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

interface BillingData {
  restaurant: {
    id: string;
    name: string;
    slug: string;
    billing_tier: string;
    billing_model: string;
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
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto', fontFamily: 'inherit' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 800, color: '#111827', letterSpacing: '-0.02em', marginBottom: '4px' }}>Billing & Invoices</h1>
          <p style={{ color: '#4b5563', fontSize: '14px' }}>Manage subscription tiers, view commission rates, and review past statement logs.</p>
        </div>
        
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
      </div>

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
          </div>
        </div>

        {/* Pricing Policies Card */}
        <div style={{ 
          backgroundColor: 'white', 
          borderRadius: '16px', 
          border: '1px solid #e5e7eb', 
          padding: '24px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
        }}>
          <h2 style={{ fontSize: '13px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '16px' }}>Policy & Rates</h2>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px', color: '#4b5563' }}>
            <div>
              <span style={{ display: 'block', fontWeight: 600, color: '#111827', marginBottom: '2px' }}>Per Order Commission:</span>
              {pricingConfig?.perOrderCommission ? (
                <span>
                  Average Order Value &lt; ₹{pricingConfig.perOrderCommission.threshold}: <strong>{pricingConfig.perOrderCommission.belowPercent}% of order value</strong><br />
                  Average Order Value &ge; ₹{pricingConfig.perOrderCommission.threshold}: <strong>Flat ₹{pricingConfig.perOrderCommission.aboveFlat} per order</strong>
                </span>
              ) : (
                <span style={{ color: '#9ca3af' }}>Not Applicable for this tier</span>
              )}
            </div>

            <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: '10px' }}>
              <span style={{ display: 'block', fontWeight: 600, color: '#111827', marginBottom: '2px' }}>OTP Delivery Costs:</span>
              {pricingConfig?.otpCharge !== undefined && pricingConfig?.otpCharge !== null ? (
                <span><strong>₹{Number(pricingConfig.otpCharge).toFixed(2)}</strong> flat fee per successfully sent SMS OTP.</span>
              ) : (
                <span style={{ color: '#9ca3af' }}>OTP verification disabled on this tier</span>
              )}
            </div>
          </div>
        </div>

        {/* Features Checklist Card */}
        <div style={{ 
          backgroundColor: 'white', 
          borderRadius: '16px', 
          border: '1px solid #e5e7eb', 
          padding: '24px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
        }}>
          <h2 style={{ fontSize: '13px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '16px' }}>Features Included</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {pricingConfig?.features.map((feature, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#374151' }}>
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '18px', height: '18px', borderRadius: '50%', backgroundColor: '#ecfdf5', color: '#059669', fontSize: '10px', fontWeight: 'bold' }}>✓</span>
                <span>{feature}</span>
              </div>
            )) || (
              <div style={{ color: '#9ca3af', fontSize: '13px' }}>No features configured</div>
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
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '32px' }}>
        
        {/* Monthly Billing Summaries (Invoices) */}
        <div style={{ backgroundColor: 'white', borderRadius: '16px', border: '1px solid #e5e7eb', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#111827', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Receipt size={18} style={{ color: '#6b7280' }} />
              Monthly Statements
            </h3>
            <span style={{ fontSize: '12px', color: '#6b7280' }}>Generated aggregates at the end of each billing cycle</span>
          </div>
          
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb', color: '#4b5563', fontWeight: 600 }}>
                  <th style={{ padding: '12px 24px' }}>Billing Cycle</th>
                  <th style={{ padding: '12px 24px' }}>Sub. Fee</th>
                  <th style={{ padding: '12px 24px' }}>Order Commissions</th>
                  <th style={{ padding: '12px 24px' }}>OTP Delivery Costs</th>
                  <th style={{ padding: '12px 24px' }}>Adjustments</th>
                  <th style={{ padding: '12px 24px', textAlign: 'right' }}>Total Amount</th>
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
                    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                    const cycleName = `${months[summary.month - 1]} ${summary.year}`;
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
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Transaction History (Audit Logs) */}
        <div style={{ backgroundColor: 'white', borderRadius: '16px', border: '1px solid #e5e7eb', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid #f3f4f6' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#111827', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Info size={18} style={{ color: '#6b7280' }} />
              Detailed Transaction Logs
            </h3>
          </div>
          
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb', color: '#4b5563', fontWeight: 600 }}>
                  <th style={{ padding: '12px 24px' }}>Date</th>
                  <th style={{ padding: '12px 24px' }}>Type</th>
                  <th style={{ padding: '12px 24px' }}>Reference Code</th>
                  <th style={{ padding: '12px 24px' }}>Description</th>
                  <th style={{ padding: '12px 24px', textAlign: 'right' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: '32px', textAlign: 'center', color: '#9ca3af' }}>
                      No transaction entries found.
                    </td>
                  </tr>
                ) : (
                  transactions.map((tx) => (
                    <tr key={tx.id} style={{ borderBottom: '1px solid #f3f4f6', color: '#374151' }}>
                      <td style={{ padding: '14px 24px', whiteSpace: 'nowrap' }}>{formatDate(tx.created_at)}</td>
                      <td style={{ padding: '14px 24px' }}>
                        <span style={{ 
                          display: 'inline-block', 
                          padding: '2px 8px', 
                          borderRadius: '4px', 
                          fontSize: '11px', 
                          fontWeight: 700,
                          backgroundColor: tx.transaction_type === 'PAYMENT' ? '#ecfdf5' : '#f3f4f6',
                          color: tx.transaction_type === 'PAYMENT' ? '#059669' : '#374151'
                        }}>
                          {tx.transaction_type}
                        </span>
                      </td>
                      <td style={{ padding: '14px 24px', fontFamily: 'monospace', color: '#6b7280' }}>{tx.reference_id || 'N/A'}</td>
                      <td style={{ padding: '14px 24px' }}>{tx.description}</td>
                      <td style={{ padding: '14px 24px', textAlign: 'right', fontWeight: 600 }}>
                        ₹{parseFloat(tx.amount || '0').toFixed(2)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
