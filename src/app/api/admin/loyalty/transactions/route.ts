import { NextResponse } from 'next/server';
import { getRestaurantBySlug, getLoyaltyTransactionsList } from '@/lib/db';

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

    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const type = searchParams.get('type') || undefined;

    const { transactions, totalRecords, totalPages, currentPage, pageSize } = await getLoyaltyTransactionsList(
      restaurant.id,
      page,
      limit,
      type
    );

    return NextResponse.json({
      success: true,
      data: transactions,
      pagination: {
        currentPage,
        pageSize,
        totalRecords,
        totalPages,
      },
    });
  } catch (error: any) {
    console.error('Error fetching loyalty transactions:', error);
    return NextResponse.json({ success: false, error: error.message || 'Server error' }, { status: 500 });
  }
}
