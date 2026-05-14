'use client';
import { useState, useEffect } from 'react';

export type RestaurantContext = {
  id: string;
  name: string;
  slug: string;
  logo_url?: string;
  pusher_channel: string;
};

let cached: RestaurantContext | null = null;
let fetchPromise: Promise<RestaurantContext | null> | null = null;

async function fetchRestaurant(): Promise<RestaurantContext | null> {
  if (cached) return cached;
  if (fetchPromise) return fetchPromise;

  fetchPromise = fetch('/api/restaurant')
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
