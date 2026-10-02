import { NextRequest } from 'next/server';
import { getRestaurantBySlug, getRestaurantModules } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

export async function resolveRestaurantId(request: NextRequest): Promise<string | null> {
  const headerSlug = request.headers.get('x-restaurant-slug');
  const { searchParams } = new URL(request.url);
  const querySlug = searchParams.get('slug');

  let rawSlug = querySlug || headerSlug || '';
  if (rawSlug.startsWith('["') || rawSlug.startsWith("['")) {
    try {
      const parsed = JSON.parse(rawSlug);
      if (Array.isArray(parsed) && parsed[0]) rawSlug = parsed[0];
    } catch {
      // ignore
    }
  }
  const cleanSlug = rawSlug.replace(/[\[\]'"]/g, '').trim();

  let restaurantId: string | null = null;
  if (cleanSlug) {
    const restaurant = await getRestaurantBySlug(cleanSlug);
    if (restaurant) restaurantId = restaurant.id;
  }

  if (!restaurantId) {
    const admin = await requireAdmin(request);
    restaurantId = admin?.restaurantId || (admin as any)?.restaurant_id || null;
    if (!restaurantId && admin?.restaurantSlug) {
      const restaurant = await getRestaurantBySlug(admin.restaurantSlug);
      if (restaurant) restaurantId = restaurant.id;
    }
  }

  if (!restaurantId) return null;

  try {
    const modules = await getRestaurantModules(restaurantId);
    const inv = modules.find((m: any) => m.module_name === 'INVENTORY');
    if (!inv || !inv.is_enabled) {
      return null;
    }
  } catch (err) {
    console.error('Error checking inventory module status:', err);
    return null;
  }

  return restaurantId;
}
