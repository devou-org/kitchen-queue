'use client';
import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { toast, Toaster } from 'react-hot-toast';
import { useRestaurant } from '@/hooks/useRestaurant';
import PhoneInput from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import { Store, Eye, Receipt, MapPin, Navigation, Compass, Loader2, KeyRound, Mail, Lock, ShieldCheck, EyeOff, Save, Printer, ChevronDown, ChevronRight, ChevronsUpDown, UtensilsCrossed, QrCode } from 'lucide-react';
import { AdminContentWrapper } from '@/components/AdminContentWrapper';
import { AdminPageHeader } from '@/components/AdminPageHeader';
import { LayoutMaximizeToggle } from '@/components/LayoutMaximizeToggle';
import { QRCodeGenerator } from '@/components/QRCodeGenerator';

interface CollapsibleCardProps {
  id: string;
  title: string;
  icon: React.ReactNode;
  badge?: React.ReactNode;
  children: React.ReactNode;
  isCollapsed: boolean;
  onToggle: () => void;
  style?: React.CSSProperties;
}

function CollapsibleCard({
  title,
  icon,
  badge,
  children,
  isCollapsed,
  onToggle,
  style,
}: CollapsibleCardProps) {
  return (
    <div
      className="card"
      style={{
        padding: 0,
        overflow: 'hidden',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        backgroundColor: '#FFFFFF',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
        ...style,
      }}
    >
      <div
        onClick={onToggle}
        style={{
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          userSelect: 'none',
          backgroundColor: '#FFFFFF',
          transition: 'background-color 0.15s ease',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#F8FAFC')}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#FFFFFF')}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flexWrap: 'wrap' }}>
          {icon}
          <h2 style={{ fontSize: '15px', fontWeight: 800, color: '#0F172A', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            {title}
          </h2>
          {badge}
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '28px',
            height: '28px',
            borderRadius: '6px',
            color: '#64748B',
            backgroundColor: '#F1F5F9',
            marginLeft: '8px',
            flexShrink: 0,
          }}
        >
          {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
        </div>
      </div>

      {!isCollapsed && (
        <div style={{ padding: '20px', borderTop: '1px solid #E2E8F0' }}>
          {children}
        </div>
      )}
    </div>
  );
}

export default function AdminSettings() {
  const params = useParams();
  const slug = params?.slug as string;
  const { restaurant, loading, refresh } = useRestaurant();
  const [saving, setSaving] = useState(false);

  // Auto-Print State (synced with orders and pos)
  const [autoPrintKot, setAutoPrintKot] = useState(true);

  // Collapsible Sections State
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedAutoPrint = localStorage.getItem('qdine_auto_print_kot');
      if (savedAutoPrint !== null) {
        setAutoPrintKot(savedAutoPrint !== 'false');
      }
    }
  }, []);

  const handleToggleAutoPrint = () => {
    const nextVal = !autoPrintKot;
    setAutoPrintKot(nextVal);
    if (typeof window !== 'undefined') {
      localStorage.setItem('qdine_auto_print_kot', String(nextVal));
    }
    toast.success(nextVal ? '🖨️ Auto-Print KOT: Enabled' : '⏸️ Auto-Print KOT: Paused');
  };

  const toggleSection = (key: string) => {
    setCollapsedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const SECTION_KEYS = ['profile', 'menu', 'hours', 'autoprint', 'gst', 'preview', 'qrcode'];
  const allCollapsed = SECTION_KEYS.every((k) => !!collapsedSections[k]);

  const toggleAllSections = () => {
    const nextState = !allCollapsed;
    const updated: Record<string, boolean> = {};
    SECTION_KEYS.forEach((k) => {
      updated[k] = nextState;
    });
    setCollapsedSections(updated);
  };

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

  // Admin Security & Credentials State
  const [adminEmail, setAdminEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [savingCredentials, setSavingCredentials] = useState(false);

  // Geo-location & AI Context State
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [country, setCountry] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [detectingLoc, setDetectingLoc] = useState(false);
  const [hasPromptedGeo, setHasPromptedGeo] = useState(false);

  // Business Hours State
  const [timezone, setTimezone] = useState('Asia/Kolkata');
  const [openingTime, setOpeningTime] = useState('09:00:00');
  const [closingTime, setClosingTime] = useState('22:00:00');
  const [rolloverTime, setRolloverTime] = useState('00:00:00');

  const handleDetectLocation = (isAutoPrompt = false) => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      if (!isAutoPrompt) toast.error('Geolocation is not supported by your browser');
      return;
    }

    setDetectingLoc(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setLatitude(lat.toFixed(7));
        setLongitude(lng.toFixed(7));

        try {
          const geoRes = await fetch(
            `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`
          );
          if (geoRes.ok) {
            const geoData = await geoRes.json();
            if (geoData.city || geoData.locality) setCity(geoData.city || geoData.locality);
            if (geoData.principalSubdivision) setState(geoData.principalSubdivision);
            if (geoData.countryName) setCountry(geoData.countryName);
          }
        } catch (err) {
          console.warn('Reverse geocode failed:', err);
        }

        setDetectingLoc(false);
        toast.success(
          isAutoPrompt
            ? '📍 Restaurant location auto-detected! Click Save to update profile.'
            : '📍 Coordinates detected successfully!'
        );
      },
      (error) => {
        setDetectingLoc(false);
        if (!isAutoPrompt) {
          if (error.code === error.PERMISSION_DENIED) {
            toast.error('Location permission was denied by your browser');
          } else {
            toast.error('Unable to retrieve GPS coordinates');
          }
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

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

      // Location fields
      setCity((restaurant as any).city || '');
      setState((restaurant as any).state || '');
      setCountry((restaurant as any).country || '');
      const latVal = (restaurant as any).latitude;
      const lngVal = (restaurant as any).longitude;
      setLatitude(latVal != null ? String(latVal) : '');
      setLongitude(lngVal != null ? String(lngVal) : '');

      // Auto-trigger location permission ONCE if lat & long are null in database
      if ((latVal == null || lngVal == null) && !hasPromptedGeo) {
        setHasPromptedGeo(true);
        handleDetectLocation(true);
      }
    }
  }, [restaurant, hasPromptedGeo]);

  useEffect(() => {
    if (slug) {
      fetch('/api/admin/credentials', {
        headers: { 'x-restaurant-slug': slug as string }
      })
        .then(res => res.json())
        .then(data => {
          if (data.success && data.email) {
            setAdminEmail(data.email);
          }
        })
        .catch(err => console.error('Error fetching admin credentials:', err));
    }
  }, [slug]);

  const handleSaveCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminEmail.trim()) {
      toast.error('Admin Email is required');
      return;
    }
    if (newPassword) {
      if (newPassword.length < 6) {
        toast.error('New password must be at least 6 characters long');
        return;
      }
      if (newPassword !== confirmPassword) {
        toast.error('New password and confirmation do not match');
        return;
      }
    }

    setSavingCredentials(true);
    try {
      const res = await fetch('/api/admin/credentials', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-restaurant-slug': slug as string
        },
        body: JSON.stringify({
          email: adminEmail,
          currentPassword: currentPassword || undefined,
          newPassword: newPassword || undefined
        })
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Admin login credentials updated successfully!');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        toast.error(data.error || 'Failed to update credentials');
      }
    } catch {
      toast.error('Connection error while updating credentials');
    } finally {
      setSavingCredentials(false);
    }
  };

  const handleSaveProfile = async (e?: React.FormEvent) => {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
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
          city: city || null,
          state: state || null,
          country: country || null,
          latitude: latitude !== '' ? Number(latitude) : null,
          longitude: longitude !== '' ? Number(longitude) : null,
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
    <AdminContentWrapper fullWidth style={{ paddingTop: 0, paddingLeft: 0, paddingRight: 0, maxWidth: '100%', paddingBottom: '100px' }}>
      <style>{`
        .settings-page-header {
          height: 68px !important;
          min-height: 68px !important;
          display: flex !important;
          align-items: center !important;
          margin: 0 !important;
          padding: 0 20px !important;
          border-bottom: 1px solid var(--border) !important;
          background: #FFFFFF !important;
          box-sizing: border-box !important;
        }

        .settings-page-header .admin-page-header-container {
          height: 68px !important;
          min-height: 68px !important;
          display: flex !important;
          align-items: center !important;
          margin: 0 !important;
          padding: 0 !important;
          gap: 12px !important;
          width: 100% !important;
        }

        .settings-toolbar {
          display: flex !important;
          flex-wrap: nowrap !important;
          align-items: center !important;
          gap: 10px !important;
          width: 100% !important;
          min-width: 0 !important;
        }

        .settings-actions {
          display: flex !important;
          flex-wrap: nowrap !important;
          align-items: center !important;
          gap: 8px !important;
          margin-left: auto !important;
          flex-shrink: 0 !important;
        }

        @media (max-width: 768px) {
          .settings-page-header {
            height: auto !important;
            min-height: auto !important;
            padding: 12px 16px !important;
          }

          .settings-toolbar {
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 10px !important;
          }

          .settings-actions {
            width: 100% !important;
            margin-left: 0 !important;
            justify-content: space-between !important;
            flex-wrap: wrap !important;
          }
        }
      `}</style>
      <AdminPageHeader
        className="settings-page-header"
        style={{ paddingTop: 0, minHeight: '68px', display: 'flex', alignItems: 'center', marginBottom: 0 }}
        hideMaximize={true}
        search={
          <div className="settings-toolbar">
            {/* Right: Expand/Collapse All, Save Button & Maximize Toggle */}
            <div className="settings-actions">
              <button
                type="button"
                onClick={toggleAllSections}
                style={{
                  height: '38px',
                  padding: '0 12px',
                  borderRadius: '8px',
                  background: '#F8FAFC',
                  color: '#475569',
                  border: '1px solid #E2E8F0',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s ease',
                }}
              >
                <ChevronsUpDown size={14} />
                <span>{allCollapsed ? 'Expand All' : 'Collapse All'}</span>
              </button>

              <button
                type="button"
                onClick={() => handleSaveProfile()}
                disabled={saving}
                style={{
                  height: '38px',
                  padding: '0 16px',
                  borderRadius: '8px',
                  background: 'var(--primary, #971345)',
                  color: '#FFFFFF',
                  fontSize: '12px',
                  fontWeight: 700,
                  border: 'none',
                  cursor: saving ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.08)',
                  whiteSpace: 'nowrap',
                  opacity: saving ? 0.7 : 1,
                  transition: 'all 0.15s ease',
                }}
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                <span>{saving ? 'Saving...' : 'Save Settings'}</span>
              </button>

              {/* Left Border Separator */}
              <div style={{ borderLeft: '1px solid #E2E8F0', paddingLeft: '8px', display: 'flex', alignItems: 'center', height: '32px' }}>
                <LayoutMaximizeToggle />
              </div>
            </div>
          </div>
        }
      />

      <div style={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box', margin: 0, padding: '24px 20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px', alignItems: 'start' }}>
          
          {/* Left Column: Profile, Menu, Hours */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* 1. Profile & Contact Card */}
            <CollapsibleCard
              id="profile"
              title="Profile & Contact"
              icon={<Store size={18} style={{ color: 'var(--primary, #971345)' }} />}
              isCollapsed={!!collapsedSections['profile']}
              onToggle={() => toggleSection('profile')}
            >
              <p style={{ ...S.cardDesc, marginBottom: '16px' }}>Configure restaurant name, logo, phone number, and physical address.</p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
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
              </div>
            </CollapsibleCard>

            {/* 2. Digital Menu & Presentation Card */}
            <CollapsibleCard
              id="menu"
              title="Digital Menu & Presentation"
              icon={<UtensilsCrossed size={18} style={{ color: 'var(--primary, #971345)' }} />}
              isCollapsed={!!collapsedSections['menu']}
              onToggle={() => toggleSection('menu')}
            >
              <p style={{ ...S.cardDesc, marginBottom: '16px' }}>Configure customer-facing header text, layout style, and brand colors.</p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
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
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                    <button
                      type="button" onClick={() => setMenuLayout('LIST')}
                      style={{
                        padding: '12px', borderRadius: '8px',
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
                        padding: '12px', borderRadius: '8px',
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
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', padding: '16px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div>
                    <label style={S.label}>Primary Brand Color</label>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '6px' }}>
                      <input type="color" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} style={S.colorSwatch} />
                      <input type="text" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} maxLength={7} style={S.colorInput} placeholder="#971345" />
                    </div>
                  </div>

                  <div>
                    <label style={S.label}>Secondary / Background Color</label>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '6px' }}>
                      <input type="color" value={secondaryColor} onChange={e => setSecondaryColor(e.target.value)} style={S.colorSwatch} />
                      <input type="text" value={secondaryColor} onChange={e => setSecondaryColor(e.target.value)} maxLength={7} style={S.colorInput} placeholder="#EC7951" />
                    </div>
                  </div>
                </div>
              </div>
            </CollapsibleCard>

            {/* 3. Location & Operating Hours Card */}
            <CollapsibleCard
              id="hours"
              title="Location & Operating Hours"
              icon={<Compass size={18} style={{ color: 'var(--primary, #971345)' }} />}
              isCollapsed={!!collapsedSections['hours']}
              onToggle={() => toggleSection('hours')}
            >
              <p style={{ ...S.cardDesc, marginBottom: '16px' }}>Configure GPS coordinates for AI business intelligence and operational store hours.</p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Geo-Location & AI Business Context */}
                <div style={{ padding: '16px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                    <div>
                      <label style={{ ...S.label, margin: 0, display: 'flex', alignItems: 'center', gap: '6px', color: '#0f172a' }}>
                        <MapPin size={15} color={primaryColor || '#10b981'} /> Geo-Location & AI Context
                      </label>
                      <p style={{ fontSize: '11px', color: '#64748b', margin: '2px 0 0 0' }}>
                        Used for weather intelligence and local business insights.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDetectLocation(false)}
                      disabled={detectingLoc}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '6px',
                        backgroundColor: primaryColor || '#10b981',
                        color: '#ffffff',
                        border: 'none',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.08)'
                      }}
                    >
                      {detectingLoc ? <Loader2 size={13} className="animate-spin" /> : <Navigation size={13} />}
                      {detectingLoc ? 'Detecting...' : 'Detect GPS Location'}
                    </button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px' }}>
                    <div>
                      <label style={S.label}>Latitude °</label>
                      <input
                        type="number" step="any" value={latitude} onChange={e => setLatitude(e.target.value)}
                        placeholder="e.g. 11.7750435" style={{ ...S.input, backgroundColor: '#ffffff' }}
                      />
                    </div>
                    <div>
                      <label style={S.label}>Longitude °</label>
                      <input
                        type="number" step="any" value={longitude} onChange={e => setLongitude(e.target.value)}
                        placeholder="e.g. 75.4968640" style={{ ...S.input, backgroundColor: '#ffffff' }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '8px' }}>
                    <div>
                      <label style={S.label}>City</label>
                      <input
                        type="text" value={city} onChange={e => setCity(e.target.value)}
                        placeholder="City" style={{ ...S.input, backgroundColor: '#ffffff' }}
                      />
                    </div>
                    <div>
                      <label style={S.label}>State</label>
                      <input
                        type="text" value={state} onChange={e => setState(e.target.value)}
                        placeholder="State" style={{ ...S.input, backgroundColor: '#ffffff' }}
                      />
                    </div>
                    <div>
                      <label style={S.label}>Country</label>
                      <input
                        type="text" value={country} onChange={e => setCountry(e.target.value)}
                        placeholder="Country" style={{ ...S.input, backgroundColor: '#ffffff' }}
                      />
                    </div>
                  </div>

                  <div style={{ fontSize: '11px', color: latitude && longitude ? '#15803d' : '#b45309', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: latitude && longitude ? '#22c55e' : '#f59e0b', display: 'inline-block' }} />
                    {latitude && longitude
                      ? `Coordinates Saved: ${latitude}, ${longitude}`
                      : 'Coordinates missing: AI weather intelligence will default to city location.'}
                  </div>
                </div>

                {/* Operating Hours & Timezone */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px', padding: '16px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
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

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '16px' }}>
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
                      Orders placed before this time count towards the previous day's sales (useful if open past midnight). Default is 00:00.
                    </p>
                    <input type="time" value={rolloverTime} onChange={e => setRolloverTime(e.target.value)} style={S.input} />
                  </div>
                </div>
              </div>
            </CollapsibleCard>

          </div>

          {/* Right Column: Auto-Print, GST, Live Preview, QR Code */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {/* 4. Auto-Print & Hardware Card */}
            <CollapsibleCard
              id="autoprint"
              title="Auto-Print & Hardware"
              icon={<Printer size={18} style={{ color: 'var(--primary, #971345)' }} />}
              badge={
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '12px',
                    backgroundColor: autoPrintKot ? '#ECFDF5' : '#F1F5F9',
                    color: autoPrintKot ? '#047857' : '#64748B',
                    border: autoPrintKot ? '1px solid #A7F3D0' : '1px solid #CBD5E1',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                  }}
                >
                  <span
                    style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      backgroundColor: autoPrintKot ? '#10B981' : '#94A3B8',
                    }}
                  />
                  {autoPrintKot ? 'AUTO-PRINT ON' : 'AUTO-PRINT OFF'}
                </span>
              }
              isCollapsed={!!collapsedSections['autoprint']}
              onToggle={() => toggleSection('autoprint')}
            >
              <p style={{ ...S.cardDesc, marginBottom: '16px' }}>Configure automatic printing for kitchen order tickets (KOT) and thermal printer behavior.</p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {/* Toggle Control Row */}
                <div
                  onClick={handleToggleAutoPrint}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '16px',
                    backgroundColor: '#F8FAFC',
                    borderRadius: '10px',
                    border: '1px solid #E2E8F0',
                    cursor: 'pointer',
                    userSelect: 'none',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1, paddingRight: '12px' }}>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>
                      Kitchen Order Ticket (KOT) Auto-Print
                    </div>
                    <p style={{ fontSize: '12px', color: '#64748B', margin: '4px 0 0 0', lineHeight: 1.4 }}>
                      Automatically trigger receipt printing when customers place QR orders or staff submit POS tickets.
                    </p>
                  </div>

                  <div
                    role="switch"
                    aria-checked={autoPrintKot}
                    style={{
                      width: '50px',
                      height: '28px',
                      borderRadius: '14px',
                      backgroundColor: autoPrintKot ? 'var(--primary, #971345)' : '#CBD5E1',
                      position: 'relative',
                      transition: 'background-color 0.2s ease',
                      flexShrink: 0,
                    }}
                  >
                    <div
                      style={{
                        width: '22px',
                        height: '22px',
                        borderRadius: '50%',
                        backgroundColor: '#FFFFFF',
                        position: 'absolute',
                        top: '3px',
                        left: autoPrintKot ? '25px' : '3px',
                        transition: 'left 0.2s ease',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
                      }}
                    />
                  </div>
                </div>

                {/* Status Explanation Card */}
                <div
                  style={{
                    padding: '12px 14px',
                    borderRadius: '8px',
                    backgroundColor: autoPrintKot ? '#F0FDF4' : '#F8FAFC',
                    border: `1px solid ${autoPrintKot ? '#BBF7D0' : '#E2E8F0'}`,
                    fontSize: '12px',
                    color: autoPrintKot ? '#166534' : '#475569',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px',
                    lineHeight: 1.5,
                  }}
                >
                  <Printer size={16} style={{ color: autoPrintKot ? '#16A34A' : '#94A3B8', marginTop: '2px', flexShrink: 0 }} />
                  <div>
                    <span style={{ fontWeight: 700 }}>
                      {autoPrintKot ? 'Auto-Printing is currently active' : 'Auto-Printing is paused'}
                    </span>
                    <p style={{ margin: '2px 0 0 0', fontSize: '11px', opacity: 0.9 }}>
                      {autoPrintKot
                        ? 'All new incoming orders in Orders and POS will immediately trigger printing to your connected thermal printer.'
                        : 'New orders will update quietly in the kitchen queue without opening print jobs. Staff can still click print manually.'}
                    </p>
                  </div>
                </div>

                <p style={{ fontSize: '11px', color: '#94A3B8', margin: 0 }}>
                  Compatible with 58mm & 80mm Bluetooth ESC/POS printers, USB thermal hardware, and browser print dialogs.
                </p>
              </div>
            </CollapsibleCard>

            {/* 5. GST Information Card (Read-Only) */}
            <CollapsibleCard
              id="gst"
              title="GST Information"
              icon={<Receipt size={18} style={{ color: 'var(--primary, #971345)' }} />}
              badge={
                <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '12px', backgroundColor: '#F1F5F9', color: '#64748B' }}>
                  Read-Only
                </span>
              }
              isCollapsed={!!collapsedSections['gst']}
              onToggle={() => toggleSection('gst')}
            >
              <p style={{ ...S.cardDesc, marginBottom: '16px' }}>Read-only tax configuration managed by the Super Admin platform.</p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '12px' }}>
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

                <div>
                  <label style={S.label}>GST Rate (%)</label>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a', padding: '10px 12px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #cbd5e1', cursor: 'default' }}>
                    {restaurant?.gst_type !== 'NONE' ? `${(restaurant as any)?.gst_rate || 5}%` : '0%'}
                  </div>
                </div>
              </div>
            </CollapsibleCard>

            {/* 6. Brand Live Preview */}
            <CollapsibleCard
              id="preview"
              title="Brand Live Preview"
              icon={<Eye size={18} style={{ color: 'var(--primary, #971345)' }} />}
              isCollapsed={!!collapsedSections['preview']}
              onToggle={() => toggleSection('preview')}
            >
              <p style={{ ...S.cardDesc, marginBottom: '16px' }}>Real-time visual rendering of how customers see your digital menu header.</p>

              <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden', backgroundColor: '#ffffff', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
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
            </CollapsibleCard>

            {/* 7. Menu QR Code Card */}
            {typeof window !== 'undefined' && slug && (
              <CollapsibleCard
                id="qrcode"
                title="Menu QR Code"
                icon={<QrCode size={18} style={{ color: 'var(--primary, #971345)' }} />}
                isCollapsed={!!collapsedSections['qrcode']}
                onToggle={() => toggleSection('qrcode')}
              >
                <QRCodeGenerator
                  hideCardWrapper={true}
                  url={`${process.env.NEXT_PUBLIC_URL || window.location.origin}/${slug}/menu`}
                  title="Menu QR Code"
                  description="Download and print this QR code to allow customers to easily access your digital menu."
                  primaryColor={primaryColor}
                />
              </CollapsibleCard>
            )}

          </div>
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
