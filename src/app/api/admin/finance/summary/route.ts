import { NextRequest, NextResponse } from 'next/server';
import { getRestaurantBySlug } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { FinanceService } from '@/modules/finance/finance.service';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const slug = request.nextUrl.searchParams.get('slug') || request.headers.get('x-restaurant-slug') || 'demo';
    const restaurant = await getRestaurantBySlug(slug);

    if (!restaurant) {
      return NextResponse.json({ success: false, error: 'Restaurant not found' }, { status: 404 });
    }

    const admin = await requireAdmin(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const isEnabled = await FinanceService.isModuleActive(restaurant.id);
    if (!isEnabled) {
      return NextResponse.json({
        success: false,
        error: 'Finance module is disabled by Super Admin for this restaurant',
        isModuleEnabled: false,
      }, { status: 403 });
    }

    const startDate = request.nextUrl.searchParams.get('startDate') || undefined;
    const endDate = request.nextUrl.searchParams.get('endDate') || undefined;

    const summary = await FinanceService.getSummary(restaurant.id, startDate, endDate);

    return NextResponse.json({
      success: true,
      data: summary,
      isModuleEnabled: true,
    });
  } catch (error: any) {
    console.error('Error fetching finance summary:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
