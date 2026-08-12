import { NextRequest, NextResponse } from 'next/server';
import { getRestaurantBySlug, getRestaurantModules } from '@/lib/db';

export const dynamic = 'force-dynamic';

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

    const moduleRows = await getRestaurantModules(restaurant.id);
    const modules = (moduleRows || []).reduce((acc: Record<string, boolean>, row: any) => {
      acc[row.module_name] = !!row.is_enabled;
      return acc;
    }, {} as Record<string, boolean>);

    return NextResponse.json({
      success: true,
      data: {
        id: restaurant.id,
        name: restaurant.name,
        slug: restaurant.slug,
        logo_url: restaurant.logo_url,
        primary_color: restaurant.primary_color,
        secondary_color: restaurant.secondary_color,
        menu_layout: restaurant.menu_layout || 'LIST',
        menu_title: restaurant.menu_title || "Today's Specials",
        menu_description: restaurant.menu_description || "Hand-curated coastal delicacies prepared with traditional recipes.",
        address: restaurant.address,
        phone: restaurant.phone,
        timezone: restaurant.timezone,
        opening_time: restaurant.opening_time,
        closing_time: restaurant.closing_time,
        rollover_time: restaurant.rollover_time,
        billing_status: restaurant.billing_status,
        gst_type: restaurant.gst_type,
        gst_number: restaurant.gst_number,
        gst_rate: restaurant.gst_rate,
        // Derived channel name so clients don't have to construct it themselves
        pusher_channel: `queue-channel-${restaurant.id}`,
        modules,
      },
    });
  } catch (error) {
    console.error('Get restaurant error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch restaurant' }, { status: 500 });
  }
}

