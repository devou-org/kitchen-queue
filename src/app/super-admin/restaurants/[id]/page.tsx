'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { toast, Toaster } from 'react-hot-toast';

type Module = {
  module_name: string;
  is_enabled: boolean;
};

type Restaurant = {
  id: string;
  name: string;
  slug: string;
  phone?: string;
  address?: string;
  logo_url?: string;
  primary_color?: string;
  secondary_color?: string;
  menu_layout?: 'LIST' | 'GRID';
  menu_title?: string;
  menu_description?: string;
  created_at: string;
  modules?: Module[];
};

const ALL_MODULES = [
  { key: 'DIGITAL_MENU', label: '📖 Digital Menu', desc: 'Allows customers to view products and details on their phones.', icon: '📖' },
  { key: 'ONLINE_ORDERING', label: '🛒 Online Ordering', desc: 'Enables online checkout, payments, and shopping carts.', icon: '🛒' },
  { key: 'QUEUE_MANAGEMENT', label: '🎟️ Queue Management', desc: 'Tracks active order tokens and served tokens for kitchen screen.', icon: '🎟️' },
  { key: 'INVENTORY', label: '📦 Inventory Control', desc: 'Manages real-time stock, buffer alerts, and product availability.', icon: '📦' },
  { key: 'ANALYTICS', label: '📊 Live Analytics', desc: 'Displays 30-day orders, conversion rates, and revenue dashboards.', icon: '📊' },
  { key: 'REPORTS', label: '📋 PDF Reports', desc: 'Generates end-of-day sales, order lists, and customer activity logs.', icon: '📋' },
];

