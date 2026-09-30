'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

import { Power, CheckCircle2, AlertCircle } from 'lucide-react';

export function checkOperatingHours(
  openTime?: string, 
  closeTime?: string, 
  tz = 'Asia/Kolkata'
): boolean {
  if (!openTime || !closeTime) return true;
  try {
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: tz || 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
    const currentTime = formatter.format(new Date()).slice(0, 5);
    const open = openTime.slice(0, 5);
    const close = closeTime.slice(0, 5);

    if (open === close) return true; // 24 hours
    if (open < close) {
      return currentTime >= open && currentTime < close;
    } else {
      // Midnight crossing: e.g. 18:00 to 02:00
      return currentTime >= open || currentTime < close;
    }
  } catch {
    return true;
  }
}

export interface ServiceToggleProps {
  variant?: 'default' | 'light';
  primaryColor?: string;
  onStatusChange?: (isActive: boolean) => void;
  openingTime?: string;
  closingTime?: string;
  timezone?: string;
  controlledActive?: boolean;
}

export const ServiceToggle = ({ 
  variant = 'default',
  primaryColor,
  onStatusChange,
  openingTime,
  closingTime,
  timezone,
  controlledActive,
}: ServiceToggleProps) => {
  const [isActive, setIsActive] = useState(true);
  const [message, setMessage] = useState('');
  const [toggling, setToggling] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const [isOperatingHours, setIsOperatingHours] = useState(true);
  
  const params = useParams();
  let slug = params?.slug as string;

  // Fallback if inside staff portal
  if (!slug && typeof window !== 'undefined') {
    const staffToken = localStorage.getItem('staff_token');
    if (staffToken) {
      try {
        const payloadPart = staffToken.split('.')[1];
        if (payloadPart) {
          const payload = JSON.parse(atob(payloadPart));
          if (payload.restaurantSlug) {
            slug = payload.restaurantSlug;
          }
        }
      } catch (e) {
        console.error('ServiceToggle slug decode error:', e);
      }
    }
  }

  useEffect(() => {
    if (!slug) return;
    fetch('/api/admin/settings', {
      headers: { 'x-restaurant-slug': slug }
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setIsActive(data.isServiceActive);
          onStatusChange?.(data.isServiceActive);
          setMessage(data.serviceMessage || '');
          if (data.isOperatingHours !== undefined) {
            setIsOperatingHours(data.isOperatingHours);
          }
        }
      })
      .catch(() => {});
  }, [slug]);

  // Synchronize automatically whenever openingTime, closingTime, or timezone changes
  useEffect(() => {
    if (openingTime !== undefined && closingTime !== undefined) {
      const withinHours = checkOperatingHours(openingTime, closingTime, timezone);
      setIsOperatingHours(withinHours);
      if (!withinHours) {
        setIsActive(false);
        onStatusChange?.(false);
      } else {
        if (controlledActive !== undefined) {
          setIsActive(controlledActive);
        } else {
          setIsActive(true);
          onStatusChange?.(true);
        }
      }
    }
  }, [openingTime, closingTime, timezone, controlledActive]);

  useEffect(() => {
    if (controlledActive !== undefined) {
      setIsActive(controlledActive);
    }
  }, [controlledActive]);

  const updateService = async (newActive: boolean, newMessage?: string) => {
    if (!slug) return;
    setToggling(true);
    setShowSaved(false);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-restaurant-slug': slug
        },
        body: JSON.stringify({ active: newActive, message: newMessage ?? message })
      });
      const data = await res.json();
      if (data.success) {
        setIsActive(newActive);
        onStatusChange?.(newActive);
        if (newMessage !== undefined) {
          setMessage(newMessage);
          setShowSaved(true);
          setTimeout(() => setShowSaved(false), 2000);
        }
      }
    } catch {
      // Fallback
    } finally {
      setToggling(false);
    }
  };

  if (!slug) return null;

  const activeColor = primaryColor || 'var(--primary, #059669)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* Toggle Control Row - Matching Auto-Print exactly */}
      <div
        onClick={() => {
          if (!toggling && isOperatingHours) {
            updateService(!isActive);
          }
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px',
          backgroundColor: '#F8FAFC',
          borderRadius: '10px',
          border: '1px solid #E2E8F0',
          cursor: isOperatingHours ? 'pointer' : 'not-allowed',
          userSelect: 'none',
          transition: 'all 0.15s ease',
          opacity: isOperatingHours ? 1 : 0.6,
        }}
      >
        <div style={{ minWidth: 0, flex: 1, paddingRight: '12px' }}>
          <div style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>
            Online Ordering & Service Status
          </div>
          <p style={{ fontSize: '12px', color: '#64748B', margin: '4px 0 0 0', lineHeight: 1.4 }}>
            Accept incoming customer orders from digital menu QR codes and POS terminal. Turn off when taking a kitchen break.
          </p>
          {!isOperatingHours && (
            <span style={{ display: 'inline-block', fontSize: '11px', color: '#EF4444', marginTop: '4px', fontWeight: 600 }}>
              ⚠️ Currently outside scheduled operating hours
            </span>
          )}
        </div>

        {/* Primary Color Matching Switch */}
        <div
          role="switch"
          aria-checked={isActive}
          style={{
            width: '50px',
            height: '28px',
            borderRadius: '14px',
            backgroundColor: isActive ? activeColor : '#CBD5E1',
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
              left: isActive ? '25px' : '3px',
              transition: 'left 0.2s ease',
              boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
            }}
          />
        </div>
      </div>

      {/* Status Explanation Card - Matching Auto-Print */}
      <div
        style={{
          padding: '12px 14px',
          borderRadius: '8px',
          backgroundColor: isActive ? '#F0FDF4' : '#FFFBEB',
          border: `1px solid ${isActive ? '#BBF7D0' : '#FED7AA'}`,
          fontSize: '12px',
          color: isActive ? '#166534' : '#9A3412',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '10px',
          lineHeight: 1.5,
        }}
      >
        <Power size={16} style={{ color: isActive ? '#16A34A' : '#EA580C', marginTop: '2px', flexShrink: 0 }} />
        <div>
          <span style={{ fontWeight: 700 }}>
            {isActive ? 'Online Ordering is currently active' : 'Kitchen service is paused (Offline)'}
          </span>
          <p style={{ margin: '2px 0 0 0', fontSize: '11px', opacity: 0.9 }}>
            {isActive
              ? 'Customers can browse your digital menu and place live orders. Table orders and POS remain fully operational.'
              : message
              ? `Store is showing offline to customers: "${message}". Orders cannot be placed online until enabled.`
              : 'Store is showing offline to customers. Orders cannot be placed online until enabled.'}
          </p>
        </div>
      </div>

      {/* Offline Reason Input when disabled */}
      {!isActive && variant !== 'light' && (
        <div className="animate-fade-in" style={{ padding: '4px 0 0 0' }}>
          <label style={{ fontSize: '11px', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px', display: 'block', fontWeight: 700 }}>
            Offline Reason / Customer Notice
          </label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input 
              type="text" 
              value={message} 
              onChange={(e) => setMessage(e.target.value)}
              placeholder="e.g. Kitchen Break, Reopening at 5:00 PM"
              style={{
                flex: 1,
                background: '#FFFFFF',
                border: '1px solid #CBD5E1',
                borderRadius: '8px',
                padding: '10px 12px',
                color: '#0F172A',
                fontSize: '13px',
                outline: 'none',
              }}
            />
            <button 
              type="button"
              onClick={() => updateService(false, message)}
              disabled={toggling}
              style={{
                background: toggling ? '#E2E8F0' : activeColor,
                border: 'none',
                borderRadius: '8px',
                padding: '0 16px',
                color: toggling ? '#64748B' : '#FFFFFF',
                fontSize: '12px',
                fontWeight: 700,
                cursor: toggling ? 'wait' : 'pointer',
                transition: 'all 0.15s ease',
                whiteSpace: 'nowrap',
              }}
            >
              {toggling ? 'Saving...' : showSaved ? '✅ Saved!' : 'Save Notice'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
