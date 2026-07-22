'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

export const ServiceToggle = ({ variant = 'default' }: { variant?: 'default' | 'light' }) => {
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
          setMessage(data.serviceMessage || '');
          if (data.isOperatingHours !== undefined) {
            setIsOperatingHours(data.isOperatingHours);
          }
        }
      })
      .catch(() => {});
  }, [slug]);

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

  return (
    <div style={{ marginBottom: variant === 'light' ? 0 : '16px', marginTop: variant === 'light' ? 0 : '-4px' }}>
      <div className="status-toggle-wrapper" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div className="status-toggle-label" style={{ display: variant === 'light' ? 'none' : 'flex', flexWrap: 'wrap' }}>
          <span className="status-label-primary">Service Status</span>
          <span className="status-label-secondary" style={{ color: isActive ? 'var(--success)' : '#ef4444' }}>
            {isActive ? 'Online' : 'Offline'}
          </span>
          {!isOperatingHours && (
            <span style={{ width: '100%', fontSize: '10px', color: '#ef4444', marginTop: '2px', fontWeight: 500 }}>
              (Outside operating hours)
            </span>
          )}
        </div>
        <label className="switch" style={{ opacity: isOperatingHours ? 1 : 0.5, cursor: isOperatingHours ? 'pointer' : 'not-allowed' }}>
          <input type="checkbox" checked={isActive} onChange={(e) => updateService(e.target.checked)} disabled={toggling || !isOperatingHours} />
          <span className="slider"></span>
        </label>
      </div>
      
      {!isActive && variant !== 'light' && (
        <div className="animate-fade-in" style={{ padding: '0 4px', marginTop: '12px' }}>
          <label style={{ fontSize: '10px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px', display: 'block', fontWeight: 600 }}>
            Offline Reason / Message
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <input 
              type="text" 
              value={message} 
              onChange={(e) => setMessage(e.target.value)}
              placeholder="e.g. Kitchen Break"
              style={{
                width: '100%',
                background: 'white',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                padding: '10px 12px',
                color: 'var(--text-primary)',
                fontSize: '13px'
              }}
            />
            <button 
              onClick={() => updateService(false, message)}
              disabled={toggling}
              style={{
                background: toggling ? '#E5E7EB' : 'var(--primary)',
                border: 'none',
                borderRadius: '8px',
                padding: '8px',
                color: toggling ? 'var(--text-secondary)' : 'white',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.2s',
                textAlign: 'center'
              }}
            >
              {toggling ? 'Saving...' : showSaved ? '✅ Saved!' : 'Update Message'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
