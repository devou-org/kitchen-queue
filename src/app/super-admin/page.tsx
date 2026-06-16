'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import toast, { Toaster } from 'react-hot-toast';
import { ClipboardList, ShoppingCart, Ticket, Hourglass, Store, Phone, MapPin, Palette, X, Check, MessageSquare } from 'lucide-react';
import 'react-phone-number-input/style.css';
import PhoneInput from 'react-phone-number-input';

const ALL_MODULES = [
  { key: 'DIGITAL_MENU', label: 'Digital Menu', icon: <ClipboardList size={16} />, desc: 'QR code menu, categories, pricing' },
  { key: 'ONLINE_ORDERING', label: 'Online Ordering', icon: <ShoppingCart size={16} />, desc: 'Cart, checkout, OTP verification' },
  { key: 'QUEUE_MANAGEMENT', label: 'Queue Management', icon: <Ticket size={16} />, desc: 'Token generation, live queue display' },
];

type Restaurant = {
  id: string;
  name: string;
  slug: string;
  phone?: string;
  address?: string;
  logo_url?: string;
  primary_color?: string;
  secondary_color?: string;
  created_at: string;
  orders_30d?: number;
  active_products?: number;
  modules?: { module_name: string; is_enabled: boolean }[];
};

type ModalMode = 'create' | 'edit' | null;

const EMPTY_FORM = { name: '', slug: '', phone: '', address_street: '', address_city: '', address_state: '', address_zip: '', address_country: '', logo_url: '', primary_color: '#800020', secondary_color: '#ecfdf5', modules: ALL_MODULES.map(m => m.key) };

