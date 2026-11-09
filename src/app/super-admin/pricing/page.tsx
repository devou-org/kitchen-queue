'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast, { Toaster } from 'react-hot-toast';
import { 
  ArrowLeft, 
  CreditCard, 
  Save, 
  Sparkles, 
  CheckCircle, 
  Layers, 
  Percent, 
  Clock, 
  ShieldCheck, 
  Store, 
  Info,
  Calendar,
  RotateCcw
} from 'lucide-react';

interface SaaSPlanFeature {
  feature_code: string;
  feature_name: string;
  feature_description?: string;
  is_included: boolean;
}

interface SaaSPlanItem {
  id: string;
  product_id: string;
  product_name: string;
  tier: string;
  name: string;
  description: string;
  monthly_ai_credits: number;
  is_default_trial_tier: boolean;
  is_active: boolean;
  monthly_price: number;
  annual_price: number;
  currency: string;
  features: SaaSPlanFeature[];
}

export default function SuperAdminPricingPage() {
  const router = useRouter();
  const [plans, setPlans] = useState<SaaSPlanItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingAll, setSavingAll] = useState(false);
  const [savingPlanId, setSavingPlanId] = useState<string | null>(null);

  const authHeaders = { credentials: 'include' as const };

  const fetchPricing = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/super-admin/pricing', authHeaders);
      if (res.status === 401) {
        router.push('/super-admin/login');
        return;
      }
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setPlans(data.data);
      } else {
        toast.error(data.error || 'Failed to load pricing data');
      }
    } catch {
      toast.error('Network error loading plan pricing');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchPricing();
  }, [fetchPricing]);

  const updatePlanField = (id: string, field: keyof SaaSPlanItem, value: any) => {
    setPlans(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  const handleSaveSinglePlan = async (plan: SaaSPlanItem) => {
    setSavingPlanId(plan.id);
    try {
      const res = await fetch('/api/super-admin/pricing', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        ...authHeaders,
        body: JSON.stringify({
          id: plan.id,
          name: plan.name,
          description: plan.description,
          monthly_price: Number(plan.monthly_price),
          annual_price: Number(plan.annual_price),
          monthly_ai_credits: Number(plan.monthly_ai_credits),
          is_active: plan.is_active,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Pricing for "${plan.name}" saved!`);
      } else {
        toast.error(data.error || 'Failed to save pricing');
      }
    } catch {
      toast.error('Network error saving plan');
    } finally {
      setSavingPlanId(null);
    }
  };

  const handleSaveAll = async () => {
    setSavingAll(true);
    try {
      const res = await fetch('/api/super-admin/pricing', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        ...authHeaders,
        body: JSON.stringify({
          plans: plans.map(p => ({
            id: p.id,
            name: p.name,
            description: p.description,
            monthly_price: Number(p.monthly_price),
            annual_price: Number(p.annual_price),
            monthly_ai_credits: Number(p.monthly_ai_credits),
            is_active: p.is_active,
          }))
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('All 5 plans pricing updated successfully!');
      } else {
        toast.error(data.error || 'Failed to save all pricing');
      }
    } catch {
      toast.error('Network error saving all pricing');
    } finally {
      setSavingAll(false);
    }
  };

  const getTierBadgeStyle = (tier: string) => {
    switch (tier) {
      case 'PREMIUM':
        return { bg: '#fdf4ff', color: '#9333ea', border: '#f0abfc' };
      case 'ESSENTIAL':
        return { bg: '#ecfdf5', color: '#059669', border: '#a7f3d0' };
      case 'STANDALONE':
      default:
        return { bg: '#eff6ff', color: '#2563eb', border: '#bfdbfe' };
    }
  };

  const getProductColor = (productId: string) => {
    switch (productId) {
      case 'POS':
        return { bg: '#f0fdf4', text: '#15803d' };
      case 'DIGITAL_MENU':
        return { bg: '#fffbeb', text: '#b45309' };
      case 'QUEUE_MANAGEMENT':
        return { bg: '#f5f3ff', text: '#6d28d9' };
      default:
        return { bg: '#f8fafc', text: '#475569' };
    }
  };

  return (
    <div style={styles.page}>
      <Toaster position="top-right" />

      {/* Top Banner Navigation */}
      <div style={styles.topNav}>
        <Link href="/super-admin" style={styles.backBtn}>
          <ArrowLeft size={16} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'text-bottom' }} />
          Back to Super Admin Dashboard
        </Link>
        <span style={{ color: '#cbd5e1', margin: '0 12px' }}>|</span>
        <span style={{ color: '#475569', fontSize: '13px', fontWeight: 600 }}>
          Global Subscription & Plan Pricing Engine
        </span>
      </div>

      <div style={styles.container}>

        {/* Header */}
        <div style={styles.header}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <span style={styles.badge}>SaaS Subscription Plans</span>
              <span style={styles.pillBadge}>All 5 Active Plans</span>
            </div>
            <h1 style={styles.title}>
              <CreditCard size={28} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '10px', color: '#059669' }} />
              Plans & Pricing Management
            </h1>
            <p style={styles.subtitle}>
              Adjust monthly and annual rates for all 5 platform plans. Changes apply immediately to new onboarding checkouts and renewals.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button
              onClick={fetchPricing}
              style={styles.refreshBtn}
              title="Refresh pricing from database"
            >
              <RotateCcw size={15} style={{ marginRight: '6px' }} />
              Reload
            </button>
            <button
              onClick={handleSaveAll}
              disabled={savingAll || loading}
              style={{ ...styles.saveAllBtn, opacity: savingAll ? 0.7 : 1 }}
            >
              <Save size={16} style={{ marginRight: '8px' }} />
              {savingAll ? 'Saving All...' : 'Save All 5 Plans'}
            </button>
          </div>
        </div>

        {/* Overview Stats Bar */}
        <div style={styles.statsRow}>
          <div style={styles.statCard}>
            <div style={{ ...styles.statIconBox, backgroundColor: '#ecfdf5', color: '#059669' }}>
              <Layers size={22} />
            </div>
            <div>
              <div style={styles.statVal}>{plans.length} Plans</div>
              <div style={styles.statLabel}>Configured SaaS Tiers</div>
            </div>
          </div>

          <div style={styles.statCard}>
            <div style={{ ...styles.statIconBox, backgroundColor: '#f0fdf4', color: '#16a34a' }}>
              <Store size={22} />
            </div>
            <div>
              <div style={styles.statVal}>POS Products</div>
              <div style={styles.statLabel}>Essential (₹{plans.find(p => p.id === 'POS_ESSENTIAL')?.monthly_price || 699}/mo) & Premium (₹{plans.find(p => p.id === 'POS_PREMIUM')?.monthly_price || 999}/mo)</div>
            </div>
          </div>

          <div style={styles.statCard}>
            <div style={{ ...styles.statIconBox, backgroundColor: '#eff6ff', color: '#2563eb' }}>
              <Percent size={22} />
            </div>
            <div>
              <div style={styles.statVal}>Standalone Products</div>
              <div style={styles.statLabel}>Digital Menu, Q Management & Combo</div>
            </div>
          </div>

          <div style={styles.statCard}>
            <div style={{ ...styles.statIconBox, backgroundColor: '#faf5ff', color: '#9333ea' }}>
              <Sparkles size={22} />
            </div>
            <div>
              <div style={styles.statVal}>AI Analyst Bundles</div>
              <div style={styles.statLabel}>Included with Essential & Premium</div>
            </div>
          </div>
        </div>

        {/* Main Plans List */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '80px 20px', backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <Clock size={36} className="animate-spin" style={{ color: '#059669', margin: '0 auto 12px auto' }} />
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#1e293b' }}>Loading Plan Pricing...</h3>
            <p style={{ color: '#64748b', fontSize: '13px' }}>Fetching configuration from PostgreSQL...</p>
          </div>
        ) : plans.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <Info size={36} style={{ color: '#f59e0b', margin: '0 auto 12px auto' }} />
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#1e293b' }}>No Plans Found</h3>
            <p style={{ color: '#64748b', fontSize: '13px', marginBottom: '16px' }}>Run migration or click reload to populate standard plans.</p>
            <button onClick={fetchPricing} style={styles.saveAllBtn}>Reload Plans</button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {plans.map((plan, index) => {
              const tierBadge = getTierBadgeStyle(plan.tier);
              const prodBadge = getProductColor(plan.product_id);

              const monthly = Number(plan.monthly_price) || 0;
              const annual = Number(plan.annual_price) || 0;
              const effectiveMonthlyFromAnnual = annual > 0 ? (annual / 12) : 0;
              const annualSavingsPercent = (monthly * 12 > 0 && annual > 0)
                ? Math.round(((monthly * 12 - annual) / (monthly * 12)) * 100)
                : 0;

              const isSaving = savingPlanId === plan.id;

              return (
                <div key={plan.id} style={styles.planCard}>
                  {/* Card Header */}
                  <div style={styles.planCardHeader}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '14px', fontWeight: 800, color: '#94a3b8', width: '24px' }}>
                        #{index + 1}
                      </span>
                      <h2 style={styles.planName}>{plan.name}</h2>
                      <span style={{
                        ...styles.tag,
                        backgroundColor: tierBadge.bg,
                        color: tierBadge.color,
                        borderColor: tierBadge.border
                      }}>
                        {plan.tier} TIER
                      </span>
                      <span style={{
                        ...styles.tag,
                        backgroundColor: prodBadge.bg,
                        color: prodBadge.text,
                        borderColor: 'transparent'
                      }}>
                        PRODUCT: {plan.product_name || plan.product_id}
                      </span>
                      {plan.is_default_trial_tier && (
                        <span style={styles.trialBadge}>
                          ⭐ Default 14-Day Free Trial Tier
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, color: '#475569', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={plan.is_active}
                          onChange={e => updatePlanField(plan.id, 'is_active', e.target.checked)}
                          style={{ width: '16px', height: '16px', accentColor: '#059669' }}
                        />
                        {plan.is_active ? 'Active' : 'Disabled'}
                      </label>

                      <button
                        onClick={() => handleSaveSinglePlan(plan)}
                        disabled={isSaving}
                        style={{ ...styles.singleSaveBtn, opacity: isSaving ? 0.6 : 1 }}
                      >
                        <Save size={14} style={{ marginRight: '6px' }} />
                        {isSaving ? 'Saving...' : 'Save Plan'}
                      </button>
                    </div>
                  </div>

                  {/* Description Input */}
                  <div style={{ marginBottom: '18px' }}>
                    <label style={styles.inputLabel}>Plan Description & Scope</label>
                    <input
                      type="text"
                      value={plan.description || ''}
                      onChange={e => updatePlanField(plan.id, 'description', e.target.value)}
                      style={styles.textInput}
                      placeholder="Brief customer-facing summary of this plan"
                    />
                  </div>

                  {/* Pricing Inputs Grid */}
                  <div style={styles.pricingInputsRow}>
                    {/* Monthly Price */}
                    <div style={styles.inputCol}>
                      <label style={styles.inputLabel}>
                        <Calendar size={13} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'text-bottom' }} />
                        Monthly Billing Price (₹ / month)
                      </label>
                      <div style={styles.currencyWrapper}>
                        <span style={styles.currencyPrefix}>₹</span>
                        <input
                          type="number"
                          step="1"
                          min="0"
                          value={plan.monthly_price}
                          onChange={e => updatePlanField(plan.id, 'monthly_price', e.target.value)}
                          style={styles.priceInput}
                          placeholder="e.g. 699"
                        />
                      </div>
                      <span style={styles.fieldHint}>Billed every 30 days. Standard recurring rate.</span>
                    </div>

                    {/* Annual Price */}
                    <div style={styles.inputCol}>
                      <label style={styles.inputLabel}>
                        <Percent size={13} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'text-bottom' }} />
                        Annual Billing Price (₹ / year)
                      </label>
                      <div style={styles.currencyWrapper}>
                        <span style={styles.currencyPrefix}>₹</span>
                        <input
                          type="number"
                          step="1"
                          min="0"
                          value={plan.annual_price}
                          onChange={e => updatePlanField(plan.id, 'annual_price', e.target.value)}
                          style={styles.priceInput}
                          placeholder="e.g. 6999"
                        />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                        <span style={{ fontSize: '11px', color: '#059669', fontWeight: 700 }}>
                          = ₹{effectiveMonthlyFromAnnual.toFixed(0)}/mo
                        </span>
                        {annualSavingsPercent > 0 && (
                          <span style={styles.discountBadge}>
                            Save {annualSavingsPercent}% vs monthly
                          </span>
                        )}
                      </div>
                    </div>

                    {/* AI Credits */}
                    <div style={styles.inputCol}>
                      <label style={styles.inputLabel}>
                        <Sparkles size={13} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'text-bottom', color: '#9333ea' }} />
                        Monthly AI Credits Quota
                      </label>
                      <input
                        type="number"
                        step="1"
                        min="0"
                        value={plan.monthly_ai_credits}
                        onChange={e => updatePlanField(plan.id, 'monthly_ai_credits', e.target.value)}
                        style={styles.priceInput}
                        placeholder="e.g. 10 or 30"
                      />
                      <span style={styles.fieldHint}>Automated monthly AI Analyst question credits.</span>
                    </div>
                  </div>

                  {/* Feature Pills */}
                  {plan.features && plan.features.length > 0 && (
                    <div style={styles.featuresSection}>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                        Bundled Plan Features ({plan.features.length})
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {plan.features.map(f => (
                          <div key={f.feature_code} style={styles.featurePill}>
                            <CheckCircle size={13} style={{ color: '#059669', flexShrink: 0 }} />
                            <span>{f.feature_name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    backgroundColor: '#f8fafc',
    color: '#0f172a',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    paddingBottom: '80px',
  },
  topNav: {
    backgroundColor: '#ffffff',
    borderBottom: '1px solid #e2e8f0',
    padding: '12px 32px',
    display: 'flex',
    alignItems: 'center',
    fontSize: '13px',
  },
  backBtn: {
    color: '#059669',
    fontWeight: 600,
    textDecoration: 'none',
    display: 'inline-flex',
    alignItems: 'center',
  },
  container: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '32px 24px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '28px',
    flexWrap: 'wrap',
    gap: '16px',
  },
  badge: {
    display: 'inline-block',
    fontSize: '11px',
    fontWeight: 700,
    color: '#059669',
    backgroundColor: '#ecfdf5',
    padding: '3px 10px',
    borderRadius: '6px',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  pillBadge: {
    display: 'inline-block',
    fontSize: '11px',
    fontWeight: 700,
    color: '#475569',
    backgroundColor: '#f1f5f9',
    padding: '3px 10px',
    borderRadius: '6px',
    textTransform: 'uppercase',
  },
  title: {
    fontSize: '28px',
    fontWeight: 800,
    color: '#0f172a',
    margin: '6px 0 6px 0',
    letterSpacing: '-0.02em',
  },
  subtitle: {
    fontSize: '14px',
    color: '#64748b',
    margin: 0,
    maxWidth: '720px',
  },
  saveAllBtn: {
    backgroundColor: '#059669',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    padding: '10px 20px',
    fontSize: '14px',
    fontWeight: 700,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    boxShadow: '0 4px 12px rgba(5, 150, 105, 0.25)',
    transition: 'all 0.15s ease',
  },
  refreshBtn: {
    backgroundColor: '#ffffff',
    color: '#475569',
    border: '1px solid #cbd5e1',
    borderRadius: '8px',
    padding: '10px 16px',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
  },
  statsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: '16px',
    marginBottom: '28px',
  },
  statCard: {
    backgroundColor: '#ffffff',
    borderRadius: '10px',
    border: '1px solid #e2e8f0',
    padding: '18px 20px',
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.02)',
  },
  statIconBox: {
    width: '46px',
    height: '46px',
    borderRadius: '10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  statVal: {
    fontSize: '16px',
    fontWeight: 800,
    color: '#0f172a',
  },
  statLabel: {
    fontSize: '12px',
    color: '#64748b',
    marginTop: '2px',
  },
  planCard: {
    backgroundColor: '#ffffff',
    borderRadius: '12px',
    border: '1px solid #e2e8f0',
    padding: '24px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
    transition: 'box-shadow 0.2s ease',
  },
  planCardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
    flexWrap: 'wrap',
    gap: '12px',
    paddingBottom: '14px',
    borderBottom: '1px solid #f1f5f9',
  },
  planName: {
    fontSize: '18px',
    fontWeight: 800,
    color: '#0f172a',
    margin: 0,
  },
  tag: {
    fontSize: '11px',
    fontWeight: 700,
    padding: '3px 9px',
    borderRadius: '6px',
    borderWidth: '1px',
    borderStyle: 'solid',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  trialBadge: {
    fontSize: '11px',
    fontWeight: 700,
    color: '#b45309',
    backgroundColor: '#fef3c7',
    padding: '3px 9px',
    borderRadius: '6px',
  },
  singleSaveBtn: {
    backgroundColor: '#f8fafc',
    color: '#059669',
    border: '1px solid #cbd5e1',
    borderRadius: '6px',
    padding: '6px 14px',
    fontSize: '12px',
    fontWeight: 700,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
  },
  inputLabel: {
    display: 'block',
    fontSize: '12px',
    fontWeight: 700,
    color: '#334155',
    marginBottom: '6px',
  },
  textInput: {
    width: '100%',
    padding: '9px 12px',
    borderRadius: '6px',
    border: '1px solid #cbd5e1',
    fontSize: '13px',
    color: '#0f172a',
    outline: 'none',
    boxSizing: 'border-box',
    backgroundColor: '#f8fafc',
  },
  pricingInputsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '18px',
    backgroundColor: '#f8fafc',
    borderRadius: '8px',
    padding: '16px',
    border: '1px solid #f1f5f9',
    marginBottom: '16px',
  },
  inputCol: {
    display: 'flex',
    flexDirection: 'column',
  },
  currencyWrapper: {
    display: 'flex',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: '6px',
    border: '1px solid #cbd5e1',
    overflow: 'hidden',
  },
  currencyPrefix: {
    padding: '8px 12px',
    backgroundColor: '#f1f5f9',
    fontSize: '14px',
    fontWeight: 700,
    color: '#475569',
    borderRight: '1px solid #cbd5e1',
  },
  priceInput: {
    flex: 1,
    padding: '8px 12px',
    border: 'none',
    outline: 'none',
    fontSize: '15px',
    fontWeight: 700,
    color: '#0f172a',
    backgroundColor: 'transparent',
    boxSizing: 'border-box',
  },
  fieldHint: {
    fontSize: '11px',
    color: '#64748b',
    marginTop: '4px',
  },
  discountBadge: {
    fontSize: '10px',
    fontWeight: 700,
    color: '#059669',
    backgroundColor: '#d1fae5',
    padding: '2px 6px',
    borderRadius: '4px',
  },
  featuresSection: {
    paddingTop: '12px',
    borderTop: '1px dashed #e2e8f0',
  },
  featurePill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    backgroundColor: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: '6px',
    padding: '4px 10px',
    fontSize: '12px',
    color: '#334155',
    fontWeight: 500,
  },
};
