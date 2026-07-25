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
  billing_status?: string;
};

let cached: RestaurantContext | null = null;
let fetchPromise: Promise<RestaurantContext | null> | null = null;
const listeners = new Set<(data: RestaurantContext | null) => void>();

export async function fetchRestaurant(force = false): Promise<RestaurantContext | null> {
  if (!force && cached) return cached;
  if (!force && fetchPromise) return fetchPromise;

  // Extract slug from URL: /[slug]/...
  let slug = '';
  if (typeof window !== 'undefined') {
    const segments = window.location.pathname.split('/').filter(Boolean);
    slug = segments[0] || '';
  }

  const p = fetch('/api/restaurant', {
    headers: slug ? { 'x-restaurant-slug': slug } : {}
  })
    .then(res => res.json())
    .then(data => {
      if (data.success && data.data) {
        cached = data.data;
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
 * The data is fetched once from /api/restaurant and module-level cached
 * for the lifetime of the page. All mounted hooks will receive updates
 * when refreshed.
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
    } else {
      fetchRestaurant().then(r => {
        // fetchRestaurant already calls listeners, but this ensures initial mount is covered
        if (!cached) handler(r);
      });
    }

    return () => {
      listeners.delete(handler);
    };
  }, []);

  return { restaurant, loading, refresh };
}
