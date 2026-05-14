'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import toast, { Toaster } from 'react-hot-toast';

const ALL_MODULES = [
  { key: 'DIGITAL_MENU', label: 'Digital Menu', icon: '📋', desc: 'QR code menu, categories, pricing' },
  { key: 'ONLINE_ORDERING', label: 'Online Ordering', icon: '🛒', desc: 'Cart, checkout, OTP verification' },
  { key: 'QUEUE_MANAGEMENT', label: 'Queue Management', icon: '🎟️', desc: 'Token generation, live queue display' },
  { key: 'INVENTORY', label: 'Inventory', icon: '📦', desc: 'Stock tracking, low stock alerts' },
  { key: 'ANALYTICS', label: 'Analytics', icon: '📊', desc: 'Revenue, peak hours, reports' },
  { key: 'REPORTS', label: 'Reports', icon: '🧾', desc: 'Statements, billing, exports' },
];

type Restaurant = {
  id: string;
  name: string;
  slug: string;
  phone?: string;
  address?: string;
  logo_url?: string;
  created_at: string;
  orders_30d?: number;
  active_products?: number;
  modules?: { module_name: string; is_enabled: boolean }[];
};

type ModalMode = 'create' | 'edit' | null;

const EMPTY_FORM = { name: '', slug: '', phone: '', address: '', logo_url: '', modules: ALL_MODULES.map(m => m.key) };