export default function RestaurantDetails() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  
  const [queueStatuses, setQueueStatuses] = useState<any[]>([]);

  // Form Fields State
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#971345');
  const [secondaryColor, setSecondaryColor] = useState('#EC7951');
  const [menuLayout, setMenuLayout] = useState<'LIST' | 'GRID'>('LIST');
  const [menuTitle, setMenuTitle] = useState("Today's Specials");
  const [menuDescription, setMenuDescription] = useState("Hand-curated coastal delicacies prepared with traditional recipes.");

  const authHeaders = { credentials: 'include' as const };

  const fetchQueueStatuses = useCallback(async () => {
    if (!id) return;
    try {
      const res = await fetch(`/api/super-admin/queue/status?restaurantId=${id}`, authHeaders);
      const data = await res.json();
      if (data.success) {
        setQueueStatuses(data.data);
      }
    } catch (err) {
      console.error('Error fetching queue statuses', err);
    }
  }, [id]);

  const fetchRestaurant = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/super-admin/restaurants/${id}`, authHeaders);
      if (res.status === 401) {
        router.push('/super-admin/login');
        return;
      }
      const data = await res.json();
      if (data.success && data.data) {
        const r: Restaurant = data.data;
        setRestaurant(r);
        setName(r.name);
        setSlug(r.slug);
        setPhone(r.phone || '');
        setAddress(r.address || '');
        setLogoUrl(r.logo_url || '');
        setPrimaryColor(r.primary_color || '#971345');
        setSecondaryColor(r.secondary_color || '#EC7951');
        setMenuLayout((r as any).menu_layout || 'LIST');
        setMenuTitle(r.menu_title || "Today's Specials");
        setMenuDescription(r.menu_description || "Hand-curated coastal delicacies prepared with traditional recipes.");
      } else {
        toast.error('Restaurant not found');
        router.push('/super-admin');
      }
    } catch {
      toast.error('Failed to load restaurant details');
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    fetchRestaurant();
    fetchQueueStatuses();
  }, [fetchRestaurant, fetchQueueStatuses]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !slug.trim()) {
      toast.error('Name and slug are required');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/super-admin/restaurants/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        ...authHeaders,
        body: JSON.stringify({
          name,
          slug: slug.toLowerCase().replace(/[^a-z0-9-]/g, ''),
          phone: phone || null,
          address: address || null,
          logo_url: logoUrl || null,
          primary_color: primaryColor,
          secondary_color: secondaryColor,
          menu_layout: menuLayout,
          menu_title: menuTitle || null,
          menu_description: menuDescription || null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Restaurant profile updated successfully!');
        setRestaurant(data.data);
      } else {
        toast.error(data.error || 'Failed to update restaurant');
      }
    } catch {
      toast.error('Connection error while updating restaurant');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleModule = async (moduleKey: string, isEnabled: boolean) => {
    if (!restaurant) return;
    try {
      const currentModules = restaurant.modules || [];
      const updatedModules = currentModules.map(m =>
        m.module_name === moduleKey ? { ...m, is_enabled: isEnabled } : m
      );
      if (!currentModules.find(m => m.module_name === moduleKey)) {
        updatedModules.push({ module_name: moduleKey, is_enabled: isEnabled });
      }

      // Optimistic update
      setRestaurant(prev => prev ? { ...prev, modules: updatedModules } : null);

      const res = await fetch(`/api/super-admin/restaurants/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        ...authHeaders,
        body: JSON.stringify({ modules: updatedModules }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`${ALL_MODULES.find(m => m.key === moduleKey)?.label} subscription updated!`);
      } else {
        toast.error(data.error || 'Failed to update module');
        fetchRestaurant(); // Rollback
      }
    } catch {
      toast.error('Failed to sync module change with server');
      fetchRestaurant(); // Rollback
    }
  };

  const handleDeleteStatus = async (statusId: string) => {
    try {
      const res = await fetch(`/api/super-admin/queue/status?statusId=${statusId}&restaurantId=${id}`, {
        method: 'DELETE',
        ...authHeaders,
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Queue status deleted!');
        fetchQueueStatuses();
      } else {
        toast.error(data.error || 'Failed to delete status');
      }
    } catch {
      toast.error('Connection error while deleting status');
    }
  };

  const handleDeleteRestaurant = async () => {
    try {
      const res = await fetch(`/api/super-admin/restaurants/${id}`, {
        method: 'DELETE',
        ...authHeaders,
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Restaurant deleted successfully!');
        router.push('/super-admin');
      } else {
        toast.error(data.error || 'Failed to delete restaurant');
      }
    } catch {
      toast.error('Connection error while deleting restaurant');
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: "'Inter', sans-serif" }}>
        <div style={{ fontSize: '48px', animation: 'spin 1s linear infinite', marginBottom: '16px' }}>⏳</div>
        <p style={{ color: '#475569', fontWeight: 600 }}>Loading restaurant configuration...</p>
      </div>
    );
  }

  if (!restaurant) return null;

  return (
    <div style={S.page}>
      <Toaster position="top-right" />
      
      {/* Top Banner Navigation */}
      <div style={S.topNav}>
        <Link href="/super-admin" style={S.backBtn}>
          ← Back to Dashboard
        </Link>
        <span style={{ color: '#94a3b8', margin: '0 8px' }}>|</span>
        <span style={{ color: '#64748b', fontSize: '13px', fontWeight: 500 }}>
          Manage Tenant: <strong>{restaurant.name}</strong>
        </span>
      </div>

      <div style={S.container}>
        {/* Title Header */}
        <div style={S.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{
              width: '56px', height: '56px', borderRadius: '12px',
              backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '24px', flexShrink: 0, overflow: 'hidden'
            }}>
              {logoUrl ? (
                <img src={logoUrl} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                name.charAt(0).toUpperCase()
              )}
            </div>
            <div>
              <h1 style={S.title}>{name}</h1>
              <p style={S.subtitle}>slug: <span style={S.slugBadge}>/{slug}</span> • registered: {new Date(restaurant.created_at).toLocaleDateString()}</p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <a href={`/${slug}/menu`} target="_blank" rel="noopener noreferrer" style={S.secondaryLinkBtn}>
              🌐 Customer Menu
            </a>
            <a href={`/${slug}/admin/products`} target="_blank" rel="noopener noreferrer" style={S.primaryLinkBtn}>
              🔑 Admin Portal
            </a>
          </div>
        </div>

        {/* Dashboard Panels Layout */}
        <div style={S.grid}>
          {/* Left Panel: Profile Configurations */}
          <div style={S.card}>
            <h2 style={S.cardTitle}>✏️ Profile & Branding</h2>
            <p style={S.cardDesc}>
              Branding and Profile configurations (name, colors, logo, and menu layout) have been moved to the <strong>Restaurant Admin Portal</strong> under the <strong>Settings</strong> tab.
            </p>
            <div style={{ marginTop: '16px' }}>
              <a href={`/${slug}/admin/settings`} target="_blank" rel="noopener noreferrer" style={S.primaryLinkBtn}>
                Manage Settings →
              </a>
            </div>
          </div>

          {/* Right Panel: Modules and Brand Preview */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            


            {/* Subscribed Modules Settings */}
            <div style={S.card}>
              <h2 style={S.cardTitle}>⚙️ Subscription Modules</h2>
              <p style={S.cardDesc}>Instantly toggle which platform services are enabled for this restaurant.</p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '16px' }}>
                {ALL_MODULES.map(mod => {
                  const mData = (restaurant.modules || []).find(m => m.module_name === mod.key);
                  const isEnabled = mData ? mData.is_enabled : true;

                  return (
                    <div key={mod.key} style={{
                      display: 'flex', alignItems: 'center', gap: '12px',
                      padding: '12px 14px', borderRadius: '8px',
                      border: `1px solid ${isEnabled ? '#a7f3d0' : '#e2e8f0'}`,
                      backgroundColor: isEnabled ? '#ecfdf5' : '#f8fafc',
                      transition: 'all 0.2s',
                    }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontWeight: 700, fontSize: '13px', color: '#0f172a' }}>{mod.label}</span>
                          {isEnabled && <span style={{ fontSize: '11px', padding: '1px 5px', borderRadius: '4px', backgroundColor: '#10b981', color: 'white', fontWeight: 700 }}>active</span>}
                        </div>
                        <div style={{ color: '#64748b', fontSize: '11px', marginTop: '2px' }}>{mod.desc}</div>
                      </div>
                      
                      {/* Interactive Switch */}
                      <button
                        onClick={() => handleToggleModule(mod.key, !isEnabled)}
                        style={{
                          width: '42px', height: '22px', borderRadius: '11px',
                          border: 'none', backgroundColor: isEnabled ? '#10b981' : '#cbd5e1',
                          cursor: 'pointer', position: 'relative', transition: 'background-color 0.2s',
                          flexShrink: 0
                        }}
                      >
                        <div style={{
                          width: '16px', height: '16px', borderRadius: '50%',
                          backgroundColor: 'white', position: 'absolute', top: '3px',
                          left: isEnabled ? '23px' : '3px', transition: 'left 0.2s',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                        }} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Queue Management Settings */}
            <div style={S.card}>
              <h2 style={S.cardTitle}>🎟️ Queue Management</h2>
              <p style={S.cardDesc}>Add custom status tags for this restaurant's queue (e.g. VIP_WAITING).</p>
              
              <form onSubmit={async (e) => {
                e.preventDefault();
                const input = (e.target as any).statusInput;
                const colorInput = (e.target as any).statusColor;
                const customStatus = input.value;
                const color = colorInput.value;
                if (!customStatus) return;
                
                try {
                  const res = await fetch(`/api/super-admin/queue/status`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    ...authHeaders,
                    body: JSON.stringify({ restaurantId: id, statusEnum: customStatus.toUpperCase().replace(/\s+/g, '_'), color })
                  });
                  const data = await res.json();
                  if (data.success) {
                    toast.success(`Status ${customStatus} added!`);
                    input.value = '';
                    fetchQueueStatuses();
                  } else {
                    toast.error(data.error || 'Failed to add status');
                  }
                } catch (err) {
                  toast.error('Connection error adding status');
                }
              }}>
                <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                  <input 
                    type="color" 
                    name="statusColor"
                    defaultValue="#cbd5e1"
                    style={{ ...S.colorSwatch, width: '42px', height: '42px' }}
                    title="Status Color"
                  />
                  <input 
                    type="text" 
                    name="statusInput"
                    placeholder="New Status (e.g. VIP_WAITING)" 
                    style={{ flex: 1, padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13px', outline: 'none' }}
                    required
                  />
                  <button type="submit" style={{ padding: '10px 16px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
                    Add Status
                  </button>
                </div>
              </form>

              {queueStatuses.length > 0 && (
                <div style={{ marginTop: '16px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {queueStatuses.map((qs) => (
                    <div key={qs.id} style={{ 
                      display: 'flex', alignItems: 'center', gap: '8px', 
                      backgroundColor: '#f1f5f9', padding: '6px 12px', 
                      borderRadius: '16px', fontSize: '12px', fontWeight: 600, color: '#334155',
                      border: `1px solid ${qs.color || '#e2e8f0'}`
                    }}>
                      <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: qs.color || '#cbd5e1' }} />
                      {qs.possible_queue_status}
                      <button 
                        onClick={() => handleDeleteStatus(qs.id)}
                        style={{
                          background: 'none', border: 'none', color: '#94a3b8', 
                          cursor: 'pointer', fontSize: '12px', padding: '0 2px', display: 'flex', alignItems: 'center'
                        }}
                        title="Delete status"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Danger Zone deletion panel */}
            <div style={{ ...S.card, borderColor: '#fecaca', backgroundColor: '#fff5f5' }}>
              <h2 style={{ ...S.cardTitle, color: '#991b1b' }}>⚠️ Danger Zone</h2>
              <p style={{ ...S.cardDesc, color: '#7f1d1d' }}>Delete this restaurant and all associated digital products, token logs, and queues permanently.</p>
              
              {!deleteConfirm ? (
                <button onClick={() => setDeleteConfirm(true)} style={S.deleteInitBtn}>
                  Delete Restaurant
                </button>
              ) : (
                <div style={{ marginTop: '12px' }}>
                  <p style={{ fontSize: '12px', color: '#b91c1c', fontWeight: 700, marginBottom: '8px' }}>Are you absolutely sure? This action is non-reversible.</p>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => setDeleteConfirm(false)} style={S.cancelBtn}>
                      No, Keep It
                    </button>
                    <button onClick={handleDeleteRestaurant} style={S.deleteConfirmBtn}>
                      Yes, Delete Permanently
                    </button>
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', backgroundColor: '#f8fafc', fontFamily: "'Inter', sans-serif", padding: '0 0 80px', color: '#0f172a' },
  topNav: { display: 'flex', alignItems: 'center', backgroundColor: '#ffffff', borderBottom: '1px solid #e2e8f0', padding: '12px 32px' },
  backBtn: { fontSize: '13px', color: '#059669', textDecoration: 'none', fontWeight: 700 },
  container: { maxWidth: '1080px', margin: '0 auto', padding: '24px 20px 0' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '24px', backgroundColor: '#ffffff', padding: '20px 24px', borderRadius: '12px', border: '1px solid #e2e8f0' },
  title: { fontSize: '24px', fontWeight: 800, color: '#0f172a', margin: 0 },
  subtitle: { fontSize: '13px', color: '#64748b', marginTop: '4px', margin: 0 },
  slugBadge: { background: '#f1f5f9', color: '#475569', padding: '1px 6px', borderRadius: '4px', fontFamily: 'monospace', fontSize: '11px', fontWeight: 700 },
  primaryLinkBtn: { textDecoration: 'none', padding: '10px 18px', backgroundColor: '#10b981', color: 'white', fontSize: '13px', fontWeight: 700, borderRadius: '8px', boxShadow: '0 2px 8px rgba(16,185,129,0.2)' },
  secondaryLinkBtn: { textDecoration: 'none', padding: '10px 18px', backgroundColor: '#ffffff', color: '#334155', fontSize: '13px', fontWeight: 700, borderRadius: '8px', border: '1px solid #cbd5e1' },
  grid: { display: 'grid', gridTemplateColumns: 'minmax(300px, 3fr) minmax(300px, 2fr)', gap: '20px', alignItems: 'start' },
  card: { backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.01)' },
  cardTitle: { fontSize: '16px', fontWeight: 800, color: '#0f172a', margin: 0 },
  cardDesc: { fontSize: '12px', color: '#64748b', marginTop: '4px', margin: 0 },
  label: { display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px' },
  input: { width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', color: '#0f172a', fontSize: '14px', outline: 'none', transition: 'border-color 0.2s', boxSizing: 'border-box' },
  colorSwatch: { width: '38px', height: '38px', padding: 0, border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', flexShrink: 0 },
  colorInput: { flex: 1, padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', color: '#0f172a', fontSize: '14px', fontFamily: 'monospace' },
  saveBtn: { display: 'block', width: '100%', padding: '12px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 10px rgba(16,185,129,0.15)', marginTop: '8px' },
  deleteInitBtn: { display: 'block', width: '100%', padding: '10px', backgroundColor: 'transparent', color: '#b91c1c', border: '1px solid #fca5a5', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', marginTop: '12px' },
  deleteConfirmBtn: { flex: 1, padding: '10px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' },
  cancelBtn: { flex: 1, padding: '10px', backgroundColor: '#ffffff', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }
};
