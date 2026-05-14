import { NextRequest, NextResponse } from 'next/server';
import { getRestaurantBySlug } from '@/lib/db';

/**
 * GET /api/restaurant
 * Returns current tenant's public info (id, name, slug, logo_url).
 * The restaurant is resolved from x-restaurant-slug injected by middleware.
 */
export async function GET(request: NextRequest) {
  try {
    const slug = request.headers.get('x-restaurant-slug') || 'demo';
    const restaurant = await getRestaurantBySlug(slug);

    if (!restaurant) {
      return NextResponse.json({ success: false, error: 'Restaurant not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: {
        id: restaurant.id,
        name: restaurant.name,
        slug: restaurant.slug,
        logo_url: restaurant.logo_url,
        // Derived channel name so clients don't have to construct it themselves
        pusher_channel: `queue-channel-${restaurant.id}`,
      },
    });
  } catch (error) {
    console.error('Get restaurant error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch restaurant' }, { status: 500 });
  }
}
