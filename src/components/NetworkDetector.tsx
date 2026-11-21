'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { WifiOff, Wifi, RefreshCw, X, AlertTriangle, Minimize2, Maximize2 } from 'lucide-react';

export function NetworkDetector() {
  const [mounted, setMounted] = useState(false);
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [wasOffline, setWasOffline] = useState<boolean>(false);
  const [showRestored, setShowRestored] = useState<boolean>(false);
  const [isChecking, setIsChecking] = useState<boolean>(false);
  const [isMinimized, setIsMinimized] = useState<boolean>(false);
  const [offlineSince, setOfflineSince] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);

  const restoredTimerRef = useRef<NodeJS.Timeout | null>(null);
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Active ping verification using the lightweight health endpoint
  const verifyConnection = useCallback(async (): Promise<boolean> => {
    if (typeof window === 'undefined') return true;
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return false;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);
      const res = await fetch(`/api/health?_t=${Date.now()}`, {
        method: 'HEAD',
        cache: 'no-store',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return res.ok;
    } catch {
      return false;
    }
  }, []);

  const handleManualRetry = async () => {
    setIsChecking(true);
    const reachable = await verifyConnection();
    setIsChecking(false);

    if (reachable) {
      setIsOnline(true);
      setShowRestored(true);
      if (restoredTimerRef.current) clearTimeout(restoredTimerRef.current);
      restoredTimerRef.current = setTimeout(() => {
        setShowRestored(false);
        setWasOffline(false);
      }, 4000);
    }
  };

  useEffect(() => {
    setMounted(true);
    if (typeof navigator !== 'undefined') {
      setIsOnline(navigator.onLine);
    }

    const onOffline = () => {
      setIsOnline(false);
      setWasOffline(true);
      setShowRestored(false);
      setOfflineSince(Date.now());
      setElapsedSeconds(0);
      try {
        if ('vibrate' in navigator) navigator.vibrate([100, 50, 100]);
      } catch {}
    };

    const onOnline = async () => {
      setIsChecking(true);
      const reachable = await verifyConnection();
      setIsChecking(false);

      if (reachable) {
        setIsOnline(true);
        setShowRestored(true);
        setOfflineSince(null);
        try {
          if ('vibrate' in navigator) navigator.vibrate([50]);
        } catch {}

        if (restoredTimerRef.current) clearTimeout(restoredTimerRef.current);
        restoredTimerRef.current = setTimeout(() => {
          setShowRestored(false);
          setWasOffline(false);
        }, 4000);
      } else {
        // navigator says online, but ping failed
        setIsOnline(false);
      }
    };

    window.addEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);

    return () => {
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('online', onOnline);
      if (restoredTimerRef.current) clearTimeout(restoredTimerRef.current);
      if (checkIntervalRef.current) clearInterval(checkIntervalRef.current);
    };
  }, [verifyConnection]);

  // Periodic polling when offline to auto-recover immediately when connection returns
  useEffect(() => {
    if (!isOnline) {
      checkIntervalRef.current = setInterval(async () => {
        const reachable = await verifyConnection();
        if (reachable) {
          setIsOnline(true);
          setShowRestored(true);
          setOfflineSince(null);
          try {
            if ('vibrate' in navigator) navigator.vibrate([50]);
          } catch {}

          if (restoredTimerRef.current) clearTimeout(restoredTimerRef.current);
          restoredTimerRef.current = setTimeout(() => {
            setShowRestored(false);
            setWasOffline(false);
          }, 4000);
        }
      }, 4000);
    } else {
      if (checkIntervalRef.current) clearInterval(checkIntervalRef.current);
    }

    return () => {
      if (checkIntervalRef.current) clearInterval(checkIntervalRef.current);
    };
  }, [isOnline, verifyConnection]);

  // Elapsed seconds timer while offline
  useEffect(() => {
    if (!isOnline && offlineSince) {
      const timer = setInterval(() => {
        setElapsedSeconds(Math.floor((Date.now() - offlineSince) / 1000));
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [isOnline, offlineSince]);

  if (!mounted) return null;

  const formatElapsed = (sec: number) => {
    if (sec < 60) return `${sec}s`;
    const mins = Math.floor(sec / 60);
    const rem = sec % 60;
    return `${mins}m ${rem}s`;
  };

  // 1. Connection Restored Notification Banner
  if (isOnline && showRestored && wasOffline) {
    return (
      <>
        <style>{`
          @keyframes networkSlideDown {
            from { opacity: 0; transform: translate(-50%, -20px); }
            to { opacity: 1; transform: translate(-50%, 0); }
          }
        `}</style>
        <aside
          aria-label="Internet Connection Restored"
          style={{
            position: 'fixed',
            top: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 99999999,
            maxWidth: '92vw',
            width: '420px',
            backgroundColor: '#065F46',
            color: '#ECFDF5',
            borderRadius: '14px',
            padding: '12px 16px',
            boxShadow: '0 20px 35px -5px rgba(6, 95, 70, 0.4), 0 0 0 1px rgba(16, 185, 129, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            animation: 'networkSlideDown 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                backgroundColor: 'rgba(255, 255, 255, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Wifi size={20} color="#34D399" />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '13.5px', color: '#FFFFFF', letterSpacing: '-0.01em' }}>
                Back Online!
              </div>
              <div style={{ fontSize: '12px', color: '#A7F3D0', marginTop: '1px' }}>
                Your internet connection has been restored.
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setShowRestored(false);
              setWasOffline(false);
            }}
            style={{
              background: 'none',
              border: 'none',
              color: '#A7F3D0',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title="Dismiss"
          >
            <X size={16} />
          </button>
        </aside>
      </>
    );
  }

  // 2. Offline State: Minimized Floating Badge
  if (!isOnline && isMinimized) {
    return (
      <>
        <style>{`
          @keyframes networkPulse {
            0%, 100% { transform: scale(1); box-shadow: 0 10px 25px rgba(153, 27, 27, 0.5); }
            50% { transform: scale(1.03); box-shadow: 0 14px 30px rgba(220, 38, 38, 0.6); }
          }
        `}</style>
        <div
          role="button"
          tabIndex={0}
          onClick={() => setIsMinimized(false)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setIsMinimized(false);
            }
          }}
          aria-label="Internet Offline, click to view connection status"
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            zIndex: 99999999,
            backgroundColor: '#991B1B',
            color: '#FFFFFF',
            padding: '10px 16px',
            borderRadius: '9999px',
            boxShadow: '0 10px 25px rgba(153, 27, 27, 0.5), 0 0 0 2px rgba(239, 68, 68, 0.4)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontWeight: 700,
            fontSize: '12.5px',
            animation: 'networkPulse 2s infinite ease-in-out',
          }}
        >
          <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: '#EF4444',
              display: 'inline-block',
            }}
          />
          <WifiOff size={15} />
          <span>No Internet ({formatElapsed(elapsedSeconds)})</span>
          <Maximize2 size={13} style={{ opacity: 0.8, marginLeft: '4px' }} />
        </div>
      </>
    );
  }

  // 3. Offline State: Prominent Popup Modal / Alert Dialog
  if (!isOnline) {
    return (
      <>
        <style>{`
          @keyframes networkFadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes networkPopIn {
            from { opacity: 0; transform: translate(-50%, -46%) scale(0.96); }
            to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
          }
          @keyframes networkSpin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
        {/* Semi-transparent backdrop blur */}
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(3px)',
            zIndex: 99999998,
            animation: 'networkFadeIn 0.25s ease-out forwards',
          }}
          onClick={() => setIsMinimized(true)}
        />

        {/* The Connection Lost Dialog */}
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="network-offline-title"
          style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 99999999,
            width: '92vw',
            maxWidth: '430px',
            backgroundColor: '#FFFFFF',
            borderRadius: '20px',
            padding: '24px 22px',
            boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(226, 232, 240, 0.8)',
            animation: 'networkPopIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
            fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
          }}
        >
          {/* Header Row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
            <div
              style={{
                width: '52px',
                height: '52px',
                borderRadius: '14px',
                backgroundColor: '#FEE2E2',
                color: '#DC2626',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <WifiOff size={28} strokeWidth={2.2} />
            </div>

            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                type="button"
                onClick={() => setIsMinimized(true)}
                title="Minimize popup"
                style={{
                  background: '#F1F5F9',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#64748B',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'background 0.15s ease',
                }}
              >
                <Minimize2 size={16} />
              </button>
            </div>
          </div>

          {/* Content */}
          <h2
            id="network-offline-title"
            style={{
              fontSize: '18px',
              fontWeight: 800,
              color: '#0F172A',
              marginBottom: '6px',
              letterSpacing: '-0.02em',
            }}
          >
            Internet Connection Lost
          </h2>

          <p
            style={{
              fontSize: '13.5px',
              color: '#475569',
              lineHeight: 1.5,
              marginBottom: '18px',
            }}
          >
            We detected that your device is disconnected from the internet. Real-time orders, updates, and cloud sync are temporarily paused.
          </p>

          {/* Status Capsule */}
          <div
            style={{
              backgroundColor: '#FEF2F2',
              border: '1px solid #FECACA',
              borderRadius: '10px',
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '20px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: '#DC2626',
                  display: 'inline-block',
                }}
              />
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#991B1B' }}>
                Offline for {formatElapsed(elapsedSeconds)}
              </span>
            </div>
            <span style={{ fontSize: '11px', color: '#B91C1C', fontWeight: 500 }}>
              Auto-retrying...
            </span>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button
              type="button"
              onClick={handleManualRetry}
              disabled={isChecking}
              style={{
                width: '100%',
                padding: '12px 18px',
                borderRadius: '12px',
                backgroundColor: '#DC2626',
                color: '#FFFFFF',
                border: 'none',
                fontWeight: 700,
                fontSize: '14px',
                cursor: isChecking ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 4px 14px rgba(220, 38, 38, 0.35)',
                transition: 'all 0.15s ease',
                opacity: isChecking ? 0.75 : 1,
              }}
            >
              <RefreshCw
                size={16}
                style={{
                  animation: isChecking ? 'networkSpin 0.9s linear infinite' : 'none',
                }}
              />
              <span>{isChecking ? 'Checking Connection...' : 'Check Connection Now'}</span>
            </button>

            <button
              type="button"
              onClick={() => setIsMinimized(true)}
              style={{
                width: '100%',
                padding: '10px 16px',
                borderRadius: '10px',
                backgroundColor: 'transparent',
                color: '#64748B',
                border: 'none',
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer',
                textAlign: 'center',
              }}
            >
              Minimize and keep working offline
            </button>
          </div>
        </div>
      </>
    );
  }

  return null;
}
