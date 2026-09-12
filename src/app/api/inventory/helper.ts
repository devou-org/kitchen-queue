import { NextRequest } from 'next/server';
import { getRestaurantBySlug } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

export async function resolveRestaurantId(request: NextRequest): Promise<string | null> {
  const admin = await requireAdmin(request);
  if (admin?.restaurantId) return admin.restaurantId;

  const headerSlug = request.headers.get('x-restaurant-slug');
  const { searchParams } = new URL(request.url);
  const querySlug = searchParams.get('slug');
  const slug = querySlug?.trim() || headerSlug?.trim() || admin?.restaurantSlug;

  if (slug) {
    const restaurant = await getRestaurantBySlug(slug);
    if (restaurant) return restaurant.id;
  }
  return null;
}
