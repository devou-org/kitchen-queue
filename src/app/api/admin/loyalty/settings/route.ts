import { NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth';
import { getRestaurantBySlug, getLoyaltySettings, updateLoyaltySettings } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const slug = searchParams.get('slug');

    if (!slug) {
      return NextResponse.json({ success: false, error: 'Restaurant slug is required' }, { status: 400 });
    }

    const restaurant = await getRestaurantBySlug(slug);
    if (!restaurant) {
      return NextResponse.json({ success: false, error: 'Restaurant not found' }, { status: 404 });
    }

    const settings = await getLoyaltySettings(restaurant.id);
    return NextResponse.json({ success: true, data: settings });
  } catch (error: any) {
    console.error('Error fetching loyalty settings:', error);
    return NextResponse.json({ success: false, error: error.message || 'Server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { admin } = await getAuthContext(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { slug, ...settingsData } = body;

    if (!slug) {
      return NextResponse.json({ success: false, error: 'Restaurant slug is required' }, { status: 400 });
    }

    const restaurant = await getRestaurantBySlug(slug);
    if (!restaurant) {
      return NextResponse.json({ success: false, error: 'Restaurant not found' }, { status: 404 });
    }

    const updated = await updateLoyaltySettings(restaurant.id, settingsData);
    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    console.error('Error updating loyalty settings:', error);
    return NextResponse.json({ success: false, error: error.message || 'Server error' }, { status: 500 });
  }
}
