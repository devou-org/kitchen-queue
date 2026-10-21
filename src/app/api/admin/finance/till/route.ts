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
        error: 'Finance module is disabled by Super Admin',
        isModuleEnabled: false,
      }, { status: 403 });
    }

    const businessDate = request.nextUrl.searchParams.get('date') || new Date().toISOString().split('T')[0];

    const tillData = await FinanceService.getTillReconciliation(restaurant.id, businessDate);
    const history = await FinanceService.getTillHistory(restaurant.id, 15);

    return NextResponse.json({
      success: true,
      data: tillData,
      history,
      businessDate,
    });
  } catch (error: any) {
    console.error('Error fetching till reconciliation:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
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
        error: 'Finance module is disabled by Super Admin. No data can be added.',
        isModuleEnabled: false,
      }, { status: 403 });
    }

    const body = await request.json();
    const businessDate = body.businessDate || new Date().toISOString().split('T')[0];
    const openingCash = Number(body.openingCash) || 0;
    const actualCountedCash = Number(body.actualCountedCash) || 0;

    const reconciled = await FinanceService.reconcileTill({
      restaurantId: restaurant.id,
      businessDate,
      openingCash,
      actualCountedCash,
      notes: body.notes?.trim() || undefined,
      closedBy: (admin as any)?.id || undefined,
    });

    return NextResponse.json({
      success: true,
      data: reconciled,
      message: 'Till reconciliation saved successfully',
    });
  } catch (error: any) {
    console.error('Error saving till reconciliation:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
