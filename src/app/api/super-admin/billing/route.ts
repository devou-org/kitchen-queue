import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import { verifyToken } from '@/lib/auth';

async function requireSuperAdmin(request: NextRequest) {
  const token = request.cookies.get('super_admin_token')?.value
    || request.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload?.isSuperAdmin) return null;
  return payload;
}

export async function GET(request: NextRequest) {
  const admin = await requireSuperAdmin(request);
  if (!admin) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 1. Fetch all restaurants with basic billing info
    const restaurants = await sql`
      SELECT id, name, slug, billing_tier, billing_model, billing_status, billing_start_date, billing_end_date
      FROM restaurants
      ORDER BY name ASC
    `;

    // 2. Fetch all monthly summaries with restaurant details
    const summaries = await sql`
      SELECT 
        m.*,
        r.name AS restaurant_name,
        r.slug AS restaurant_slug
      FROM monthly_billing_summary m
      JOIN restaurants r ON m.restaurant_id = r.id
      ORDER BY m.year DESC, m.month DESC
    `;

    // 3. Fetch latest 100 transactions with restaurant details
    const transactions = await sql`
      SELECT 
        t.*,
        r.name AS restaurant_name,
        r.slug AS restaurant_slug
      FROM billing_transactions t
      JOIN restaurants r ON t.restaurant_id = r.id
      ORDER BY t.created_at DESC
      LIMIT 100
    `;

    // 4. Calculate total revenue stats (sum of all summaries)
    const revenueStats = await sql`
      SELECT 
        COALESCE(SUM(order_charges), 0) AS total_order_charges,
        COALESCE(SUM(otp_charges), 0) AS total_otp_charges,
        COALESCE(SUM(subscription_charges), 0) AS total_subscription_charges,
        COALESCE(SUM(adjustments), 0) AS total_adjustments,
        COALESCE(SUM(total_amount), 0) AS total_revenue
      FROM monthly_billing_summary
    `;

    return NextResponse.json({
      success: true,
      data: {
        restaurants,
        summaries,
        transactions,
        revenueStats: revenueStats[0] || {
          total_order_charges: 0,
          total_otp_charges: 0,
          total_subscription_charges: 0,
          total_adjustments: 0,
          total_revenue: 0,
        }
      }
    });
  } catch (error: any) {
    console.error('Error fetching super admin billing details:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST /api/super-admin/billing/adjustment — allow Super Admin to add adjustments
export async function POST(request: NextRequest) {
  const admin = await requireSuperAdmin(request);
  if (!admin) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { restaurant_id, amount, description } = await request.json();
    if (!restaurant_id || typeof amount !== 'number' || !description) {
      return NextResponse.json({ success: false, error: 'restaurant_id, amount (number) and description are required.' }, { status: 400 });
    }

    const { BillingService } = await import('@/modules/billing/billing.service');
    await BillingService.processAdjustment(restaurant_id, amount, description);

    return NextResponse.json({ success: true, message: 'Adjustment processed successfully.' });
  } catch (error: any) {
    console.error('Error adding adjustment:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
