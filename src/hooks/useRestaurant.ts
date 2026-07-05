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
};

let cached: RestaurantContext | null = null;
let fetchPromise: Promise<RestaurantContext | null> | null = null;

async function fetchRestaurant(): Promise<RestaurantContext | null> {
  if (cached) return cached;
  if (fetchPromise) return fetchPromise;

  // Extract slug from URL: /[slug]/...
  let slug = '';
  if (typeof window !== 'undefined') {
    const segments = window.location.pathname.split('/').filter(Boolean);
    slug = segments[0] || '';
  }

  fetchPromise = fetch('/api/restaurant', {
    headers: slug ? { 'x-restaurant-slug': slug } : {}
  })
    .then(res => res.json())
    .then(data => {
      if (data.success && data.data) {
        cached = data.data;
        return cached;
      }
      return null;
    })
    .catch(() => null)
    .finally(() => { fetchPromise = null; });

  return fetchPromise;
}

/**
 * useRestaurant — lightweight hook that returns the current tenant's info.
 * The data is fetched once from /api/restaurant and module-level cached
 * for the lifetime of the page.
 */
export function useRestaurant() {
  const [restaurant, setRestaurant] = useState<RestaurantContext | null>(cached);
  const [loading, setLoading] = useState(!cached);

  useEffect(() => {
    if (cached) {
      setRestaurant(cached);
      setLoading(false);
      return;
    }
    fetchRestaurant().then(r => {
      setRestaurant(r);
      setLoading(false);
    });
  }, []);

  return { restaurant, loading };
}
