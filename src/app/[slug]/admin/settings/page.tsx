'use client';
import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { toast, Toaster } from 'react-hot-toast';
import { useRestaurant } from '@/hooks/useRestaurant';
import PhoneInput from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import { Store, Eye, Receipt } from 'lucide-react';
import { AdminContentWrapper } from '@/components/AdminContentWrapper';
import { AdminPageHeader } from '@/components/AdminPageHeader';
import { QRCodeGenerator } from '@/components/QRCodeGenerator';

export default function AdminSettings() {
  const params = useParams();
  const slug = params?.slug as string;
  const { restaurant, loading, refresh } = useRestaurant();
  const [saving, setSaving] = useState(false);

  // Form Fields State
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [addressStreet, setAddressStreet] = useState('');
  const [addressCity, setAddressCity] = useState('');
  const [addressState, setAddressState] = useState('');
  const [addressZip, setAddressZip] = useState('');
  const [addressCountry, setAddressCountry] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#971345');
  const [secondaryColor, setSecondaryColor] = useState('#EC7951');
  const [menuLayout, setMenuLayout] = useState<'LIST' | 'GRID'>('LIST');
  const [menuTitle, setMenuTitle] = useState("Today's Specials");
  const [menuDescription, setMenuDescription] = useState("Hand-curated coastal delicacies prepared with traditional recipes.");

  // Business Hours State
  const [timezone, setTimezone] = useState('Asia/Kolkata');
  const [openingTime, setOpeningTime] = useState('09:00:00');
  const [closingTime, setClosingTime] = useState('22:00:00');
  const [rolloverTime, setRolloverTime] = useState('00:00:00');
  
  



  useEffect(() => {
    if (restaurant) {
      setName(restaurant.name || '');
      setPhone(restaurant.phone || '');
      const parts = (restaurant.address || '').split(',').map((s: string) => s.trim());
      setAddressStreet(parts[0] || '');
      setAddressCity(parts[1] || '');
      setAddressState(parts[2] || '');
      setAddressZip(parts[3] || '');
      setAddressCountry(parts.slice(4).join(', ') || '');
      setLogoUrl(restaurant.logo_url || '');
      setPrimaryColor(restaurant.primary_color || '#971345');
      setSecondaryColor(restaurant.secondary_color || '#EC7951');
      setMenuLayout((restaurant as any).menu_layout || 'LIST');
      setMenuTitle(restaurant.menu_title || "Today's Specials");
      setMenuDescription(restaurant.menu_description || "Hand-curated coastal delicacies prepared with traditional recipes.");
      setTimezone(restaurant.timezone || 'Asia/Kolkata');
      setOpeningTime(restaurant.opening_time || '09:00:00');
      setClosingTime(restaurant.closing_time || '22:00:00');
      setRolloverTime(restaurant.rollover_time || '00:00:00');

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
          address: [addressStreet, addressCity, addressState, addressZip, addressCountry].filter(Boolean).join(', ') || null,
          logo_url: logoUrl || null,
          primary_color: primaryColor,
          secondary_color: secondaryColor,
          menu_layout: menuLayout,
          menu_title: menuTitle || null,
          menu_description: menuDescription || null,
          timezone,
          opening_time: openingTime,
          closing_time: closingTime,
          rollover_time: rolloverTime,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Settings updated successfully!');
        if (refresh) await refresh();
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
    <AdminContentWrapper style={{ paddingBottom: '100px' }}>
      <AdminPageHeader
        title="Settings & Branding"
        description="Manage your restaurant profile, business hours, and visual theme."
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', alignItems: 'start' }}>
        {/* Left Panel: Profile Configurations */}
        <div className="card">
          <h2 style={S.cardTitle}>
            <Store size={18} style={{ display: 'inline', verticalAlign: 'text-bottom', marginRight: '6px' }} />
            Profile & Branding
          </h2>
          <p style={S.cardDesc}>Configure logo URL, phone number, physical address, and theme colors.</p>

          <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
            <div>
              <label style={S.label}>Restaurant Name *</label>
              <input
                type="text" required value={name} onChange={e => setName(e.target.value)}
                style={S.input} placeholder="e.g. Renjz Kitchen"
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
              <div>
                <label style={S.label}>Phone Number</label>
                <PhoneInput
                  international
                  countryCallingCodeEditable={false}
                  placeholder="Enter phone number"
                  value={phone as any}
                  onChange={val => setPhone(val ? String(val) : '')}
                  defaultCountry="IN"
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
                <label style={S.label}>Logo URL</label>
                <input
                  type="url" value={logoUrl} onChange={e => setLogoUrl(e.target.value)}
                  style={S.input} placeholder="https://..."
                />
              </div>
            </div>

            <div>
              <label style={S.label}>Address</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <input type="text" value={addressStreet} onChange={e => setAddressStreet(e.target.value)} placeholder="Street Address" style={S.input} />
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '8px' }}>
                  <input type="text" value={addressCity} onChange={e => setAddressCity(e.target.value)} placeholder="City" style={S.input} />
                  <input type="text" value={addressState} onChange={e => setAddressState(e.target.value)} placeholder="State / Province" style={S.input} />
                </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '8px' }}>
                  <input type="text" value={addressZip} onChange={e => setAddressZip(e.target.value)} placeholder="ZIP / Postal Code" style={S.input} />
                  <input type="text" value={addressCountry} onChange={e => setAddressCountry(e.target.value)} placeholder="Country" style={S.input} />
                </div>
              </div>
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
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
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

            {/* Business Hours Configuration */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px', padding: '16px', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              <div>
                <label style={S.label}>Timezone</label>
                <select
                  value={timezone}
                  onChange={e => setTimezone(e.target.value)}
                  style={{ ...S.input, appearance: 'auto', backgroundColor: '#ffffff' }}
                >
                  <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                  <option value="America/New_York">America/New_York (EST/EDT)</option>
                  <option value="America/Chicago">America/Chicago (CST/CDT)</option>
                  <option value="America/Denver">America/Denver (MST/MDT)</option>
                  <option value="America/Los_Angeles">America/Los_Angeles (PST/PDT)</option>
                  <option value="Europe/London">Europe/London (GMT/BST)</option>
                  <option value="Europe/Paris">Europe/Paris (CET/CEST)</option>
                  <option value="Australia/Sydney">Australia/Sydney (AEST/AEDT)</option>
                  <option value="Asia/Dubai">Asia/Dubai (GST)</option>
                  <option value="Asia/Singapore">Asia/Singapore (SGT)</option>
                  <option value="Asia/Tokyo">Asia/Tokyo (JST)</option>
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px' }}>
                <div>
                  <label style={S.label}>Opening Time</label>
                  <input type="time" value={openingTime} onChange={e => setOpeningTime(e.target.value)} style={S.input} />
                </div>
                <div>
                  <label style={S.label}>Closing Time</label>
                  <input type="time" value={closingTime} onChange={e => setClosingTime(e.target.value)} style={S.input} />
                </div>
              </div>

              <div>
                <label style={S.label}>Rollover Time (Business Day End)</label>
                <p style={{ fontSize: '11px', color: '#64748b', marginTop: '-4px', marginBottom: '8px' }}>
                  Orders placed before this time will count towards the previous day's sales (useful if open past midnight). Default is 00:00.
                </p>
                <input type="time" value={rolloverTime} onChange={e => setRolloverTime(e.target.value)} style={S.input} />
              </div>
            </div>

            {/* Theme Colors Configuration */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', padding: '16px', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              <div>
                <label style={S.label}>Primary Color</label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '6px' }}>
                  <input type="color" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} style={S.colorSwatch} />
                  <input type="text" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} maxLength={7} style={S.colorInput} placeholder="#971345" />
                </div>
              </div>

              <div>
                <label style={S.label}>Background Color</label>
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

        {/* Right Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* GST Information Card (Read-Only) */}
          <div className="card">
            <h2 style={S.cardTitle}>
              <Receipt size={18} style={{ display: 'inline', verticalAlign: 'text-bottom', marginRight: '6px' }} />
              GST Information
            </h2>
            <p style={S.cardDesc}>Read-only tax configuration configured by Super Admin.</p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginTop: '16px' }}>
              <div>
                <label style={S.label}>GST Type</label>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', padding: '10px 12px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #cbd5e1', cursor: 'default' }}>
                  {restaurant?.gst_type || 'NONE'}
                </div>
              </div>

              <div>
                <label style={S.label}>GSTIN</label>
                <div style={{ fontSize: '14px', fontWeight: 600, color: restaurant?.gst_number ? '#0f172a' : '#94a3b8', padding: '10px 12px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #cbd5e1', cursor: 'default' }}>
                  {restaurant?.gst_number || 'Not Configured'}
                </div>
              </div>
            </div>
          </div>
          {/* Dynamic Customer Branding Live Preview */}
          <div className="card">
            <h2 style={S.cardTitle}>
              <Eye size={18} style={{ display: 'inline', verticalAlign: 'text-bottom', marginRight: '6px' }} />
              Brand Live Preview
            </h2>
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
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '8px' }}>
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

          {/* Dynamic QR Code Section */}
          {typeof window !== 'undefined' && slug && (
            <QRCodeGenerator
              url={`${process.env.NEXT_PUBLIC_URL || window.location.origin}/${slug}/menu`}
              title="Menu QR Code"
              description="Download and print this QR code to allow customers to easily access your digital menu."
              primaryColor={primaryColor}
            />
          )}

        </div>
      </div>
    </AdminContentWrapper>
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
