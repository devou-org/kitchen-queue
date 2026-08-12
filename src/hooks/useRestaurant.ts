'use client';
import { useState, useEffect } from 'react';

export type RestaurantContext = {
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
  pusher_channel: string;
  modules?: Record<string, boolean>;
  timezone?: string;
  opening_time?: string;
  closing_time?: string;
  rollover_time?: string;
  gst_type?: 'NONE' | 'REGULAR' | 'COMPOSITION';
  gst_number?: string;
  gst_rate?: number;
  billing_status?: string;
};

let cached: RestaurantContext | null = null;
let lastFetchTime = 0;
let fetchPromise: Promise<RestaurantContext | null> | null = null;
const listeners = new Set<(data: RestaurantContext | null) => void>();

export async function fetchRestaurant(force = false): Promise<RestaurantContext | null> {
  const now = Date.now();
  if (!force && cached) return cached;
  if (fetchPromise) return fetchPromise;
  if (!force && cached && now - lastFetchTime < 1500) return cached;

  // Extract slug from URL: /[slug]/...
  let slug = '';
  if (typeof window !== 'undefined') {
    const segments = window.location.pathname.split('/').filter(Boolean);
    slug = segments[0] || '';
  }

  const p = fetch('/api/restaurant', {
    headers: slug ? { 'x-restaurant-slug': slug } : {},
    cache: 'no-store'
  })
    .then(res => res.json())
    .then(data => {
      if (data.success && data.data) {
        cached = data.data;
        lastFetchTime = Date.now();
        listeners.forEach(fn => fn(cached));
        return cached;
      }
      return null;
    })
    .catch(() => null)
    .finally(() => { 
      if (fetchPromise === p) fetchPromise = null; 
    });

  fetchPromise = p;
  return fetchPromise;
}

/**
 * useRestaurant — lightweight hook that returns the current tenant's info.
 * Provides stale-while-revalidate data fetching and auto-refreshes on tab focus / navigation.
 */
export function useRestaurant() {
  const [restaurant, setRestaurant] = useState<RestaurantContext | null>(cached);
  const [loading, setLoading] = useState(!cached);

  const refresh = async () => {
    setLoading(true);
    const r = await fetchRestaurant(true);
    setRestaurant(r);
    setLoading(false);
    return r;
  };

  useEffect(() => {
    const handler = (data: RestaurantContext | null) => {
      setRestaurant(data);
      setLoading(false);
    };
    
    listeners.add(handler);

    if (cached) {
      handler(cached);
    }

    // Always fetch fresh state in background on mount/page navigation (Stale-While-Revalidate)
    fetchRestaurant(true);

    // Auto-revalidate whenever user switches back to this browser tab or window gains focus
    const revalidate = () => {
      const now = Date.now();
      if (now - lastFetchTime > 1500) {
        fetchRestaurant(true);
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        revalidate();
      }
    };

    window.addEventListener('focus', revalidate);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      listeners.delete(handler);
      window.removeEventListener('focus', revalidate);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  return { restaurant, loading, refresh };
}
