import { NextRequest, NextResponse } from 'next/server';
import { getRestaurantBySlug } from '@/lib/db';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get('slug');
  const type = searchParams.get('type') || 'customer';

  const defaultQdineLogo = 'https://ik.imagekit.io/j2q8x5lu0/qdine/qdine-logo-rotated.png';

  if (type === 'superadmin') {
    return NextResponse.json({
      name: 'Qdine Super Admin',
      short_name: 'Qdine Admin',
      description: 'Super Admin Console for Qdine',
      start_url: '/super-admin/login',
      scope: '/super-admin/',
      display: 'standalone',
      background_color: '#ffffff',
      theme_color: '#00534f',
      icons: [
        {
          src: `${defaultQdineLogo}?tr=w-192,h-192,f-png`,
          sizes: '192x192',
          type: 'image/png',
          purpose: 'any maskable'
        },
        {
          src: `${defaultQdineLogo}?tr=w-512,h-512,f-png`,
          sizes: '512x512',
          type: 'image/png',
          purpose: 'any maskable'
        }
      ]
    });
  }

  if (!slug) {
    return NextResponse.json({ error: 'Missing slug' }, { status: 400 });
  }

  const restaurant = await getRestaurantBySlug(slug);

  if (!restaurant) {
    return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 });
  }

  // Determine icons based on restaurant logo or fallback
  const logoUrl = restaurant.logo_url || defaultQdineLogo;
  const isImageKit = logoUrl.includes('imagekit.io');
  
  // Dynamically detect image type for non-ImageKit URLs
  const lowerUrl = logoUrl.split('?')[0].toLowerCase();
  const isSvg = lowerUrl.endsWith('.svg');
  const isJpg = lowerUrl.endsWith('.jpg') || lowerUrl.endsWith('.jpeg');
  const isWebp = lowerUrl.endsWith('.webp');
  
  let imgType = 'image/png';
  if (!isImageKit) {
    if (isSvg) imgType = 'image/svg+xml';
    else if (isJpg) imgType = 'image/jpeg';
    else if (isWebp) imgType = 'image/webp';
  }

  const icons = [
    {
      src: isImageKit ? `${logoUrl}?tr=w-192,h-192,f-png` : logoUrl,
      sizes: (isSvg && !isImageKit) ? 'any' : '192x192',
      type: imgType,
      purpose: 'any maskable'
    },
    {
      src: isImageKit ? `${logoUrl}?tr=w-512,h-512,f-png` : logoUrl,
      sizes: (isSvg && !isImageKit) ? 'any' : '512x512',
      type: imgType,
      purpose: 'any maskable'
    }
  ];

  let name = restaurant.name;
  let startUrl = `/${slug}/menu`;
  let scope = `/${slug}/`;

  if (type === 'admin') {
    name = `${restaurant.name} Admin`;
    startUrl = `/${slug}/admin/login`;
    scope = `/${slug}/admin/`;
  } else if (type === 'staff') {
    name = `${restaurant.name} Staff`;
    startUrl = `/${slug}/staff/login`;
    scope = `/${slug}/staff/`;
  }

  const manifest = {
    name: name,
    short_name: name,
    description: restaurant.menu_description || `Real-time restaurant queue management system for ${restaurant.name}.`,
    start_url: startUrl,
    scope: scope,
    display: 'standalone',
    background_color: restaurant.secondary_color || '#ffffff',
    theme_color: restaurant.primary_color || '#000000',
    icons: icons
  };

  return NextResponse.json(manifest);
}