export default function SuperAdminDashboard() {
  const router = useRouter();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [walletLoading, setWalletLoading] = useState(false);

  const authHeaders = { credentials: 'include' as const };

  const fetchWalletBalance = useCallback(async () => {
    setWalletLoading(true);
    try {
      const res = await fetch('/api/super-admin/wallet-balance', authHeaders);
      const data = await res.json();
      if (data.success) {
        setWalletBalance(data.wallet);
      }
    } catch {
      console.error('Failed to load wallet balance');
    } finally {
      setWalletLoading(false);
    }
  }, []);

  const fetchRestaurants = useCallback(async () => {
    try {
      const res = await fetch('/api/super-admin/restaurants', authHeaders);
      if (res.status === 401) { router.push('/super-admin/login'); return; }
      const data = await res.json();
      if (data.success) setRestaurants(data.data);
    } catch { toast.error('Failed to load restaurants'); }
    finally { setLoading(false); }
  }, [router]);

  useEffect(() => {
    fetchRestaurants();
    fetchWalletBalance();
  }, [fetchRestaurants, fetchWalletBalance]);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setModalMode('create');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        slug: form.slug,
        phone: form.phone || '',
        address: [form.address_street, form.address_city, form.address_state, form.address_zip, form.address_country].filter(Boolean).join(', '),
        logo_url: form.logo_url,
        primary_color: form.primary_color,
        secondary_color: form.secondary_color,
        modules: form.modules,
      };
      const res = await fetch('/api/super-admin/restaurants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Restaurant created!');
        setModalMode(null);
        fetchRestaurants();
      } else {
        toast.error(data.error || 'Failed to create restaurant');
      }
    } catch { toast.error('Network error'); }
    finally { setSaving(false); }
  };

  const toggleFormModule = (key: string) => {
    setForm(f => ({
      ...f,
      modules: f.modules.includes(key) ? f.modules.filter(m => m !== key) : [...f.modules, key],
    }));
  };

  const S = styles;

  return (
    <div style={S.page}>
      <Toaster position="top-right" />

      {/* Header */}
      <div style={S.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '56px', height: '56px', flexShrink: 0, borderRadius: '50%', overflow: 'hidden', backgroundColor: '#fff', border: '1px solid #e2e8f0' }}>
            <img src="https://ik.imagekit.io/j2q8x5lu0/qdine/qdine-logo-rotated.png" alt="Qdine Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          <div>
            <h1 style={S.headerTitle}>Qdine Super admin</h1>
            <p style={S.headerSub}>Super Admin Console</p>
          </div>
        </div>
        <button onClick={openCreate} style={S.createBtn}>+ New Restaurant</button>
      </div>

      {/* Stats Bar */}
      <div style={S.statsBar}>
        {[
          { label: 'Total Restaurants', value: restaurants.length, icon: <Store size={24} />, color: '#10b981' },
          {
            label: 'SMS Wallet Balance',
            value: walletLoading ? 'Loading...' : (walletBalance !== null ? `₹${Number(walletBalance).toFixed(2)}` : 'Config Error'),
            icon: <MessageSquare size={24} />,
            color: '#0891b2'
          },
        ].map(stat => (
          <div key={stat.label} style={S.statCard}>
            <div style={{
              width: '48px', height: '48px', borderRadius: '10px',
              backgroundColor: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '24px', flexShrink: 0
            }}>
              {stat.icon}
            </div>
            <div>
              <div style={S.statValue}>{stat.value}</div>
              <div style={S.statLabel}>{stat.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Restaurant Grid */}
      <div style={S.grid}>
        {loading ? (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '80px', color: '#64748b' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}><Hourglass size={32} /></div>
            <p style={{ fontWeight: 600 }}>Loading restaurants...</p>
          </div>
        ) : restaurants.length === 0 ? (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '80px', color: '#64748b' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px', color: '#059669' }}><Store size={48} /></div>
            <p style={{ fontSize: '18px', fontWeight: 700, color: '#334155' }}>No restaurants yet</p>
            <p style={{ fontSize: '14px', marginTop: '8px' }}>Click "New Restaurant" to add your first tenant</p>
          </div>
        ) : restaurants.map(r => (
          <div
            key={r.id}
            onClick={() => router.push(`/super-admin/restaurants/${r.id}`)}
            style={{ ...S.card, cursor: 'pointer', transition: 'transform 0.15s, box-shadow 0.15s' }}
            onMouseEnter={e => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.06)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = 'none';
              e.currentTarget.style.boxShadow = S.card.boxShadow || 'none';
            }}
          >
            <div style={S.cardHeader}>
              <div style={S.cardAvatar}>
                {r.logo_url
                  ? <img src={r.logo_url} alt={r.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '8px' }} />
                  : r.name.charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h3 style={S.cardName}>{r.name}</h3>
                <div style={S.cardSlug}>
                  <span style={S.slugBadge}>/{r.slug}</span>
                </div>
              </div>
            </div>

            {r.phone && <p style={S.cardMeta}><Phone size={12} style={{ display: 'inline', verticalAlign: 'text-bottom', marginRight: '4px' }} />{r.phone}</p>}
            {r.address && <p style={S.cardMeta}><MapPin size={12} style={{ display: 'inline', verticalAlign: 'text-bottom', marginRight: '4px' }} />{r.address}</p>}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #f1f5f9' }}>
              <span style={{ fontSize: '12px', color: '#10b981', fontWeight: 700 }}>Manage Settings →</span>
              <span style={{ fontSize: '12px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Palette size={14} /> Custom Theme Set
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Create Modal */}
      {modalMode === 'create' && (
        <div style={S.backdrop} onClick={() => setModalMode(null)}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <div style={S.modalHeader}>
              <h2 style={S.modalTitle}><Store size={20} style={{ display: 'inline', verticalAlign: 'text-bottom', marginRight: '6px' }} /> New Restaurant</h2>
              <button onClick={() => setModalMode(null)} style={S.closeBtn}><X size={20} /></button>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px', overflowY: 'auto', maxHeight: '70vh', padding: '4px 2px' }}>
              <div>
                <label style={S.fieldLabel}>Restaurant Name *</label>
                <input type="text" required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Renjz Kitchen" style={S.input} />
              </div>
              
              <div>
                <label style={S.fieldLabel}>Slug (for URL route) *</label>
                <input type="text" required value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))} placeholder="e.g. renjz" style={S.input} />
              </div>
              
              <div>
                <label style={S.fieldLabel}>Phone *</label>
                <PhoneInput
                  international
                  countryCallingCodeEditable={false}
                  placeholder="Enter phone number"
                  value={form.phone as any}
                  onChange={val => setForm(f => ({ ...f, phone: val ? String(val) : '' }))}
                  defaultCountry="IN"
                  required
                  style={{ ...S.input, display: 'flex', alignItems: 'center' }}
                />
                <style>{`
                  .PhoneInputInput {
                    border: none;
                    outline: none;
                    flex: 1;
                    font-size: 14px;
                    background: transparent;
                    color: #0f172a;
                    padding-left: 8px;
                  }
                  .PhoneInputCountry {
                    margin-right: 8px;
                  }
                `}</style>
              </div>

              <div>
                <label style={S.fieldLabel}>Address *</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <input type="text" required value={form.address_street} onChange={e => setForm(f => ({ ...f, address_street: e.target.value }))} placeholder="Street Address" style={S.input} />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <input type="text" required value={form.address_city} onChange={e => setForm(f => ({ ...f, address_city: e.target.value }))} placeholder="City" style={S.input} />
                    <input type="text" required value={form.address_state} onChange={e => setForm(f => ({ ...f, address_state: e.target.value }))} placeholder="State / Province" style={S.input} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <input type="text" required value={form.address_zip} onChange={e => setForm(f => ({ ...f, address_zip: e.target.value }))} placeholder="ZIP / Postal Code" style={S.input} />
                    <input type="text" required value={form.address_country} onChange={e => setForm(f => ({ ...f, address_country: e.target.value }))} placeholder="Country" style={S.input} />
                  </div>
                </div>
              </div>

              <div>
                <label style={S.fieldLabel}>Logo URL</label>
                <input type="url" value={form.logo_url} onChange={e => setForm(f => ({ ...f, logo_url: e.target.value }))} placeholder="https://..." style={S.input} />
              </div>
              {/* Color Configuration */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={S.fieldLabel}>Primary Color</label>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                      type="color"
                      value={form.primary_color}
                      onChange={e => setForm(f => ({ ...f, primary_color: e.target.value }))}
                      style={{ width: '40px', height: '38px', padding: 0, border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer' }}
                    />
                    <input
                      type="text"
                      value={form.primary_color}
                      onChange={e => setForm(f => ({ ...f, primary_color: e.target.value }))}
                      placeholder="#800020"
                      maxLength={7}
                      style={{ ...S.input, padding: '8px 10px', height: '38px', fontFamily: 'monospace' }}
                    />
                  </div>
                </div>

                <div>
                  <label style={S.fieldLabel}>Secondary Color</label>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                      type="color"
                      value={form.secondary_color}
                      onChange={e => setForm(f => ({ ...f, secondary_color: e.target.value }))}
                      style={{ width: '40px', height: '38px', padding: 0, border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer' }}
                    />
                    <input
                      type="text"
                      value={form.secondary_color}
                      onChange={e => setForm(f => ({ ...f, secondary_color: e.target.value }))}
                      placeholder="#ecfdf5"
                      maxLength={7}
                      style={{ ...S.input, padding: '8px 10px', height: '38px', fontFamily: 'monospace' }}
                    />
                  </div>
                </div>
              </div>

              {/* Module toggles in modal */}
              <div>
                <label style={S.fieldLabel}>Enabled Modules</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '8px' }}>
                  {ALL_MODULES.map(mod => {
                    const active = form.modules.includes(mod.key);
                    return (
                      <button
                        key={mod.key}
                        type="button"
                        onClick={() => toggleFormModule(mod.key)}
                        style={{
                          padding: '10px 12px',
                          borderRadius: '8px',
                          border: `1px solid ${active ? '#10b981' : '#cbd5e1'}`,
                          background: active ? '#ecfdf5' : '#f8fafc',
                          color: active ? '#047857' : '#475569',
                          fontSize: '12px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          textAlign: 'left',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          transition: 'all 0.15s',
                        }}
                      >
                        <span>{mod.icon}</span>
                        <span>{mod.label}</span>
                        {active && <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center' }}><Check size={14} /></span>}
                      </button>
                    );
                  })}
                </div>
              </div>

              <button type="submit" disabled={saving} style={S.submitBtn}>
                {saving ? 'Creating...' : 'Create Restaurant'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', backgroundColor: '#f8fafc', fontFamily: "'Inter', sans-serif", padding: '0 0 60px', color: '#0f172a' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '24px 32px', borderBottom: '1px solid #e2e8f0', flexWrap: 'wrap', gap: '16px', backgroundColor: '#ffffff' },
  logoBox: { width: '40px', height: '40px', borderRadius: '10px', background: 'linear-gradient(135deg, #10b981, #059669)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', flexShrink: 0 },
  headerTitle: { color: '#0f172a', fontSize: '20px', fontWeight: 800, margin: 0 },
  headerSub: { color: '#64748b', fontSize: '12px', marginTop: '2px' },
  createBtn: { padding: '10px 20px', background: 'linear-gradient(135deg, #10b981, #059669)', border: 'none', borderRadius: '8px', color: 'white', fontSize: '14px', fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 14px rgba(16,185,129,0.25)', transition: 'all 0.2s' },
  statsBar: { display: 'flex', gap: '16px', padding: '24px 32px', flexWrap: 'wrap' },
  statCard: { display: 'flex', alignItems: 'center', gap: '16px', backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px 24px', flex: '1', minWidth: '180px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' },
  statValue: { color: '#0f172a', fontSize: '28px', fontWeight: 900, lineHeight: 1 },
  statLabel: { color: '#64748b', fontSize: '12px', fontWeight: 600, marginTop: '4px' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px', padding: '0 32px' },
  card: { backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px', transition: 'border-color 0.2s, box-shadow 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.02)', cursor: 'default' },
  cardHeader: { display: 'flex', alignItems: 'flex-start', gap: '12px' },
  cardAvatar: { width: '44px', height: '44px', borderRadius: '8px', background: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#059669', fontWeight: 900, fontSize: '18px', flexShrink: 0, border: '1px solid #a7f3d0' },
  cardName: { color: '#0f172a', fontWeight: 800, fontSize: '16px', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  cardSlug: { marginTop: '4px' },
  slugBadge: { background: '#f1f5f9', color: '#475569', fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', fontFamily: 'monospace', border: '1px solid #e2e8f0' },
  cardStats: { display: 'flex', gap: '16px' },
  cardStat: { display: 'flex', flexDirection: 'column', gap: '2px' },
  cardStatLabel: { color: '#64748b', fontSize: '11px', fontWeight: 600 },
  cardMeta: { color: '#475569', fontSize: '13px', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  cardActions: { display: 'flex', gap: '8px', marginTop: '4px' },
  btnModules: { flex: 1, padding: '8px', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '6px', color: '#047857', fontSize: '12px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s' },
  btnEdit: { padding: '8px 16px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', color: '#334155', fontSize: '12px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s' },
  btnDelete: { padding: '8px 12px', background: '#fef2f2', border: '1px solid #fee2e2', borderRadius: '6px', color: '#b91c1c', fontSize: '12px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s' },
  backdrop: { position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' },
  modal: { background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '28px', width: '100%', maxWidth: '540px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' },
  modalTitle: { color: '#0f172a', fontWeight: 800, fontSize: '18px', margin: 0 },
  closeBtn: { background: 'none', border: 'none', color: '#94a3b8', fontSize: '20px', cursor: 'pointer', padding: '4px 8px' },
  fieldLabel: { display: 'block', color: '#475569', fontSize: '11px', fontWeight: 700, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' },
  input: { width: '100%', padding: '10px 14px', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px', color: '#0f172a', fontSize: '14px', outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.2s' },
  submitBtn: { padding: '12px', background: 'linear-gradient(135deg, #10b981, #059669)', border: 'none', borderRadius: '8px', color: 'white', fontSize: '14px', fontWeight: 700, cursor: 'pointer', marginTop: '4px', boxShadow: '0 4px 12px rgba(16,185,129,0.2)' },
};
