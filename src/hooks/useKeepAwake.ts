'use client';

import { useEffect, useRef } from 'react';

/**
 * Custom hook to prevent the screen from sleeping on tablets and mobile devices.
 * Uses the Screen Wake Lock API and re-acquires the lock automatically on visibility change.
 */
export function useKeepAwake(enabled: boolean = true) {
  const wakeLockRef = useRef<any>(null);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined' || !('wakeLock' in navigator)) {
      return;
    }

    let isMounted = true;

    const requestWakeLock = async () => {
      try {
        if (document.visibilityState === 'visible' && !wakeLockRef.current) {
          wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
          wakeLockRef.current.addEventListener('release', () => {
            wakeLockRef.current = null;
          });
          console.log('🔆 Screen Wake Lock active for print station');
        }
      } catch (err: any) {
        console.warn('Screen Wake Lock request failed:', err?.message || err);
      }
    };

    requestWakeLock();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        requestWakeLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      isMounted = false;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (wakeLockRef.current) {
        try {
          wakeLockRef.current.release();
        } catch {}
        wakeLockRef.current = null;
      }
    };
  }, [enabled]);
}
