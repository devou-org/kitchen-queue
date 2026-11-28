'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { WifiOff, RefreshCw, Minimize2, Maximize2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useRestaurant } from '@/hooks/useRestaurant';

export function NetworkDetector() {
  const { restaurant } = useRestaurant();
  const [mounted, setMounted] = useState(false);
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [isChecking, setIsChecking] = useState<boolean>(false);
  const [isMinimized, setIsMinimized] = useState<boolean>(false);
  const [offlineSince, setOfflineSince] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);

  const wasOfflineRef = useRef<boolean>(false);
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const primaryColor = restaurant?.primary_color || 'var(--primary, #971345)';
  const secondaryColor = restaurant?.secondary_color || 'var(--secondary, #EC7951)';

  const notifyConnectionRestored = useCallback(() => {
    setIsOnline(true);
    setOfflineSince(null);
    setIsMinimized(false);
    if (wasOfflineRef.current) {
      wasOfflineRef.current = false;
      toast.success('Back Online! Your internet connection has been restored.', {
        id: 'network-restored',
        duration: 3000,
      });
    }
  }, []);

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
      notifyConnectionRestored();
    }
  };

  useEffect(() => {
    setMounted(true);
    if (typeof navigator !== 'undefined') {
      const online = navigator.onLine;
      setIsOnline(online);
      if (!online) {
        wasOfflineRef.current = true;
        setOfflineSince(Date.now());
      }
    }

    const onOffline = () => {
      setIsOnline(false);
      wasOfflineRef.current = true;
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
        try {
          if ('vibrate' in navigator) navigator.vibrate([50]);
        } catch {}
        notifyConnectionRestored();
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
      if (checkIntervalRef.current) clearInterval(checkIntervalRef.current);
    };
  }, [verifyConnection, notifyConnectionRestored]);

  // Periodic polling when offline to auto-recover immediately when connection returns
  useEffect(() => {
    if (!isOnline) {
      checkIntervalRef.current = setInterval(async () => {
        const reachable = await verifyConnection();
        if (reachable) {
          try {
            if ('vibrate' in navigator) navigator.vibrate([50]);
          } catch {}
          notifyConnectionRestored();
        }
      }, 4000);
    } else {
      if (checkIntervalRef.current) clearInterval(checkIntervalRef.current);
    }

    return () => {
      if (checkIntervalRef.current) clearInterval(checkIntervalRef.current);
    };
  }, [isOnline, verifyConnection, notifyConnectionRestored]);

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

  // 1. Offline State: Minimized Floating Badge
  if (!isOnline && isMinimized) {
    return (
      <>
        <style>{`
          @keyframes networkPulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.03); }
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
            backgroundColor: primaryColor,
            color: '#FFFFFF',
            padding: '10px 16px',
            borderRadius: 'var(--radius-full, 9999px)',
            boxShadow: `0 10px 25px color-mix(in srgb, ${primaryColor} 45%, transparent), 0 0 0 2px color-mix(in srgb, ${secondaryColor} 45%, transparent)`,
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
              backgroundColor: secondaryColor,
              display: 'inline-block',
            }}
          />
          <WifiOff size={15} />
          <span>No Internet ({formatElapsed(elapsedSeconds)})</span>
          <Maximize2 size={13} style={{ opacity: 0.85, marginLeft: '4px' }} />
        </div>
      </>
    );
  }

  // 2. Offline State: Prominent Popup Modal / Alert Dialog
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
            backgroundColor: 'var(--card, #FFFFFF)',
            borderRadius: 'var(--radius-lg, 16px)',
            padding: '24px 22px',
            boxShadow: 'var(--shadow-lg, 0 25px 60px -15px rgba(0, 0, 0, 0.35)), 0 0 0 1px var(--border, #EFE9EB)',
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
                borderRadius: 'var(--radius, 12px)',
                backgroundColor: `color-mix(in srgb, ${primaryColor} 12%, transparent)`,
                color: primaryColor,
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
                  background: 'var(--bg, #FDF9FA)',
                  border: '1px solid var(--border, #EFE9EB)',
                  borderRadius: 'var(--radius-sm, 8px)',
                  color: 'var(--text-secondary, #6B6667)',
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
              color: 'var(--text-primary, #33322F)',
              marginBottom: '6px',
              letterSpacing: '-0.02em',
            }}
          >
            Internet Connection Lost
          </h2>

          <p
            style={{
              fontSize: '13.5px',
              color: 'var(--text-secondary, #6B6667)',
              lineHeight: 1.5,
              marginBottom: '18px',
            }}
          >
            We detected that your device is disconnected from the internet. Real-time orders, updates, and cloud sync are temporarily paused.
          </p>

          {/* Status Capsule */}
          <div
            style={{
              backgroundColor: `color-mix(in srgb, ${primaryColor} 8%, var(--card, #FFFFFF))`,
              border: `1px solid color-mix(in srgb, ${primaryColor} 22%, transparent)`,
              borderRadius: 'var(--radius-sm, 8px)',
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
                  backgroundColor: primaryColor,
                  display: 'inline-block',
                }}
              />
              <span style={{ fontSize: '12px', fontWeight: 600, color: primaryColor }}>
                Offline for {formatElapsed(elapsedSeconds)}
              </span>
            </div>
            <span style={{ fontSize: '11px', color: secondaryColor, fontWeight: 600 }}>
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
                borderRadius: 'var(--radius, 12px)',
                backgroundColor: primaryColor,
                color: '#FFFFFF',
                border: 'none',
                fontWeight: 700,
                fontSize: '14px',
                cursor: isChecking ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: `0 4px 14px color-mix(in srgb, ${primaryColor} 35%, transparent)`,
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
                borderRadius: 'var(--radius-sm, 8px)',
                backgroundColor: 'transparent',
                color: 'var(--text-secondary, #6B6667)',
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
