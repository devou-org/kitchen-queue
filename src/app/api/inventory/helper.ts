import { NextRequest } from 'next/server';
import { getRestaurantBySlug } from '@/lib/db';
import { getRestaurantBySlug, getRestaurantModules } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

export async function resolveRestaurantId(request: NextRequest): Promise<string | null> {
  const admin = await requireAdmin(request);
  if (admin?.restaurantId) return admin.restaurantId;
  let restaurantId: string | null = admin?.restaurantId || null;

  const headerSlug = request.headers.get('x-restaurant-slug');
  const { searchParams } = new URL(request.url);
  const querySlug = searchParams.get('slug');
  const slug = querySlug?.trim() || headerSlug?.trim() || admin?.restaurantSlug;
  if (!restaurantId) {
    const headerSlug = request.headers.get('x-restaurant-slug');
    const { searchParams } = new URL(request.url);
    const querySlug = searchParams.get('slug');
    const slug = querySlug?.trim() || headerSlug?.trim() || admin?.restaurantSlug;

  if (slug) {
    const restaurant = await getRestaurantBySlug(slug);
    if (restaurant) return restaurant.id;
    if (slug) {
      const restaurant = await getRestaurantBySlug(slug);
      if (restaurant) restaurantId = restaurant.id;
    }
  }
  return null;

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
