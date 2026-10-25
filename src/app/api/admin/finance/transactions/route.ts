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

    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;
    const entryType = searchParams.get('entryType') || undefined;
    const source = searchParams.get('source') || undefined;
    const category = searchParams.get('category') || undefined;
    const paymentMethod = searchParams.get('paymentMethod') || undefined;
    const search = searchParams.get('search') || undefined;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const result = await FinanceService.getTransactions(restaurant.id, {
      startDate,
      endDate,
      entryType,
      source,
      category,
      paymentMethod,
      search,
      page,
      limit,
    });

    return NextResponse.json({
      success: true,
      data: result.transactions,
      pagination: result.pagination,
      isModuleEnabled: true,
    });
  } catch (error: any) {
    console.error('Error fetching finance transactions:', error);
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
    if (!body.amount || Number(body.amount) <= 0) {
      return NextResponse.json({ success: false, error: 'Valid expense amount is required' }, { status: 400 });
    }

    if (!body.category || !body.category.trim()) {
      return NextResponse.json({ success: false, error: 'Expense category is required' }, { status: 400 });
    }

    const created = await FinanceService.createExpense({
      restaurantId: restaurant.id,
      category: body.category.trim(),
      amount: Number(body.amount),
      taxAmount: Number(body.taxAmount || 0),
      paymentMethod: body.paymentMethod || 'UPI',
      description: body.description?.trim() || null,
      receiptUrl: body.receiptUrl || null,
      createdBy: (admin as any)?.id || null,
      transactionDate: body.transactionDate || undefined,
      referenceNumber: body.referenceNumber?.trim() || undefined,
    });

    return NextResponse.json({
      success: true,
      data: created,
      message: 'Expense logged successfully',
    });
  } catch (error: any) {
    console.error('Error creating finance expense:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
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

    const id = request.nextUrl.searchParams.get('id');
    if (!id) {
      return NextResponse.json({ success: false, error: 'Transaction ID is required' }, { status: 400 });
    }

    const deleted = await FinanceService.deleteExpense(id, restaurant.id);
    if (!deleted) {
      return NextResponse.json({ success: false, error: 'Expense not found or cannot be deleted' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Expense deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting finance expense:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