export default function SuperAdminDashboard() {
  const router = useRouter();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [selected, setSelected] = useState<Restaurant | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [modulePanel, setModulePanel] = useState<Restaurant | null>(null);
  const [moduleSaving, setModuleSaving] = useState(false);

  const authHeaders = { credentials: 'include' as const };

  const fetchRestaurants = useCallback(async () => {
    try {
      const res = await fetch('/api/super-admin/restaurants', authHeaders);
      if (res.status === 401) { router.push('/super-admin/login'); return; }
      const data = await res.json();
      if (data.success) setRestaurants(data.data);
    } catch { toast.error('Failed to load restaurants'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchRestaurants(); }, [fetchRestaurants]);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setSelected(null);
    setModalMode('create');
  };

  const openEdit = async (r: Restaurant) => {
    setSaving(false);
    const res = await fetch(`/api/super-admin/restaurants/${r.id}`, authHeaders);
    const data = await res.json();
    const full: Restaurant = data.data || r;
    setSelected(full);
    setForm({
      name: full.name,
      slug: full.slug,
      phone: full.phone || '',
      address: full.address || '',
      logo_url: full.logo_url || '',
      modules: (full.modules || []).filter(m => m.is_enabled).map(m => m.module_name),
    });
    setModalMode('edit');
  };

  const openModules = async (r: Restaurant) => {
    const res = await fetch(`/api/super-admin/restaurants/${r.id}`, authHeaders);
    const data = await res.json();
    setModulePanel(data.data || r);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        modules: form.modules,
      };
      const url = modalMode === 'create'
        ? '/api/super-admin/restaurants'
        : `/api/super-admin/restaurants/${selected?.id}`;
      const method = modalMode === 'create' ? 'POST' : 'PUT';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(modalMode === 'create' ? 'Restaurant created! 🎉' : 'Restaurant updated!');
        setModalMode(null);
        fetchRestaurants();
      } else {
        toast.error(data.error || 'Failed to save');
      }
    } catch { toast.error('Network error'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/super-admin/restaurants/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Restaurant deleted');
        setDeleteConfirm(null);
        fetchRestaurants();
      } else {
        toast.error(data.error || 'Failed to delete');
      }
    } catch { toast.error('Network error'); }
  };

  const handleModuleToggle = async (moduleName: string, isEnabled: boolean) => {
    if (!modulePanel) return;
    setModuleSaving(true);
    try {
      const currentModules = modulePanel.modules || [];
      const updatedModules = currentModules.map(m =>
        m.module_name === moduleName ? { ...m, is_enabled: isEnabled } : m
      );
      if (!currentModules.find(m => m.module_name === moduleName)) {
        updatedModules.push({ module_name: moduleName, is_enabled: isEnabled });
      }
      const res = await fetch(`/api/super-admin/restaurants/${modulePanel.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ modules: updatedModules }),
      });
      const data = await res.json();
      if (data.success) {
        setModulePanel(data.data);
        toast.success(`${moduleName} ${isEnabled ? 'enabled' : 'disabled'}`);
        fetchRestaurants();
      } else {
        toast.error(data.error || 'Failed to update module');
      }
    } catch { toast.error('Network error'); }
    finally { setModuleSaving(false); }
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
          <div style={S.logoBox}>⚡</div>
          <div>
            <h1 style={S.headerTitle}>Devou Platform</h1>
            <p style={S.headerSub}>Super Admin Console</p>
          </div>
        </div>
        <button onClick={openCreate} style={S.createBtn}>+ New Restaurant</button>
      </div>

      {/* Stats Bar */}
      <div style={S.statsBar}>
        {[
          { label: 'Total Restaurants', value: restaurants.length, icon: '🏪' },
          { label: 'Total Modules Active', value: restaurants.reduce((acc, r) => acc + (r.active_products || 0), 0), icon: '⚙️' },
          { label: 'Orders (30d)', value: restaurants.reduce((acc, r) => acc + Number(r.orders_30d || 0), 0), icon: '📦' },
        ].map(stat => (
          <div key={stat.label} style={S.statCard}>
            <span style={{ fontSize: '28px' }}>{stat.icon}</span>
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
          <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '80px', color: 'rgba(255,255,255,0.4)' }}>
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>⏳</div>
            Loading restaurants...
          </div>
        ) : restaurants.length === 0 ? (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '80px', color: 'rgba(255,255,255,0.4)' }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>🏪</div>
            <p style={{ fontSize: '18px', fontWeight: 700, color: 'rgba(255,255,255,0.6)' }}>No restaurants yet</p>
            <p style={{ fontSize: '14px', marginTop: '8px' }}>Click "New Restaurant" to add your first tenant</p>
          </div>
        ) : restaurants.map(r => (
          <div key={r.id} style={S.card}>
            <div style={S.cardHeader}>
              <div style={S.cardAvatar}>
                {r.logo_url
                  ? <img src={r.logo_url} alt={r.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '10px' }} />
                  : r.name.charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h3 style={S.cardName}>{r.name}</h3>
                <div style={S.cardSlug}>
                  <span style={S.slugBadge}>/{r.slug}</span>
                </div>
              </div>
            </div>

            <div style={S.cardStats}>
              <div style={S.cardStat}>
                <span style={{ fontSize: '18px', fontWeight: 800, color: '#a78bfa' }}>{r.orders_30d || 0}</span>
                <span style={S.cardStatLabel}>orders/30d</span>
              </div>
              <div style={S.cardStat}>
                <span style={{ fontSize: '18px', fontWeight: 800, color: '#34d399' }}>{r.active_products || 0}</span>
                <span style={S.cardStatLabel}>products</span>
              </div>
            </div>

            {r.phone && <p style={S.cardMeta}>📞 {r.phone}</p>}
            {r.address && <p style={S.cardMeta}>📍 {r.address}</p>}

            <div style={S.cardActions}>
              <button onClick={() => openModules(r)} style={S.btnModules}>⚙️ Modules</button>
              <button onClick={() => openEdit(r)} style={S.btnEdit}>Edit</button>
              <button onClick={() => setDeleteConfirm(r.id)} style={S.btnDelete}>✕</button>
            </div>
          </div>
        ))}
      </div>

      {/* Create/Edit Modal */}
      {modalMode && (
        <div style={S.backdrop} onClick={() => setModalMode(null)}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <div style={S.modalHeader}>
              <h2 style={S.modalTitle}>{modalMode === 'create' ? '🏪 New Restaurant' : '✏️ Edit Restaurant'}</h2>
              <button onClick={() => setModalMode(null)} style={S.closeBtn}>✕</button>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px', overflowY: 'auto', maxHeight: '70vh', padding: '4px 2px' }}>
              {[
                { label: 'Restaurant Name *', key: 'name', placeholder: 'e.g. Renjz Kitchen', type: 'text', required: true },
                { label: 'Slug (for subdomain) *', key: 'slug', placeholder: 'e.g. renjz (only lowercase, numbers, hyphens)', type: 'text', required: true },
                { label: 'Phone', key: 'phone', placeholder: '+91 98765 43210', type: 'text', required: false },
                { label: 'Address', key: 'address', placeholder: 'Restaurant address', type: 'text', required: false },
                { label: 'Logo URL', key: 'logo_url', placeholder: 'https://...', type: 'url', required: false },
              ].map(field => (
                <div key={field.key}>
                  <label style={S.fieldLabel}>{field.label}</label>
                  <input
                    type={field.type}
                    required={field.required}
                    value={(form as any)[field.key]}
                    onChange={e => {
                      const val = field.key === 'slug' ? e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') : e.target.value;
                      setForm(f => ({ ...f, [field.key]: val }));
                    }}
                    placeholder={field.placeholder}
                    style={S.input}
                  />
                </div>
              ))}

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
                          border: `1px solid ${active ? 'rgba(99,102,241,0.6)' : 'rgba(255,255,255,0.1)'}`,
                          background: active ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.04)',
                          color: active ? '#a78bfa' : 'rgba(255,255,255,0.5)',
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
                        {active && <span style={{ marginLeft: 'auto', fontSize: '10px' }}>✓</span>}
                      </button>
                    );
                  })}
                </div>
              </div>

              <button type="submit" disabled={saving} style={S.submitBtn}>
                {saving ? 'Saving...' : modalMode === 'create' ? 'Create Restaurant' : 'Save Changes'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Module Management Panel */}
      {modulePanel && (
        <div style={S.backdrop} onClick={() => setModulePanel(null)}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <div style={S.modalHeader}>
              <h2 style={S.modalTitle}>⚙️ Modules — {modulePanel.name}</h2>
              <button onClick={() => setModulePanel(null)} style={S.closeBtn}>✕</button>
            </div>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', marginBottom: '20px' }}>
              Toggle which features this restaurant has access to.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {ALL_MODULES.map(mod => {
                const mData = (modulePanel.modules || []).find(m => m.module_name === mod.key);
                const isEnabled = mData?.is_enabled ?? true;
                return (
                  <div key={mod.key} style={{
                    display: 'flex', alignItems: 'center', gap: '14px',
                    padding: '14px 16px',
                    borderRadius: '10px',
                    border: `1px solid ${isEnabled ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.08)'}`,
                    background: isEnabled ? 'rgba(99,102,241,0.08)' : 'rgba(255,255,255,0.03)',
                    transition: 'all 0.2s',
                  }}>
                    <span style={{ fontSize: '24px' }}>{mod.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: 'white', fontWeight: 700, fontSize: '14px' }}>{mod.label}</div>
                      <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', marginTop: '2px' }}>{mod.desc}</div>
                    </div>
                    {/* Toggle switch */}
                    <button
                      onClick={() => handleModuleToggle(mod.key, !isEnabled)}
                      disabled={moduleSaving}
                      style={{
                        width: '48px', height: '26px',
                        borderRadius: '13px',
                        border: 'none',
                        background: isEnabled ? '#6366f1' : 'rgba(255,255,255,0.15)',
                        cursor: moduleSaving ? 'not-allowed' : 'pointer',
                        position: 'relative',
                        transition: 'background 0.2s',
                        flexShrink: 0,
                      }}
                    >
                      <div style={{
                        width: '20px', height: '20px',
                        borderRadius: '50%',
                        background: 'white',
                        position: 'absolute',
                        top: '3px',
                        left: isEnabled ? '25px' : '3px',
                        transition: 'left 0.2s',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                      }} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteConfirm && (
        <div style={S.backdrop} onClick={() => setDeleteConfirm(null)}>
          <div style={{ ...S.modal, maxWidth: '380px' }} onClick={e => e.stopPropagation()}>
            <div style={{ textAlign: 'center', padding: '8px 0' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
              <h2 style={{ color: 'white', fontWeight: 800, marginBottom: '8px' }}>Delete Restaurant?</h2>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', marginBottom: '24px' }}>
                This will permanently delete the restaurant and ALL its data (orders, products, queue). This cannot be undone.
              </p>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={() => setDeleteConfirm(null)} style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontWeight: 700 }}>
                  Cancel
                </button>
                <button onClick={() => handleDelete(deleteConfirm)} style={{ flex: 1, padding: '12px', borderRadius: '8px', border: 'none', background: '#ef4444', color: 'white', cursor: 'pointer', fontWeight: 700 }}>
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', background: 'linear-gradient(135deg, #0f0f23 0%, #1a1a3e 50%, #0d1b2a 100%)', fontFamily: "'Inter', sans-serif", padding: '0 0 60px' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '24px 32px', borderBottom: '1px solid rgba(255,255,255,0.08)', flexWrap: 'wrap', gap: '16px' },
  logoBox: { width: '44px', height: '44px', borderRadius: '12px', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', flexShrink: 0 },
  headerTitle: { color: 'white', fontSize: '20px', fontWeight: 800, margin: 0 },
  headerSub: { color: 'rgba(255,255,255,0.4)', fontSize: '12px', marginTop: '2px' },
  createBtn: { padding: '10px 20px', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', border: 'none', borderRadius: '10px', color: 'white', fontSize: '14px', fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 20px rgba(99,102,241,0.3)' },
  statsBar: { display: 'flex', gap: '16px', padding: '24px 32px', flexWrap: 'wrap' },
  statCard: { display: 'flex', alignItems: 'center', gap: '16px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px', padding: '16px 24px', flex: '1', minWidth: '180px' },
  statValue: { color: 'white', fontSize: '28px', fontWeight: 900, lineHeight: 1 },
  statLabel: { color: 'rgba(255,255,255,0.4)', fontSize: '12px', fontWeight: 600, marginTop: '4px' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px', padding: '0 32px' },
  card: { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px', transition: 'border-color 0.2s', cursor: 'default' },
  cardHeader: { display: 'flex', alignItems: 'flex-start', gap: '12px' },
  cardAvatar: { width: '44px', height: '44px', borderRadius: '10px', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 900, fontSize: '18px', flexShrink: 0 },
  cardName: { color: 'white', fontWeight: 800, fontSize: '16px', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  cardSlug: { marginTop: '4px' },
  slugBadge: { background: 'rgba(99,102,241,0.2)', color: '#a78bfa', fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', fontFamily: 'monospace' },
  cardStats: { display: 'flex', gap: '16px' },
  cardStat: { display: 'flex', flexDirection: 'column', gap: '2px' },
  cardStatLabel: { color: 'rgba(255,255,255,0.4)', fontSize: '11px', fontWeight: 600 },
  cardMeta: { color: 'rgba(255,255,255,0.4)', fontSize: '13px', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  cardActions: { display: 'flex', gap: '8px', marginTop: '4px' },
  btnModules: { flex: 1, padding: '8px', background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: '7px', color: '#a78bfa', fontSize: '12px', fontWeight: 700, cursor: 'pointer' },
  btnEdit: { padding: '8px 16px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '7px', color: 'rgba(255,255,255,0.7)', fontSize: '12px', fontWeight: 700, cursor: 'pointer' },
  btnDelete: { padding: '8px 12px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '7px', color: '#fca5a5', fontSize: '12px', fontWeight: 700, cursor: 'pointer' },
  backdrop: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' },
  modal: { background: '#1a1a3e', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '20px', padding: '28px', width: '100%', maxWidth: '540px', maxHeight: '90vh', overflowY: 'auto' },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' },
  modalTitle: { color: 'white', fontWeight: 800, fontSize: '18px', margin: 0 },
  closeBtn: { background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: '20px', cursor: 'pointer', padding: '4px 8px' },
  fieldLabel: { display: 'block', color: 'rgba(255,255,255,0.6)', fontSize: '11px', fontWeight: 700, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' },
  input: { width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px', color: 'white', fontSize: '14px', outline: 'none', boxSizing: 'border-box' },
  submitBtn: { padding: '12px', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', border: 'none', borderRadius: '10px', color: 'white', fontSize: '14px', fontWeight: 700, cursor: 'pointer', marginTop: '4px' },
};
