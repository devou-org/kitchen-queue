import { NextRequest, NextResponse } from 'next/server';
import { getOtpStats, getRestaurantBySlug } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    // 1. Basic Admin Auth Check
    const admin = await requireAdmin(request);
    if (!admin || !admin.isAdmin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Get Range from query params
    const { searchParams } = new URL(request.url);
    const dateFrom = searchParams.get('date_from');
    const dateTo = searchParams.get('date_to');
    const slug = request.headers.get('x-restaurant-slug');

    if (!dateFrom || !dateTo) {
      return NextResponse.json({ success: false, error: 'Date range required' }, { status: 400 });
    }

    let restaurantId: string | undefined = undefined;
    if (slug) {
      const restaurant = await getRestaurantBySlug(slug);
      if (restaurant) {
        restaurantId = restaurant.id;
      }
    }

    // 3. Fetch Stats
    const stats = await getOtpStats(dateFrom, dateTo, restaurantId);
    
    const totalCount = stats.reduce((sum, s) => sum + (s.count || 0), 0);
    const totalCost = stats.reduce((sum, s) => sum + parseFloat(s.cost || '0'), 0);

    return NextResponse.json({
      success: true,
      data: stats,
      summary: {
        total_otps: totalCount,
        total_cost: totalCost,
        rate_per_otp: 0.50
      }
    });
  } catch (error) {
    console.error('OTP Stats error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch stats' }, { status: 500 });
  }
}
