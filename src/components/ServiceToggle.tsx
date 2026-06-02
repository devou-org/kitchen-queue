'use client';
import { useEffect, useState } from 'react';

export const ServiceToggle = ({ variant = 'dark' }: { variant?: 'dark' | 'light' }) => {
  const isLight = variant === 'light';
  const [isActive, setIsActive] = useState(true);
  const [message, setMessage] = useState('');
  const [toggling, setToggling] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const [showPopup, setShowPopup] = useState(false);

  useEffect(() => {
    fetch('/api/admin/settings')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setIsActive(data.isServiceActive);
          setMessage(data.serviceMessage || '');
        }
      });
  }, []);

  const updateService = async (newActive: boolean, newMessage?: string) => {
    if (!newActive && newMessage === undefined) {
      setShowPopup(true);
    }
    setToggling(true);
    setShowSaved(false);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: newActive, message: newMessage ?? message })
      });
      const data = await res.json();
      if (data.success) {
        setIsActive(newActive);
        if (newMessage !== undefined) {
          setMessage(newMessage);
          setShowSaved(true);
          setTimeout(() => {
            setShowSaved(false);
            if (isLight) setShowPopup(false);
          }, 1000);
        } else if (newActive) {
          setShowPopup(false);
        }
      }
    } catch {
      // Fallback
    } finally {
      setToggling(false);
    }
  };

  return (
    <div style={isLight ? { position: 'relative', display: 'flex', alignItems: 'center' } : { marginBottom: '16px', marginTop: '-4px' }}>
      <div className="status-toggle-wrapper" style={isLight ? { 
        marginBottom: 0, 
        background: 'white', 
        borderRadius: '8px', 
        padding: '6px 12px', 
        border: '1px solid var(--border)', 
        width: 'auto',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        height: '36px'
      } : { marginBottom: '12px' }}>
        <div 
          className="status-toggle-label" 
          style={isLight ? { display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap', cursor: !isActive ? 'pointer' : 'default' } : undefined}
          onClick={() => { if (!isActive && isLight) setShowPopup(!showPopup); }}
        >
          <span className="status-label-primary" style={isLight ? { fontSize: '12px', color: 'var(--text-primary)', fontWeight: 600 } : undefined}>Service</span>
          <span className="status-label-secondary" style={{ 
            color: isActive ? 'var(--success)' : '#ef4444',
            fontSize: isLight ? '11px' : undefined,
            fontWeight: isLight ? 700 : undefined
          }}>
            {isActive ? 'ON' : 'OFF'}
          </span>
        </div>
        <label className="switch" style={isLight ? { transform: 'scale(0.8)', transformOrigin: 'right center', margin: 0 } : undefined}>
          <input type="checkbox" checked={isActive} onChange={(e) => updateService(e.target.checked)} disabled={toggling} />
          <span className="slider"></span>
        </label>
      </div>
      
      {(!isActive && (!isLight || showPopup)) && (
        <div className="animate-fade-in" style={isLight ? { 
          position: 'absolute', 
          top: 'calc(100% + 8px)', 
          right: 0, 
          width: '260px', 
          background: 'white', 
          zIndex: 100, 
          border: '1px solid var(--border)', 
          borderRadius: '8px', 
          padding: '16px', 
          boxShadow: 'var(--shadow-md)' 
        } : { padding: '0 4px' }}>
          <label style={{ 
            fontSize: '10px', 
            color: isLight ? 'var(--text-secondary)' : 'rgba(255,255,255,0.4)', 
            textTransform: 'uppercase', 
            letterSpacing: '0.05em', 
            marginBottom: '6px', 
            display: 'block',
            fontWeight: isLight ? 700 : 400
          }}>
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
                background: isLight ? 'white' : 'rgba(255,255,255,0.05)',
                border: isLight ? '1px solid var(--border)' : '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px',
                padding: '10px 12px',
                color: isLight ? 'var(--text-primary)' : 'white',
                fontSize: '13px',
                outline: 'none'
              }}
            />
            <div style={{ display: 'flex', gap: '8px' }}>
              {isLight && (
                <button 
                  onClick={() => setShowPopup(false)}
                  style={{
                    background: 'transparent',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    color: 'var(--text-secondary)',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Close
                </button>
              )}
              <button 
                onClick={() => updateService(false, message)}
                disabled={toggling}
                style={{
                  flex: 1,
                  background: toggling ? (isLight ? 'var(--border)' : 'rgba(255,255,255,0.1)') : 'var(--primary)',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '8px',
                  color: toggling && isLight ? 'var(--text-secondary)' : 'white',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  textAlign: 'center'
                }}
              >
                {toggling ? 'Saving...' : showSaved ? '✅ Saved!' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
