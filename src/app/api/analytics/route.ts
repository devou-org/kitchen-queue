import { NextRequest, NextResponse } from 'next/server';
import { getDailyAnalytics, getPeakHours, getTopProducts, getDashboardStats, getKitchenSnapshot, getPaymentMethodAnalytics, getRestaurantBySlug, pool } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

const getDateRange = (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const today = new Date().toISOString().split('T')[0];
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  return {
    date_from: searchParams.get('date_from') || sevenDaysAgo,
    date_to: searchParams.get('date_to') || today,
  };
};

export async function GET(request: NextRequest) {
  const slug = request.headers.get('x-restaurant-slug') || 'demo';
  const restaurant = await getRestaurantBySlug(slug);
  if (!restaurant) return NextResponse.json({ success: false, error: 'Restaurant not found' }, { status: 404 });

  const admin = await requireAdmin(request);
  if (!admin) {
    const debug = {
      cookie_admin: request.cookies?.get('admin_token')?.value ? 'present' : 'missing',
      cookie_staff: request.cookies?.get('staff_token')?.value ? 'present' : 'missing',
      authHeader: request.headers.get('Authorization') ? 'present' : 'missing',
      authHeaderRaw: request.headers.get('Authorization')
    };
    return NextResponse.json({ success: false, error: 'Unauthorized', debug }, { status: 401 });
  }

  // Cross-tenant verification for staff
  if (admin.isStaff && admin.restaurantId && admin.restaurantId !== restaurant.id) {
    return NextResponse.json({ success: false, error: 'Forbidden: Wrong restaurant' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'dashboard';

    // Permission check for analytics
    let hasAnalyticsPerm = admin.isAdmin || (admin.permissions && (admin.permissions.includes('analytics') || admin.permissions.includes('*')));

    // If permissions not on token, fallback to database check for staff
    if (!hasAnalyticsPerm && admin.isStaff && admin.userId) {
      try {
        const staffRes = await pool.query(
          `SELECT r.permissions FROM staffs s
           LEFT JOIN roles r ON r.id = s.role_id
           WHERE s.id = $1`,
          [admin.userId]
        );
        if (staffRes.rows.length > 0 && staffRes.rows[0].permissions) {
          const dbPerms = Array.isArray(staffRes.rows[0].permissions)
            ? staffRes.rows[0].permissions
            : (typeof staffRes.rows[0].permissions === 'string' ? JSON.parse(staffRes.rows[0].permissions) : []);
          if (dbPerms.includes('analytics') || dbPerms.includes('*')) {
            hasAnalyticsPerm = true;
          }
        }
      } catch (err) {
        console.error('Error fetching staff permissions from DB in analytics route:', err);
      }
    }

    if (!hasAnalyticsPerm && type !== 'kitchen-snapshot') {
      return NextResponse.json({ success: false, error: 'Forbidden: Insufficient permissions for analytics' }, { status: 403 });
    }

    const { date_from, date_to } = getDateRange(request);

    if (type === 'dashboard') {
      const stats = await getDashboardStats(restaurant.id);
      return NextResponse.json({ success: true, data: stats });
    }
    if (type === 'daily') {
      const data = await getDailyAnalytics(restaurant.id, date_from, date_to);
      return NextResponse.json({ success: true, data });
    }
    if (type === 'peak-hours') {
      const data = await getPeakHours(restaurant.id, date_from, date_to);
      return NextResponse.json({ success: true, data });
    }
    if (type === 'top-products') {
      const limit = parseInt(searchParams.get('limit') || '10');
      const data = await getTopProducts(restaurant.id, date_from, date_to, limit);
      return NextResponse.json({ success: true, data });
    }
    if (type === 'kitchen-snapshot') {
      const bDate = searchParams.get('business_date') || undefined;
      const data = await getKitchenSnapshot(restaurant.id, bDate);
      return NextResponse.json({ success: true, data });
    }
    if (type === 'payment-methods') {
      const data = await getPaymentMethodAnalytics(restaurant.id, date_from, date_to);
      return NextResponse.json({ success: true, data });
    }

    return NextResponse.json({ success: false, error: 'Invalid analytics type' }, { status: 400 });
  } catch (error) {
    console.error('Analytics error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch analytics' }, { status: 500 });
  }
}

