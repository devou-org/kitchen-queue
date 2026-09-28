'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { 
  Gift, Users, Award, TrendingUp, Search, RefreshCw, Plus, 
  Settings, History, Edit2, Trash2, CheckCircle2, 
  XCircle, Clock, AlertCircle, ShoppingBag, Filter, X, Loader2, Sparkles
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import { AdminContentWrapper } from '@/components/AdminContentWrapper';
import { AdminPageHeader } from '@/components/AdminPageHeader';
import { LayoutMaximizeToggle } from '@/components/LayoutMaximizeToggle';

type CustomerLoyalty = {
  id: string;
  user_id: string;
  name: string;
  phone: string;
  email?: string;
  points_balance: number;
  total_points_earned: number;
  total_points_redeemed: number;
  total_visits: number;
  visit_progress: number;
  rewards_unlocked: number;
  total_spent: number;
  last_visit_at?: string;
  created_at: string;
};

type LoyaltySettings = {
  is_enabled: boolean;
  points_earning_rate: number;
  points_redemption_rate_points: number;
  points_redemption_rate_amount: number;
  points_expiry_type: 'NEVER' | 'EXPIRE_AFTER_DAYS';
  points_expiry_days: number;
  min_order_amount: number;
  visit_milestone_count: number;
  visit_reward_type: string;
  visit_reward_value: string;
};

type LoyaltyReward = {
  id: string;
  name: string;
  points_required: number;
  reward_type: 'DISCOUNT_AMOUNT' | 'DISCOUNT_PERCENTAGE' | 'FREE_ITEM';
  discount_value: number;
  selected_product_ids: string[];
  min_purchase_amount: number;
  valid_until?: string;
  is_active: boolean;
};

type LoyaltyTransaction = {
  id: string;
  created_at: string;
  customer_name: string;
  phone: string;
  transaction_type: string;
  points_delta: number;
  visit_delta: number;
  ticket_number?: string;
  notes?: string;
};

type ProductOption = {
  id: string;
  name: string;
  price: number;
};

