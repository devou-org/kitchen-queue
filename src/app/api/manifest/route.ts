import { NextRequest, NextResponse } from 'next/server';
import { getRestaurantBySlug } from '@/lib/db';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get('slug');

  if (!slug) {
    return NextResponse.json({ error: 'Missing slug' }, { status: 400 });
  }

  const restaurant = await getRestaurantBySlug(slug);

  if (!restaurant) {
    return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 });
  }

  // Determine icons based on restaurant logo or fallback
  let icons = [];
  if (restaurant.logo_url) {
    const isImageKit = restaurant.logo_url.includes('imagekit.io');
    icons = [
      {
        src: isImageKit ? `${restaurant.logo_url}?tr=w-192,h-192,f-png` : restaurant.logo_url,
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any maskable'
      },
      {
        src: isImageKit ? `${restaurant.logo_url}?tr=w-512,h-512,f-png` : restaurant.logo_url,
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any maskable'
      }
    ];
  } else {
    // Fallback to default Renjz Kitchen icon if none exists
    icons = [
      {
        src: 'https://ik.imagekit.io/j2q8x5lu0/tr:w-192,h-192,f-png/Renjzkitchen/renjz.jpg',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any maskable'
      },
      {
        src: 'https://ik.imagekit.io/j2q8x5lu0/tr:w-512,h-512,f-png/Renjzkitchen/renjz.jpg',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any maskable'
      }
    ];
  }

  const manifest = {
    name: restaurant.name,
    short_name: restaurant.name,
    description: restaurant.menu_description || `Real-time restaurant queue management system for ${restaurant.name}.`,
    start_url: `/${slug}/admin`,
    scope: `/${slug}/`,
    display: 'standalone',
    background_color: restaurant.secondary_color || '#ffffff',
    theme_color: restaurant.primary_color || '#000000',
    icons: icons
  };

  return NextResponse.json(manifest);
}
