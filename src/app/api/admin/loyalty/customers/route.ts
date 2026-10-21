import { NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth';
import { 
  getRestaurantBySlug, 
  getLoyaltyCustomersList, 
  adjustCustomerPoints,
  deleteCustomerLoyaltyProfile 
} from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const slug = searchParams.get('slug');
    const search = searchParams.get('search') || '';

    if (!slug) {
      return NextResponse.json({ success: false, error: 'Restaurant slug is required' }, { status: 400 });
    }

    const restaurant = await getRestaurantBySlug(slug);
    if (!restaurant) {
      return NextResponse.json({ success: false, error: 'Restaurant not found' }, { status: 404 });
    }

    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const { customers, totalRecords, totalPages, currentPage, pageSize } = await getLoyaltyCustomersList(
      restaurant.id,
      search,
      page,
      limit
    );

    return NextResponse.json({
      success: true,
      data: customers,
      pagination: {
        currentPage,
        pageSize,
        totalRecords,
        totalPages,
      },
    });
  } catch (error: any) {
    console.error('Error fetching loyalty customers:', error);
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
    const { slug, customer_loyalty_id, points_delta, reason } = body;

    if (!slug || !customer_loyalty_id || points_delta === undefined) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    const restaurant = await getRestaurantBySlug(slug);
    if (!restaurant) {
      return NextResponse.json({ success: false, error: 'Restaurant not found' }, { status: 404 });
    }

    const updated = await adjustCustomerPoints(restaurant.id, customer_loyalty_id, Number(points_delta), reason);
    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    console.error('Error adjusting loyalty points:', error);
    return NextResponse.json({ success: false, error: error.message || 'Server error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { admin } = await getAuthContext(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    let slug = searchParams.get('slug');
    let customerLoyaltyId = searchParams.get('customer_loyalty_id');

    if (!slug || !customerLoyaltyId) {
      try {
        const body = await request.json();
        slug = slug || body.slug;
        customerLoyaltyId = customerLoyaltyId || body.customer_loyalty_id;
      } catch {
        // query parameters were used
      }
    }

    if (!slug || !customerLoyaltyId) {
      return NextResponse.json({ success: false, error: 'Restaurant slug and customer_loyalty_id are required' }, { status: 400 });
    }

    const restaurant = await getRestaurantBySlug(slug);
    if (!restaurant) {
      return NextResponse.json({ success: false, error: 'Restaurant not found' }, { status: 404 });
    }

    const deleted = await deleteCustomerLoyaltyProfile(restaurant.id, customerLoyaltyId);
    if (!deleted) {
      return NextResponse.json({ success: false, error: 'Customer loyalty profile not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Customer loyalty profile deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting customer loyalty profile:', error);
    return NextResponse.json({ success: false, error: error.message || 'Server error' }, { status: 500 });
  }
}