export default function AdminLoyaltyPage() {
  const { slug } = useParams();
  const slugStr = Array.isArray(slug) ? slug[0] : slug;

  const [activeTab, setActiveTab] = useState<'customers' | 'settings' | 'rewards' | 'transactions'>('customers');
  const [loading, setLoading] = useState(true);

  // Customer Directory State
  const [customers, setCustomers] = useState<CustomerLoyalty[]>([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerLoyalty | null>(null);
  const [adjustPointsDelta, setAdjustPointsDelta] = useState<number>(0);
  const [adjustReason, setAdjustReason] = useState<string>('');
  const [isAdjusting, setIsAdjusting] = useState(false);

  // Program Settings State
  const [settings, setSettings] = useState<LoyaltySettings>({
    is_enabled: true,
    points_earning_rate: 0.10,
    points_redemption_rate_points: 100,
    points_redemption_rate_amount: 50,
    points_expiry_type: 'NEVER',
    points_expiry_days: 365,
    min_order_amount: 0,
    visit_milestone_count: 5,
    visit_reward_type: 'DISCOUNT_AMOUNT',
    visit_reward_value: '100',
  });
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // Rewards Catalog State
  const [rewards, setRewards] = useState<LoyaltyReward[]>([]);
  const [productsList, setProductsList] = useState<ProductOption[]>([]);
  const [showRewardModal, setShowRewardModal] = useState(false);
  const [editingReward, setEditingReward] = useState<LoyaltyReward | null>(null);
  const [rewardForm, setRewardForm] = useState({
    name: '',
    points_required: 100,
    reward_type: 'DISCOUNT_AMOUNT' as 'DISCOUNT_AMOUNT' | 'DISCOUNT_PERCENTAGE' | 'FREE_ITEM',
    discount_value: 50,
    selected_product_ids: [] as string[],
    min_purchase_amount: 0,
    valid_until: '',
  });

  // Transactions Log State
  const [transactions, setTransactions] = useState<LoyaltyTransaction[]>([]);
  const [txTypeFilter, setTxTypeFilter] = useState<string>('ALL');

  // Fetch Data
  const fetchData = useCallback(async () => {
    if (!slugStr) return;
    setLoading(true);
    try {
      // Fetch settings
      const settingsRes = await fetch(`/api/admin/loyalty/settings?slug=${slugStr}`);
      const settingsJson = await settingsRes.json();
      if (settingsJson.success && settingsJson.data) {
        setSettings({
          is_enabled: settingsJson.data.is_enabled ?? true,
          points_earning_rate: Number(settingsJson.data.points_earning_rate || 0.10),
          points_redemption_rate_points: Number(settingsJson.data.points_redemption_rate_points || 100),
          points_redemption_rate_amount: Number(settingsJson.data.points_redemption_rate_amount || 50),
          points_expiry_type: settingsJson.data.points_expiry_type || 'NEVER',
          points_expiry_days: Number(settingsJson.data.points_expiry_days || 365),
          min_order_amount: Number(settingsJson.data.min_order_amount || 0),
          visit_milestone_count: Number(settingsJson.data.visit_milestone_count || 5),
          visit_reward_type: settingsJson.data.visit_reward_type || 'DISCOUNT_AMOUNT',
          visit_reward_value: settingsJson.data.visit_reward_value || '100',
        });
      }

      // Fetch customers
      const customersRes = await fetch(`/api/admin/loyalty/customers?slug=${slugStr}&search=${encodeURIComponent(customerSearch)}`);
      const customersJson = await customersRes.json();
      if (customersJson.success) {
        setCustomers(customersJson.data || []);
      }

      // Fetch rewards catalog
      const rewardsRes = await fetch(`/api/admin/loyalty/rewards?slug=${slugStr}`);
      const rewardsJson = await rewardsRes.json();
      if (rewardsJson.success) {
        setRewards(rewardsJson.data || []);
      }

      // Fetch products list for reward product picker
      const prodsRes = await fetch(`/api/products?slug=${slugStr}`);
      const prodsJson = await prodsRes.json();
      if (prodsJson.success || Array.isArray(prodsJson)) {
        const pArr = prodsJson.data || prodsJson || [];
        setProductsList(pArr.map((p: any) => ({ id: p.id, name: p.name, price: Number(p.price || 0) })));
      }

      // Fetch transactions audit log
      const txRes = await fetch(`/api/admin/loyalty/transactions?slug=${slugStr}`);
      const txJson = await txRes.json();
      if (txJson.success) {
        setTransactions(txJson.data || []);
      }
    } catch (err) {
      console.error('Failed to load loyalty data:', err);
      toast.error('Failed to load loyalty data');
    } finally {
      setLoading(false);
    }
  }, [slugStr, customerSearch]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle Settings Update
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    try {
      const res = await fetch(`/api/admin/loyalty/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: slugStr,
          ...settings,
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success('Loyalty settings updated successfully!');
      } else {
        toast.error(json.error || 'Failed to update settings');
      }
    } catch (err: any) {
      toast.error(err.message || 'Server error');
    } finally {
      setIsSavingSettings(false);
    }
  };

  // Handle Manual Points Adjustment
  const handleConfirmAdjustment = async () => {
    if (!selectedCustomer || adjustPointsDelta === 0) return;
    setIsAdjusting(true);
    try {
      const res = await fetch(`/api/admin/loyalty/customers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: slugStr,
          customer_loyalty_id: selectedCustomer.id,
          points_delta: adjustPointsDelta,
          reason: adjustReason || 'Manual admin point adjustment',
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(`Successfully ${adjustPointsDelta > 0 ? 'added' : 'deducted'} ${Math.abs(adjustPointsDelta)} points!`);
        setSelectedCustomer(null);
        setAdjustPointsDelta(0);
        setAdjustReason('');
        fetchData();
      } else {
        toast.error(json.error || 'Adjustment failed');
      }
    } catch (err: any) {
      toast.error(err.message || 'Server error');
    } finally {
      setIsAdjusting(false);
    }
  };

  // Handle Reward Save (Create / Edit)
  const handleSaveReward = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const method = editingReward ? 'PUT' : 'POST';
      const bodyPayload = {
        slug: slugStr,
        ...(editingReward ? { reward_id: editingReward.id } : {}),
        ...rewardForm,
      };

      const res = await fetch(`/api/admin/loyalty/rewards`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(editingReward ? 'Reward updated!' : 'New reward created!');
        setShowRewardModal(false);
        setEditingReward(null);
        setRewardForm({
          name: '',
          points_required: 100,
          reward_type: 'DISCOUNT_AMOUNT',
          discount_value: 50,
          selected_product_ids: [],
          min_purchase_amount: 0,
          valid_until: '',
        });
        fetchData();
      } else {
        toast.error(json.error || 'Failed to save reward');
      }
    } catch (err: any) {
      toast.error(err.message || 'Server error');
    }
  };

  // Handle Reward Delete
  const handleDeleteReward = async (rewardId: string) => {
    if (!confirm('Are you sure you want to delete this reward?')) return;
    try {
      const res = await fetch(`/api/admin/loyalty/rewards?slug=${slugStr}&reward_id=${rewardId}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (json.success) {
        toast.success('Reward deleted successfully!');
        fetchData();
      } else {
        toast.error(json.error || 'Failed to delete reward');
      }
    } catch (err: any) {
      toast.error(err.message || 'Server error');
    }
  };

  // Filtered transactions
  const filteredTransactions = transactions.filter((tx) => {
    if (txTypeFilter === 'ALL') return true;
    return tx.transaction_type === txTypeFilter;
  });

  // Metrics summary computations
  const totalMembers = customers.length;
  const totalActivePoints = customers.reduce((acc, c) => acc + Number(c.points_balance || 0), 0);
  const totalVisitsCount = customers.reduce((acc, c) => acc + Number(c.total_visits || 0), 0);
  const totalSpentSum = customers.reduce((acc, c) => acc + Number(c.total_spent || 0), 0);

  return (
    <AdminContentWrapper>
      <Toaster position="top-right" />
      
      <style>{`
        .loyalty-nav-bar {
          display: flex;
          align-items: stretch;
          overflow-x: auto;
          scrollbar-width: none;
          -ms-overflow-style: none;
          border-bottom: 1px solid var(--border, #e2e8f0);
          margin-bottom: 20px;
          gap: 4px;
        }
        .loyalty-nav-bar::-webkit-scrollbar {
          display: none;
        }
        .loyalty-nav-item {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 12px 20px;
          font-size: 14px;
          font-weight: 600;
          color: #64748b;
          background: transparent;
          border: none;
          border-top: 3.5px solid transparent;
          cursor: pointer;
          white-space: nowrap;
          transition: all 0.15s ease-in-out;
          border-radius: 4px 4px 0 0;
        }
        .loyalty-nav-item:hover:not(.active) {
          color: #0f172a;
          background-color: rgba(0, 0, 0, 0.03);
        }
        .loyalty-nav-item.active {
          font-weight: 700;
          color: var(--primary, #059669);
          background-color: color-mix(in srgb, var(--primary, #059669) 8%, transparent);
          border-top: 3.5px solid var(--primary, #059669);
        }
        .loyalty-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 700;
        }

        @media (max-width: 768px) {
          .loyalty-metrics-grid {
            grid-template-columns: 1fr 1fr !important;
          }
          .loyalty-table-desktop {
            display: none !important;
          }
          .loyalty-cards-mobile {
            display: flex !important;
            flex-direction: column;
            gap: 12px;
          }
        }

        @media (min-width: 769px) {
          .loyalty-cards-mobile {
            display: none !important;
          }
        }
      `}</style>

      {/* Header */}
      <AdminPageHeader 
        title="Loyalty & Rewards Program"
        subtitle="Manage CRM customer profiles, points balance, punch card visits, rewards catalog, and audit logs."
        action={
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {activeTab === 'rewards' && (
              <button
                onClick={() => {
                  setEditingReward(null);
                  setRewardForm({
                    name: '',
                    points_required: 100,
                    reward_type: 'DISCOUNT_AMOUNT',
                    discount_value: 50,
                    selected_product_ids: [],
                    min_purchase_amount: 0,
                    valid_until: '',
                  });
                  setShowRewardModal(true);
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  background: 'var(--primary, #059669)',
                  color: 'white',
                  fontSize: '13px',
                  fontWeight: 700,
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                }}
              >
                <Plus size={15} /> Add New Reward
              </button>
            )}

            <button
              onClick={() => fetchData()}
              title="Refresh Loyalty Data"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                borderRadius: '8px',
                border: '1px solid var(--border, #cbd5e1)',
                background: 'white',
                fontSize: '13px',
                fontWeight: 600,
                color: '#334155',
                cursor: 'pointer',
              }}
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            <div style={{ borderLeft: '1px solid #E2E8F0', paddingLeft: '8px', display: 'flex', alignItems: 'center', height: '32px' }}>
              <LayoutMaximizeToggle />
            </div>
          </div>
        }
      />

      {/* Metrics Row */}
      <div className="loyalty-metrics-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div style={{ background: 'white', border: '1px solid var(--border, #e2e8f0)', borderRadius: '12px', padding: '16px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 600 }}>Total CRM Members</span>
            <div style={{ background: '#ecfdf5', color: '#059669', width: '34px', height: '34px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Users size={18} />
            </div>
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a' }}>{totalMembers}</div>
          <div style={{ fontSize: '12px', color: '#10b981', marginTop: '4px', fontWeight: 600 }}>Active Member Profiles</div>
        </div>

        <div style={{ background: 'white', border: '1px solid var(--border, #e2e8f0)', borderRadius: '12px', padding: '16px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 600 }}>Active Points Balance</span>
            <div style={{ background: '#fef3c7', color: '#d97706', width: '34px', height: '34px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Gift size={18} />
            </div>
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a' }}>{totalActivePoints.toLocaleString()} pts</div>
          <div style={{ fontSize: '12px', color: '#d97706', marginTop: '4px', fontWeight: 600 }}>Available for Redemption</div>
        </div>

        <div style={{ background: 'white', border: '1px solid var(--border, #e2e8f0)', borderRadius: '12px', padding: '16px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 600 }}>Punch Card Visits</span>
            <div style={{ background: '#eff6ff', color: '#2563eb', width: '34px', height: '34px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Award size={18} />
            </div>
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a' }}>{totalVisitsCount}</div>
          <div style={{ fontSize: '12px', color: '#2563eb', marginTop: '4px', fontWeight: 600 }}>Recorded Visits</div>
        </div>

        <div style={{ background: 'white', border: '1px solid var(--border, #e2e8f0)', borderRadius: '12px', padding: '16px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 600 }}>Cumulative Spend</span>
            <div style={{ background: '#f3e8ff', color: '#9333ea', width: '34px', height: '34px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <TrendingUp size={18} />
            </div>
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a' }}>₹{totalSpentSum.toLocaleString()}</div>
          <div style={{ fontSize: '12px', color: '#9333ea', marginTop: '4px', fontWeight: 600 }}>Total Loyalty Revenue</div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="loyalty-nav-bar">
        <button
          onClick={() => setActiveTab('customers')}
          className={`loyalty-nav-item ${activeTab === 'customers' ? 'active' : ''}`}
        >
          <Users size={16} />
          Customer Directory
          <span className="loyalty-badge" style={{ background: activeTab === 'customers' ? '#dcfce7' : '#f1f5f9', color: activeTab === 'customers' ? '#15803d' : '#64748b' }}>
            {customers.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          className={`loyalty-nav-item ${activeTab === 'settings' ? 'active' : ''}`}
        >
          <Settings size={16} />
          Program Rules & Rates
        </button>

        <button
          onClick={() => setActiveTab('rewards')}
          className={`loyalty-nav-item ${activeTab === 'rewards' ? 'active' : ''}`}
        >
          <Gift size={16} />
          Rewards Catalog
          <span className="loyalty-badge" style={{ background: activeTab === 'rewards' ? '#dcfce7' : '#f1f5f9', color: activeTab === 'rewards' ? '#15803d' : '#64748b' }}>
            {rewards.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('transactions')}
          className={`loyalty-nav-item ${activeTab === 'transactions' ? 'active' : ''}`}
        >
          <History size={16} />
          Transaction Audit Log
          <span className="loyalty-badge" style={{ background: activeTab === 'transactions' ? '#dcfce7' : '#f1f5f9', color: activeTab === 'transactions' ? '#15803d' : '#64748b' }}>
            {transactions.length}
          </span>
        </button>
      </div>

      {/* TAB 1: CUSTOMERS DIRECTORY */}
      {activeTab === 'customers' && (
        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid var(--border, #e2e8f0)', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '20px' }}>
            <div style={{ position: 'relative', width: '320px', maxWidth: '100%' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                type="text"
                placeholder="Search by name or phone number..."
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px 9px 36px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13px',
                  outline: 'none',
                }}
              />
              {customerSearch && (
                <button 
                  onClick={() => setCustomerSearch('')}
                  style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <div style={{ fontSize: '13px', color: '#64748b', fontWeight: 600 }}>
              Showing <strong>{customers.length}</strong> customer profile(s)
            </div>
          </div>

          {/* Desktop Table View */}
          <div className="loyalty-table-desktop" style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  <th style={{ padding: '12px 16px', color: '#475569', fontWeight: 700 }}>Customer</th>
                  <th style={{ padding: '12px 16px', color: '#475569', fontWeight: 700 }}>Phone</th>
                  <th style={{ padding: '12px 16px', color: '#475569', fontWeight: 700 }}>Points Balance</th>
                  <th style={{ padding: '12px 16px', color: '#475569', fontWeight: 700 }}>Punch Card (Visits)</th>
                  <th style={{ padding: '12px 16px', color: '#475569', fontWeight: 700 }}>Rewards Unlocked</th>
                  <th style={{ padding: '12px 16px', color: '#475569', fontWeight: 700 }}>Total Spent</th>
                  <th style={{ padding: '12px 16px', color: '#475569', fontWeight: 700, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {customers.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: '36px', textAlign: 'center', color: '#94a3b8' }}>
                      No registered loyalty customer records found.
                    </td>
                  </tr>
                ) : (
                  customers.map((c) => (
                    <tr key={c.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#ecfdf5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '13px' }}>
                            {(c.name || 'G').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, color: '#0f172a' }}>{c.name || 'Guest Customer'}</div>
                            {c.email && <div style={{ fontSize: '11px', color: '#64748b' }}>{c.email}</div>}
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '14px 16px', color: '#475569', fontFamily: 'monospace', fontWeight: 600 }}>
                        {c.phone}
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <span style={{ background: '#fef3c7', color: '#b45309', padding: '4px 10px', borderRadius: '16px', fontWeight: 700, fontSize: '12px' }}>
                          {Number(c.points_balance || 0).toLocaleString()} pts
                        </span>
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ flex: 1, height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden', maxWidth: '100px' }}>
                            <div 
                              style={{ 
                                height: '100%', 
                                width: `${Math.min(100, ((c.visit_progress || 0) / (settings.visit_milestone_count || 5)) * 100)}%`, 
                                background: '#2563eb', 
                                borderRadius: '4px' 
                              }} 
                            />
                          </div>
                          <span style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>
                            {c.visit_progress || 0}/{settings.visit_milestone_count || 5}
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: '14px 16px', color: '#059669', fontWeight: 700 }}>
                        {c.rewards_unlocked || 0} claimed
                      </td>
                      <td style={{ padding: '14px 16px', fontWeight: 600, color: '#334155' }}>
                        ₹{Number(c.total_spent || 0).toLocaleString()}
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                        <button
                          onClick={() => {
                            setSelectedCustomer(c);
                            setAdjustPointsDelta(0);
                            setAdjustReason('');
                          }}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '6px',
                            border: '1px solid #cbd5e1',
                            background: 'white',
                            fontSize: '12px',
                            fontWeight: 600,
                            color: '#0f172a',
                            cursor: 'pointer',
                          }}
                        >
                          Adjust Points
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View Fallback */}
          <div className="loyalty-cards-mobile">
            {customers.map((c) => (
              <div key={c.id} style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px', background: 'white' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div style={{ fontWeight: 700, fontSize: '14px', color: '#0f172a' }}>{c.name || 'Guest Customer'}</div>
                  <span style={{ background: '#fef3c7', color: '#b45309', padding: '3px 8px', borderRadius: '12px', fontWeight: 700, fontSize: '11px' }}>
                    {c.points_balance} pts
                  </span>
                </div>
                <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '8px', fontFamily: 'monospace' }}>
                  Phone: {c.phone}
                </div>
                <div style={{ fontSize: '12px', color: '#334155', marginBottom: '10px', display: 'flex', justifyContent: 'space-between' }}>
                  <span>Visits: <strong>{c.visit_progress || 0}/{settings.visit_milestone_count || 5}</strong></span>
                  <span>Total Spent: <strong>₹{Number(c.total_spent || 0).toLocaleString()}</strong></span>
                </div>
                <button
                  onClick={() => {
                    setSelectedCustomer(c);
                    setAdjustPointsDelta(0);
                    setAdjustReason('');
                  }}
                  style={{
                    width: '100%',
                    padding: '8px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    background: '#f8fafc',
                    fontSize: '12px',
                    fontWeight: 700,
                    color: '#0f172a',
                    cursor: 'pointer',
                  }}
                >
                  Adjust Points
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: PROGRAM SETTINGS */}
      {activeTab === 'settings' && (
        <form noValidate onSubmit={handleSaveSettings} style={{ background: 'white', borderRadius: '12px', border: '1px solid var(--border, #e2e8f0)', padding: '24px', maxWidth: '800px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Settings size={18} color="var(--primary, #059669)" /> Program Rules & Rates Configuration
          </h3>

          {/* Enable Toggle */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', background: '#f8fafc', borderRadius: '8px', marginBottom: '20px', border: '1px solid #e2e8f0' }}>
            <div>
              <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '14px' }}>Enable Loyalty Program</div>
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>When turned off, customers cannot earn or redeem points. Balances stay preserved.</div>
            </div>
            <input
              type="checkbox"
              checked={settings.is_enabled}
              onChange={(e) => setSettings({ ...settings, is_enabled: e.target.checked })}
              style={{ width: '20px', height: '20px', accentColor: '#059669', cursor: 'pointer' }}
            />
          </div>

          {/* Earning Rules */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                Points Earning Rate (Points per ₹1 Spent)
              </label>
              <input
                type="number"
                step="any"
                min="0"
                value={settings.points_earning_rate}
                onChange={(e) => setSettings({ ...settings, points_earning_rate: parseFloat(e.target.value) || 0 })}
                style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
              />
              <span style={{ fontSize: '12px', color: '#64748b', marginTop: '4px', display: 'block' }}>
                e.g., 0.10 means ₹100 spent = 10 points earned.
              </span>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                Minimum Order Amount to Earn Points (₹)
              </label>
              <input
                type="number"
                step="any"
                min="0"
                value={settings.min_order_amount}
                onChange={(e) => setSettings({ ...settings, min_order_amount: parseFloat(e.target.value) || 0 })}
                style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
              />
            </div>
          </div>

          {/* Points Expiry Rule */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                Points Expiry Policy
              </label>
              <select
                value={settings.points_expiry_type}
                onChange={(e) => setSettings({ ...settings, points_expiry_type: e.target.value as any })}
                style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', background: 'white' }}
              >
                <option value="NEVER">Never Expire (Default)</option>
                <option value="EXPIRE_AFTER_DAYS">Expire After Set Duration</option>
              </select>
            </div>

            {settings.points_expiry_type === 'EXPIRE_AFTER_DAYS' && (
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Expiry Duration (Days)
                </label>
                <input
                  type="number"
                  step="any"
                  min="1"
                  value={settings.points_expiry_days}
                  onChange={(e) => setSettings({ ...settings, points_expiry_days: parseInt(e.target.value) || 365 })}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                />
              </div>
            )}
          </div>

          {/* Redemption Conversion Rate */}
          <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', padding: '16px', marginBottom: '20px' }}>
            <div style={{ fontWeight: 700, color: '#b45309', fontSize: '14px', marginBottom: '10px' }}>
              Standard Points-to-Rupee Conversion Rate
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#78350f', marginBottom: '4px' }}>
                  Points Required
                </label>
                <input
                  type="number"
                  step="any"
                  min="1"
                  value={settings.points_redemption_rate_points}
                  onChange={(e) => setSettings({ ...settings, points_redemption_rate_points: parseInt(e.target.value) || 100 })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #fcd34d', fontSize: '13px' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#78350f', marginBottom: '4px' }}>
                  Rupee Discount (₹)
                </label>
                <input
                  type="number"
                  step="any"
                  min="1"
                  value={settings.points_redemption_rate_amount}
                  onChange={(e) => setSettings({ ...settings, points_redemption_rate_amount: parseFloat(e.target.value) || 50 })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #fcd34d', fontSize: '13px' }}
                />
              </div>
            </div>
          </div>

          {/* Visit / Punch Card Settings */}
          <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '8px', padding: '16px', marginBottom: '24px' }}>
            <div style={{ fontWeight: 700, color: '#0369a1', fontSize: '14px', marginBottom: '10px' }}>
              Visit Punch Card Milestone Configuration
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#0c4a6e', marginBottom: '4px' }}>
                  Milestone Visit Count (e.g. Every Nth Visit)
                </label>
                <input
                  type="number"
                  step="any"
                  min="1"
                  value={settings.visit_milestone_count}
                  onChange={(e) => setSettings({ ...settings, visit_milestone_count: parseInt(e.target.value) || 5 })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #7dd3fc', fontSize: '13px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#0c4a6e', marginBottom: '4px' }}>
                  Milestone Reward Credit Value (₹)
                </label>
                <input
                  type="text"
                  value={settings.visit_reward_value}
                  onChange={(e) => setSettings({ ...settings, visit_reward_value: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #7dd3fc', fontSize: '13px' }}
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSavingSettings}
            style={{
              padding: '10px 24px',
              borderRadius: '8px',
              background: 'var(--primary, #059669)',
              color: 'white',
              fontSize: '14px',
              fontWeight: 700,
              border: 'none',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            {isSavingSettings && <Loader2 size={16} className="animate-spin" />}
            {isSavingSettings ? 'Saving Settings...' : 'Save Program Rules'}
          </button>
        </form>
      )}

      {/* TAB 3: REWARDS CATALOG */}
      {activeTab === 'rewards' && (
        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid var(--border, #e2e8f0)', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', margin: 0 }}>Rewards Catalog</h3>
              <p style={{ fontSize: '12px', color: '#64748b', marginTop: '2px', margin: 0 }}>Configure special rewards selectable by cashier during POS billing.</p>
            </div>

            <button
              onClick={() => {
                setEditingReward(null);
                setRewardForm({
                  name: '',
                  points_required: 100,
                  reward_type: 'DISCOUNT_AMOUNT',
                  discount_value: 50,
                  selected_product_ids: [],
                  min_purchase_amount: 0,
                  valid_until: '',
                });
                setShowRewardModal(true);
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '9px 16px',
                borderRadius: '8px',
                background: 'var(--primary, #059669)',
                color: 'white',
                fontSize: '13px',
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <Plus size={16} /> Add New Reward
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
            {rewards.length === 0 ? (
              <div style={{ gridColumn: '1 / -1', padding: '40px', textAlign: 'center', color: '#94a3b8', background: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1' }}>
                No custom rewards created yet. Click <strong>Add New Reward</strong> to create your first reward.
              </div>
            ) : (
              rewards.map((r) => (
                <div key={r.id} style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px', background: r.is_active ? 'white' : '#f8fafc' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <div style={{ fontWeight: 800, fontSize: '15px', color: '#0f172a' }}>{r.name}</div>
                    <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '12px', background: r.is_active ? '#dcfce7' : '#f1f5f9', color: r.is_active ? '#15803d' : '#64748b' }}>
                      {r.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>

                  <div style={{ fontSize: '13px', color: '#b45309', fontWeight: 700, marginBottom: '10px' }}>
                    {r.points_required} Points Required
                  </div>

                  <div style={{ fontSize: '12px', color: '#475569', marginBottom: '6px' }}>
                    <strong>Type:</strong> {r.reward_type === 'FREE_ITEM' ? 'Free Item' : r.reward_type === 'DISCOUNT_PERCENTAGE' ? `${r.discount_value}% Off` : `₹${r.discount_value} Discount`}
                  </div>

                  {r.min_purchase_amount > 0 && (
                    <div style={{ fontSize: '12px', color: '#475569', marginBottom: '6px' }}>
                      <strong>Min Purchase:</strong> ₹{r.min_purchase_amount}
                    </div>
                  )}

                  {r.valid_until && (
                    <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '12px' }}>
                      <strong>Valid Until:</strong> {new Date(r.valid_until).toLocaleDateString()}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '8px', marginTop: '14px', borderTop: '1px solid #f1f5f9', paddingTop: '12px' }}>
                    <button
                      onClick={() => {
                        setEditingReward(r);
                        setRewardForm({
                          name: r.name,
                          points_required: r.points_required,
                          reward_type: r.reward_type,
                          discount_value: r.discount_value,
                          selected_product_ids: r.selected_product_ids || [],
                          min_purchase_amount: r.min_purchase_amount || 0,
                          valid_until: r.valid_until ? r.valid_until.split('T')[0] : '',
                        });
                        setShowRewardModal(true);
                      }}
                      style={{
                        flex: 1,
                        padding: '6px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        background: 'white',
                        fontSize: '12px',
                        fontWeight: 600,
                        color: '#334155',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px',
                      }}
                    >
                      <Edit2 size={13} /> Edit
                    </button>
                    <button
                      onClick={() => handleDeleteReward(r.id)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '6px',
                        border: '1px solid #fecaca',
                        background: '#fef2f2',
                        fontSize: '12px',
                        fontWeight: 600,
                        color: '#dc2626',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <Trash2 size={13} /> Delete
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 4: TRANSACTIONS AUDIT LOG */}
      {activeTab === 'transactions' && (
        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid var(--border, #e2e8f0)', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', margin: 0 }}>Transaction Audit Log</h3>

            {/* Filter Pills */}
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {['ALL', 'EARN_POINTS', 'REDEEM_POINTS', 'MANUAL_ADJUSTMENT', 'REVERSAL_REFUND'].map((type) => (
                <button
                  key={type}
                  onClick={() => setTxTypeFilter(type)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '16px',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    border: '1px solid',
                    borderColor: txTypeFilter === type ? 'var(--primary, #059669)' : '#cbd5e1',
                    background: txTypeFilter === type ? 'var(--primary, #059669)' : 'white',
                    color: txTypeFilter === type ? 'white' : '#475569',
                  }}
                >
                  {type === 'ALL' ? 'All Transactions' : type}
                </button>
              ))}
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  <th style={{ padding: '12px 16px', color: '#475569', fontWeight: 700 }}>Timestamp</th>
                  <th style={{ padding: '12px 16px', color: '#475569', fontWeight: 700 }}>Customer</th>
                  <th style={{ padding: '12px 16px', color: '#475569', fontWeight: 700 }}>Type</th>
                  <th style={{ padding: '12px 16px', color: '#475569', fontWeight: 700 }}>Ticket #</th>
                  <th style={{ padding: '12px 16px', color: '#475569', fontWeight: 700 }}>Points Change</th>
                  <th style={{ padding: '12px 16px', color: '#475569', fontWeight: 700 }}>Notes</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '36px', textAlign: 'center', color: '#94a3b8' }}>
                      No transaction history recorded for this filter.
                    </td>
                  </tr>
                ) : (
                  filteredTransactions.map((tx) => (
                    <tr key={tx.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '12px 16px', color: '#64748b', fontSize: '12px' }}>
                        {new Date(tx.created_at).toLocaleString()}
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 600, color: '#0f172a' }}>
                        {tx.customer_name} ({tx.phone})
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span 
                          style={{
                            padding: '3px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 700,
                            background: tx.transaction_type === 'EARN_POINTS' ? '#dcfce7' : tx.transaction_type === 'REDEEM_POINTS' ? '#fef3c7' : tx.transaction_type === 'REVERSAL_REFUND' ? '#fef2f2' : '#f1f5f9',
                            color: tx.transaction_type === 'EARN_POINTS' ? '#15803d' : tx.transaction_type === 'REDEEM_POINTS' ? '#b45309' : tx.transaction_type === 'REVERSAL_REFUND' ? '#dc2626' : '#475569',
                          }}
                        >
                          {tx.transaction_type}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', fontFamily: 'monospace', color: '#334155' }}>
                        {tx.ticket_number ? `#${tx.ticket_number}` : '-'}
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 700, color: tx.points_delta > 0 ? '#16a34a' : tx.points_delta < 0 ? '#dc2626' : '#64748b' }}>
                        {tx.points_delta > 0 ? `+${tx.points_delta}` : tx.points_delta} pts
                      </td>
                      <td style={{ padding: '12px 16px', color: '#64748b', fontSize: '12px' }}>
                        {tx.notes || '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: MANUAL POINTS ADJUSTMENT */}
      {selectedCustomer && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div className="animate-fade-in" style={{ background: 'white', borderRadius: '14px', padding: '24px', maxWidth: '420px', width: '100%', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                Adjust Points Balance
              </h3>
              <button onClick={() => setSelectedCustomer(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                <X size={18} />
              </button>
            </div>
            
            <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '16px' }}>
              Customer: <strong>{selectedCustomer.name}</strong> ({selectedCustomer.phone})
            </p>

            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '12px', borderRadius: '8px', marginBottom: '16px', fontSize: '13px' }}>
              Current Points Balance: <strong>{selectedCustomer.points_balance} pts</strong>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                Points Adjustment (+ to add, - to deduct)
              </label>
              <input
                type="number"
                step="any"
                value={adjustPointsDelta}
                onChange={(e) => setAdjustPointsDelta(parseInt(e.target.value) || 0)}
                style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', fontWeight: 700 }}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                Reason / Audit Note
              </label>
              <textarea
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                placeholder="e.g. Goodwill credit, System compensation"
                rows={2}
                style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => setSelectedCustomer(null)}
                style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', background: 'white', color: '#334155', fontWeight: 700, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmAdjustment}
                disabled={isAdjusting || adjustPointsDelta === 0}
                style={{ flex: 1, padding: '10px', borderRadius: '8px', border: 'none', background: 'var(--primary, #059669)', color: 'white', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
              >
                {isAdjusting && <Loader2 size={16} className="animate-spin" />}
                {isAdjusting ? 'Processing...' : 'Confirm Adjustment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ADD / EDIT REWARD */}
      {showRewardModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <form noValidate onSubmit={handleSaveReward} className="animate-fade-in" style={{ background: 'white', borderRadius: '14px', padding: '24px', maxWidth: '500px', width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                {editingReward ? 'Edit Reward' : 'Add New Reward'}
              </h3>
              <button type="button" onClick={() => setShowRewardModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                Reward Name *
              </label>
              <input
                type="text"
                required
                value={rewardForm.name}
                onChange={(e) => setRewardForm({ ...rewardForm, name: e.target.value })}
                placeholder="e.g. Free Starter / ₹50 Off Voucher"
                style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                  Points Required *
                </label>
                <input
                  type="number"
                  step="any"
                  min="1"
                  required
                  value={rewardForm.points_required}
                  onChange={(e) => setRewardForm({ ...rewardForm, points_required: parseInt(e.target.value) || 100 })}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                  Reward Type *
                </label>
                <select
                  value={rewardForm.reward_type}
                  onChange={(e) => setRewardForm({ ...rewardForm, reward_type: e.target.value as any })}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', background: 'white' }}
                >
                  <option value="DISCOUNT_AMOUNT">Discount Amount (₹)</option>
                  <option value="DISCOUNT_PERCENTAGE">Discount Percentage (%)</option>
                  <option value="FREE_ITEM">Free Item</option>
                </select>
              </div>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                Discount Value {rewardForm.reward_type === 'DISCOUNT_PERCENTAGE' ? '(%)' : '(₹)'}
              </label>
              <input
                type="number"
                step="any"
                min="0"
                value={rewardForm.discount_value}
                onChange={(e) => setRewardForm({ ...rewardForm, discount_value: parseFloat(e.target.value) || 0 })}
                style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                  Min Purchase Amount (₹)
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={rewardForm.min_purchase_amount}
                  onChange={(e) => setRewardForm({ ...rewardForm, min_purchase_amount: parseFloat(e.target.value) || 0 })}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                  Valid Until Date (Optional)
                </label>
                <input
                  type="date"
                  value={rewardForm.valid_until}
                  onChange={(e) => setRewardForm({ ...rewardForm, valid_until: e.target.value })}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                />
              </div>
            </div>

            {/* Product Picker */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                Applicable / Free Products (Product Picker)
              </label>
              <select
                multiple
                value={rewardForm.selected_product_ids}
                onChange={(e) => {
                  const opts = Array.from(e.target.selectedOptions, (opt) => opt.value);
                  setRewardForm({ ...rewardForm, selected_product_ids: opts });
                }}
                style={{ width: '100%', height: '120px', padding: '8px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', background: 'white' }}
              >
                {productsList.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} (₹{p.price})
                  </option>
                ))}
              </select>
              <span style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', display: 'block' }}>
                Hold Ctrl (or Cmd) to select multiple products. Leave empty for all products.
              </span>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setShowRewardModal(false)}
                style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', background: 'white', color: '#334155', fontWeight: 700, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                style={{ flex: 1, padding: '10px', borderRadius: '8px', border: 'none', background: 'var(--primary, #059669)', color: 'white', fontWeight: 700, cursor: 'pointer' }}
              >
                {editingReward ? 'Update Reward' : 'Save Reward'}
              </button>
            </div>
          </form>
        </div>
      )}
    </AdminContentWrapper>
  );
}
