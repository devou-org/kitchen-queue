'use client';
import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { toast, Toaster } from 'react-hot-toast';
import { useRestaurant } from '@/hooks/useRestaurant';

export default function AdminSettings() {
  const params = useParams();
  const slug = params?.slug as string;
  const { restaurant, loading } = useRestaurant();
  const [saving, setSaving] = useState(false);

  // Form Fields State
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#971345');
  const [secondaryColor, setSecondaryColor] = useState('#EC7951');
  const [menuLayout, setMenuLayout] = useState<'LIST' | 'GRID'>('LIST');
  const [menuTitle, setMenuTitle] = useState("Today's Specials");
  const [menuDescription, setMenuDescription] = useState("Hand-curated coastal delicacies prepared with traditional recipes.");

  useEffect(() => {
    if (restaurant) {
      setName(restaurant.name || '');
      setPhone(restaurant.phone || '');
      setAddress(restaurant.address || '');
      setLogoUrl(restaurant.logo_url || '');
      setPrimaryColor(restaurant.primary_color || '#971345');
      setSecondaryColor(restaurant.secondary_color || '#EC7951');
      setMenuLayout((restaurant as any).menu_layout || 'LIST');
      setMenuTitle(restaurant.menu_title || "Today's Specials");
      setMenuDescription(restaurant.menu_description || "Hand-curated coastal delicacies prepared with traditional recipes.");
    }
  }, [restaurant]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Name is required');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/settings`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'x-restaurant-slug': slug
        },
        body: JSON.stringify({
          name,
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
        toast.success('Settings updated successfully! Refresh to see changes.');
      } else {
        toast.error(data.error || 'Failed to update settings');
      }
    } catch {
      toast.error('Connection error while updating settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return null;

  return (
    <div style={{ padding: '24px', maxWidth: '1080px', margin: '0 auto', paddingBottom: '100px' }}>
      <Toaster position="top-right" />
      <h1 style={{ fontSize: '24px', fontWeight: 800, marginBottom: '24px' }}>Settings & Branding</h1>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 3fr) minmax(300px, 2fr)', gap: '20px', alignItems: 'start' }}>
        {/* Left Panel: Profile Configurations */}
        <div className="card">
          <h2 style={S.cardTitle}>✏️ Profile & Branding</h2>
          <p style={S.cardDesc}>Configure logo URL, phone number, physical address, and theme colors.</p>
          
          <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
            <div>
              <label style={S.label}>Restaurant Name *</label>
              <input
                type="text" required value={name} onChange={e => setName(e.target.value)}
                style={S.input} placeholder="e.g. Renjz Kitchen"
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={S.label}>Phone Number</label>
                <input
                  type="text" value={phone} onChange={e => setPhone(e.target.value)}
                  style={S.input} placeholder="+91 98765 43210"
                />
              </div>
              <div>
                <label style={S.label}>Logo URL</label>
                <input
                  type="url" value={logoUrl} onChange={e => setLogoUrl(e.target.value)}
                  style={S.input} placeholder="https://..."
                />
              </div>
            </div>

            <div>
              <label style={S.label}>Address</label>
              <textarea
                value={address} onChange={e => setAddress(e.target.value)}
                style={{ ...S.input, height: '70px', resize: 'vertical' }}
                placeholder="Street details, City, Pin"
              />
            </div>

            <div>
              <label style={S.label}>Menu Header Title</label>
              <input
                type="text" value={menuTitle} onChange={e => setMenuTitle(e.target.value)}
                style={S.input} placeholder="e.g. Today's Specials"
              />
            </div>

            <div>
              <label style={S.label}>Menu Header Description</label>
              <textarea
                value={menuDescription} onChange={e => setMenuDescription(e.target.value)}
                style={{ ...S.input, height: '70px', resize: 'vertical' }}
                placeholder="e.g. Hand-curated coastal delicacies prepared with traditional recipes."
              />
            </div>

            {/* Menu Layout Switcher */}
            <div>
              <label style={S.label}>Digital Menu Card Layout</label>
              <p style={{ fontSize: '11px', color: '#64748b', marginTop: '-4px', marginBottom: '10px' }}>
                Choose how items are displayed on the customer's mobile menu screen.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <button
                  type="button" onClick={() => setMenuLayout('LIST')}
                  style={{
                    padding: '12px', borderRadius: '10px',
                    border: menuLayout === 'LIST' ? '2px solid #10b981' : '1px solid #cbd5e1',
                    background: menuLayout === 'LIST' ? '#ecfdf5' : '#ffffff',
                    color: menuLayout === 'LIST' ? '#047857' : '#334155',
                    cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', transition: 'all 0.15s ease', boxSizing: 'border-box'
                  }}
                >
                  <span style={{ fontSize: '20px' }}>≡</span>
                  <span style={{ fontWeight: 800, fontSize: '13px' }}>Horizontal List</span>
                </button>

                <button
                  type="button" onClick={() => setMenuLayout('GRID')}
                  style={{
                    padding: '12px', borderRadius: '10px',
                    border: menuLayout === 'GRID' ? '2px solid #10b981' : '1px solid #cbd5e1',
                    background: menuLayout === 'GRID' ? '#ecfdf5' : '#ffffff',
                    color: menuLayout === 'GRID' ? '#047857' : '#334155',
                    cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', transition: 'all 0.15s ease', boxSizing: 'border-box'
                  }}
                >
                  <span style={{ fontSize: '20px' }}>☷</span>
                  <span style={{ fontWeight: 800, fontSize: '13px' }}>2-Column Grid</span>
                </button>
              </div>
            </div>

            {/* Theme Colors Configuration */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', padding: '16px', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              <div>
                <label style={S.label}>Primary Color</label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '6px' }}>
                  <input type="color" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} style={S.colorSwatch} />
                  <input type="text" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} maxLength={7} style={S.colorInput} placeholder="#971345" />
                </div>
              </div>

              <div>
                <label style={S.label}>Secondary Color</label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '6px' }}>
                  <input type="color" value={secondaryColor} onChange={e => setSecondaryColor(e.target.value)} style={S.colorSwatch} />
                  <input type="text" value={secondaryColor} onChange={e => setSecondaryColor(e.target.value)} maxLength={7} style={S.colorInput} placeholder="#EC7951" />
                </div>
              </div>
            </div>

            <button type="submit" disabled={saving} className="btn btn-primary btn-lg" style={{ marginTop: '8px' }}>
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </form>
        </div>

        {/* Right Panel: Brand Preview */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Dynamic Customer Branding Live Preview */}
          <div className="card">
            <h2 style={S.cardTitle}>👁️ Brand Live Preview</h2>
            <p style={S.cardDesc}>Real-time visual rendering of how customers see the menu header.</p>
            
            <div style={{ marginTop: '16px', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden', backgroundColor: '#ffffff', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
              {/* Header Mockup */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 18px', borderBottom: '1px solid #f1f5f9', backgroundColor: '#ffffff' }}>
                {logoUrl ? (
                  <img src={logoUrl} alt="Logo" style={{ width: '34px', height: '34px', borderRadius: '6px', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: '34px', height: '34px', borderRadius: '6px', backgroundColor: primaryColor, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '14px' }}>
                    {name ? name.charAt(0).toUpperCase() : '🌿'}
                  </div>
                )}
                <span style={{ fontWeight: 800, fontSize: '16px', color: '#0f172a' }}>{name || 'Restaurant Name'}</span>
              </div>
              
              {/* Body Banner Mockup */}
              <div style={{ padding: '24px 18px 12px 18px', background: 'linear-gradient(to bottom right, #fdfdfd, #f8fafc)' }}>
                <div style={{ height: '8px', width: '120px', borderRadius: '4px', backgroundColor: primaryColor, marginBottom: '8px' }} />
                <div style={{ height: '6px', width: '220px', borderRadius: '3px', backgroundColor: '#e2e8f0', marginBottom: '16px' }} />
                
                {/* Category Pill Mockup */}
                <div style={{ display: 'flex', gap: '8px' }}>
                  <div style={{ padding: '6px 14px', borderRadius: '30px', backgroundColor: primaryColor, color: 'white', fontSize: '11px', fontWeight: 700 }}>All Specials</div>
                  <div style={{ padding: '6px 14px', borderRadius: '30px', backgroundColor: '#f1f5f9', color: '#64748b', fontSize: '11px', fontWeight: 600 }}>Starters</div>
                </div>
              </div>

              {/* Mockup Item Cards */}
              <div style={{ padding: '0 18px 18px 18px', backgroundColor: '#f8fafc' }}>
                <div style={{ fontSize: '10px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Layout Preview</div>
                {menuLayout === 'GRID' ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    {[1, 2].map(i => (
                      <div key={i} style={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '6px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ height: '50px', backgroundColor: '#f1f5f9', borderRadius: '6px' }} />
                        <div style={{ height: '6px', width: '70%', backgroundColor: '#cbd5e1', borderRadius: '3px' }} />
                        <div style={{ height: '6px', width: '40%', backgroundColor: primaryColor, borderRadius: '3px', marginTop: 'auto' }} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ height: '6px', width: '60%', backgroundColor: '#cbd5e1', borderRadius: '3px' }} />
                        <div style={{ height: '6px', width: '40%', backgroundColor: primaryColor, borderRadius: '3px' }} />
                      </div>
                      <div style={{ width: '28px', height: '28px', backgroundColor: '#f1f5f9', borderRadius: '4px', flexShrink: 0 }} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  cardTitle: { fontSize: '16px', fontWeight: 800, color: '#0f172a', margin: 0 },
  cardDesc: { fontSize: '12px', color: '#64748b', marginTop: '4px', margin: 0 },
  label: { display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px' },
  input: { width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', color: '#0f172a', fontSize: '14px', outline: 'none', transition: 'border-color 0.2s', boxSizing: 'border-box' },
  colorSwatch: { width: '38px', height: '38px', padding: 0, border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', flexShrink: 0 },
  colorInput: { flex: 1, padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', color: '#0f172a', fontSize: '14px', fontFamily: 'monospace' },
};
