'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { toast, Toaster } from 'react-hot-toast';
import { Loader2, Globe, Key, Ticket, Settings, AlertTriangle, Pencil, X, ClipboardList, ShoppingCart, Receipt } from 'lucide-react';
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
  { key: 'DIGITAL_MENU', label: 'Digital Menu', desc: 'Allows customers to view products and details on their phones.', icon: <ClipboardList size={16} /> },
  { key: 'ONLINE_ORDERING', label: 'Online Ordering', desc: 'Enables online checkout, payments, and shopping carts.', icon: <ShoppingCart size={16} /> },
  { key: 'QUEUE_MANAGEMENT', label: 'Queue Management', desc: 'Tracks active order tokens and served tokens for kitchen screen.', icon: <Ticket size={16} /> },
];

export default function RestaurantDetails() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void } | null>(null);
  
  const [queueStatuses, setQueueStatuses] = useState<any[]>([]);
  
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [savingAdmin, setSavingAdmin] = useState(false);

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

  const fetchAdminDetails = useCallback(async () => {
    if (!id) return;
    try {
      const res = await fetch(`/api/super-admin/restaurants/${id}/admin`, authHeaders);
      const data = await res.json();
      if (data.success && data.email) {
        setAdminEmail(data.email);
      }
    } catch (err) {
      console.error('Error fetching admin details', err);
    }
  }, [id]);

  useEffect(() => {
    fetchRestaurant();
    fetchQueueStatuses();
    fetchAdminDetails();
  }, [fetchRestaurant, fetchQueueStatuses, fetchAdminDetails]);

  const handleSaveAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminEmail.trim()) {
      toast.error('Email is required');
      return;
    }
    setSavingAdmin(true);
    try {
      const res = await fetch(`/api/super-admin/restaurants/${id}/admin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        ...authHeaders,
        body: JSON.stringify({ email: adminEmail, password: adminPassword }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message || 'Admin credentials updated!');
        setAdminPassword('');
      } else {
        toast.error(data.error || 'Failed to update credentials');
      }
    } catch {
      toast.error('Connection error while updating credentials');
    } finally {
      setSavingAdmin(false);
    }
  };

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

    const proceedToggle = async () => {
      const currentModules = restaurant.modules || [];
      let updatedModules = currentModules.map(m =>
        m.module_name === moduleKey ? { ...m, is_enabled: isEnabled } : m
      );
      if (!currentModules.find(m => m.module_name === moduleKey)) {
        updatedModules.push({ module_name: moduleKey, is_enabled: isEnabled });
      }

      // Mutually exclusive logic
      if (isEnabled && moduleKey === 'ONLINE_ORDERING') {
        updatedModules = updatedModules.map(m => m.module_name === 'QUEUE_MANAGEMENT' ? { ...m, is_enabled: false } : m);
        if (!currentModules.find(m => m.module_name === 'QUEUE_MANAGEMENT')) {
          updatedModules.push({ module_name: 'QUEUE_MANAGEMENT', is_enabled: false });
        }
      }

      if (isEnabled && moduleKey === 'QUEUE_MANAGEMENT') {
        updatedModules = updatedModules.map(m => m.module_name === 'ONLINE_ORDERING' ? { ...m, is_enabled: false } : m);
        if (!currentModules.find(m => m.module_name === 'ONLINE_ORDERING')) {
          updatedModules.push({ module_name: 'ONLINE_ORDERING', is_enabled: false });
        }
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
        
        // Auto-add statuses if enabled
        if (isEnabled && moduleKey === 'ONLINE_ORDERING') {
          await fetch(`/api/super-admin/queue/status`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, ...authHeaders, body: JSON.stringify({ restaurantId: id, statusEnum: 'PENDING', color: '#f59e0b', priority: 1 }) });
          await fetch(`/api/super-admin/queue/status`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, ...authHeaders, body: JSON.stringify({ restaurantId: id, statusEnum: 'PREPARING', color: '#3b82f6', priority: 2 }) });
          await fetch(`/api/super-admin/queue/status`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, ...authHeaders, body: JSON.stringify({ restaurantId: id, statusEnum: 'READY', color: '#8b5cf6', priority: 3 }) });
          await fetch(`/api/super-admin/queue/status`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, ...authHeaders, body: JSON.stringify({ restaurantId: id, statusEnum: 'PAID', color: '#10b981', priority: 4 }) });
          await fetch(`/api/super-admin/queue/status`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, ...authHeaders, body: JSON.stringify({ restaurantId: id, statusEnum: 'CANCELLED', color: '#ef4444', priority: 5 }) });
          fetchQueueStatuses();
        }
        
        if (isEnabled && moduleKey === 'QUEUE_MANAGEMENT') {
          await fetch(`/api/super-admin/queue/status`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, ...authHeaders, body: JSON.stringify({ restaurantId: id, statusEnum: 'PENDING', color: '#f59e0b', priority: 1 }) });
          await fetch(`/api/super-admin/queue/status`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, ...authHeaders, body: JSON.stringify({ restaurantId: id, statusEnum: 'SEATED', color: '#3b82f6', priority: 2 }) });
          await fetch(`/api/super-admin/queue/status`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, ...authHeaders, body: JSON.stringify({ restaurantId: id, statusEnum: 'CANCELLED', color: '#ef4444', priority: 3 }) });
          fetchQueueStatuses();
        }

      } else {
        toast.error(data.error || 'Failed to update module');
        fetchRestaurant(); // Rollback
      }
    };

    if (isEnabled && moduleKey === 'ONLINE_ORDERING') {
      setConfirmModal({
        isOpen: true,
        title: "Enable Online Ordering?",
        message: "This will disable Queue Management (if enabled) and add default statuses: PENDING, PREPARING, READY, PAID, CANCELLED. Proceed?",
        onConfirm: () => {
          setConfirmModal(null);
          proceedToggle();
        }
      });
      return;
    }

    if (isEnabled && moduleKey === 'QUEUE_MANAGEMENT') {
      setConfirmModal({
        isOpen: true,
        title: "Enable Queue Management?",
        message: "This will disable Online Ordering (if enabled) and add default statuses: PENDING, SEATED, CANCELLED. Proceed?",
        onConfirm: () => {
          setConfirmModal(null);
          proceedToggle();
        }
      });
      return;
    }

    proceedToggle();
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
        <div style={{ marginBottom: '16px', color: '#64748b', display: 'flex', justifyContent: 'center' }}><Loader2 size={48} className="animate-spin" /></div>
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
            <a href={`/${slug}/menu`} target="_blank" rel="noopener noreferrer" style={{...S.secondaryLinkBtn, display: 'flex', alignItems: 'center', gap: '6px'}}>
              <Globe size={16} /> Customer Menu
            </a>
            <Link href={`/super-admin/restaurants/${id}/billing`} style={{...S.primaryLinkBtn, backgroundColor: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px'}}>
              <Receipt size={16} /> Billing Console
            </Link>
            <a href={`/${slug}/admin/products`} target="_blank" rel="noopener noreferrer" style={{...S.primaryLinkBtn, display: 'flex', alignItems: 'center', gap: '6px'}}>
              <Key size={16} /> Admin Portal
            </a>
          </div>
        </div>

        {/* Dashboard Panels Layout */}
        <div style={S.grid}>
          {/* Left Panel: Admin & Queue */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* Admin Credentials */}
            <div style={S.card}>
              <h2 style={{...S.cardTitle, display: 'flex', alignItems: 'center', gap: '8px'}}><Key size={20} /> Admin Credentials</h2>
              <p style={S.cardDesc}>Set the login email and password for this restaurant's Admin Portal.</p>
              
              <form onSubmit={handleSaveAdmin} style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={S.label}>Admin Email</label>
                  <input 
                    type="email" 
                    value={adminEmail} 
                    onChange={e => setAdminEmail(e.target.value)}
                    placeholder="admin@restaurant.com" 
                    style={S.input}
                    required
                  />
                </div>
                <div>
                  <label style={S.label}>New Password (leave blank to keep current)</label>
                  <input 
                    type="password" 
                    value={adminPassword} 
                    onChange={e => setAdminPassword(e.target.value)}
                    placeholder="••••••••" 
                    style={S.input}
                  />
                </div>
                <button type="submit" style={{ ...S.primaryLinkBtn, border: 'none', cursor: 'pointer', textAlign: 'center' }} disabled={savingAdmin}>
                  {savingAdmin ? 'Saving...' : 'Save Credentials'}
                </button>
              </form>
            </div>

            {/* Queue Management */}
            <div style={S.card}>
              <h2 style={{...S.cardTitle, display: 'flex', alignItems: 'center', gap: '8px'}}><Ticket size={20} /> Queue Management</h2>
            <p style={S.cardDesc}>Add custom status tags for this restaurant's queue (e.g. VIP_WAITING).</p>
            
            <form id="add-status-form" onSubmit={async (e) => {
              e.preventDefault();
              const input = (e.target as any).statusInput;
              const colorInput = (e.target as any).statusColor;
              const priorityInput = (e.target as any).statusPriority;
              const customStatus = input.value;
              const color = colorInput.value;
              const priority = priorityInput.value;
              if (!customStatus) return;
              
              try {
                const res = await fetch(`/api/super-admin/queue/status`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  ...authHeaders,
                  body: JSON.stringify({ restaurantId: id, statusEnum: customStatus.toUpperCase().replace(/\s+/g, '_'), color, priority: priority ? Number(priority) : 0 })
                });
                const data = await res.json();
                if (data.success) {
                  toast.success(`Status ${customStatus} added!`);
                  input.value = '';
                  priorityInput.value = '';
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
                <input 
                  type="number" 
                  name="statusPriority"
                  placeholder="Priority (e.g. 1)" 
                  style={{ width: '80px', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13px', outline: 'none' }}
                />
                <button type="submit" style={{ padding: '10px 16px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
                  Add Status
                </button>
              </div>
            </form>

            {queueStatuses.length > 0 && (
              <div style={{ marginTop: '16px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {queueStatuses.sort((a, b) => a.priority - b.priority).map((qs) => (
                  <div key={qs.id} style={{ 
                    display: 'flex', alignItems: 'center', gap: '8px', 
                    backgroundColor: '#f1f5f9', padding: '6px 12px', 
                    borderRadius: '16px', fontSize: '12px', fontWeight: 600, color: '#334155',
                    border: `1px solid ${qs.color || '#e2e8f0'}`
                  }}>
                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: qs.color || '#cbd5e1' }} />
                    {qs.possible_queue_status} <span style={{ color: '#94a3b8', fontSize: '10px' }}>(P{qs.priority || 0})</span>
                    <button
                      type="button" 
                      onClick={() => {
                        const form = document.getElementById('add-status-form') as HTMLFormElement;
                        if (form) {
                          form.statusInput.value = qs.possible_queue_status;
                          form.statusColor.value = qs.color || '#cbd5e1';
                          form.statusPriority.value = qs.priority || 0;
                          form.statusInput.focus();
                        }
                      }}
                      style={{
                        background: 'none', border: 'none', color: '#64748b', 
                        cursor: 'pointer', fontSize: '12px', padding: '0 4px', display: 'flex', alignItems: 'center', marginLeft: '4px'
                      }}
                      title="Edit status"
                    >
                      <Pencil size={14} />
                    </button>
                    <button 
                      onClick={() => handleDeleteStatus(qs.id)}
                      style={{
                        background: 'none', border: 'none', color: '#ef4444', 
                        cursor: 'pointer', fontSize: '12px', padding: '0 4px', display: 'flex', alignItems: 'center'
                      }}
                      title="Delete status"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            </div> {/* End Queue Management Card */}
          </div> {/* End Left Panel Flex */}

          {/* Right Panel: Modules and Brand Preview */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            


            {/* Subscribed Modules Settings */}
            <div style={S.card}>
              <h2 style={{...S.cardTitle, display: 'flex', alignItems: 'center', gap: '8px'}}><Settings size={20} /> Subscription Modules</h2>
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
                          <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, fontSize: '13px', color: '#0f172a' }}>{mod.icon} {mod.label}</span>
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



            {/* Danger Zone deletion panel */}
            <div style={{ ...S.card, borderColor: '#fecaca', backgroundColor: '#fff5f5' }}>
              <h2 style={{ ...S.cardTitle, color: '#991b1b', display: 'flex', alignItems: 'center', gap: '8px' }}><AlertTriangle size={20} /> Danger Zone</h2>
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

      {/* Custom Confirm Modal */}
      {confirmModal?.isOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }} onClick={() => setConfirmModal(null)}>
          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '24px', width: '100%', maxWidth: '400px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ color: '#0f172a', fontWeight: 800, fontSize: '18px', margin: 0 }}>{confirmModal.title}</h2>
              <button onClick={() => setConfirmModal(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '20px', cursor: 'pointer', padding: '4px 8px' }}><X size={20} /></button>
            </div>
            <p style={{ color: '#475569', fontSize: '14px', lineHeight: '1.5', marginBottom: '24px' }}>
              {confirmModal.message}
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button onClick={() => setConfirmModal(null)} style={{ padding: '8px 16px', background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
              <button onClick={confirmModal.onConfirm} style={{ padding: '8px 16px', background: '#10b981', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>Proceed</button>
            </div>
          </div>
        </div>
      )}
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
