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
    const { searchParams } = new URL(request.url);
    const restaurantId = searchParams.get('restaurantId');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;

    // 1. Fetch all restaurants with basic billing info
    let restQuery = `
      SELECT id, name, slug, billing_tier, billing_model, billing_status, billing_start_date, billing_end_date
      FROM restaurants
    `;
    const restParams: any[] = [];
    if (restaurantId) {
      restParams.push(restaurantId);
      restQuery += ` WHERE id = $1 `;
    }
    restQuery += ` ORDER BY name ASC`;
    const { pool } = await import('@/lib/db');
    const resRes = await pool.query(restQuery, restParams);
    const restaurants = resRes.rows;

    // 2. Fetch all monthly summaries with restaurant details
    let sumQuery = `
      SELECT 
        m.*,
        r.name AS restaurant_name,
        r.slug AS restaurant_slug
      FROM monthly_billing_summary m
      JOIN restaurants r ON m.restaurant_id = r.id
    `;
    const sumParams: any[] = [];
    if (restaurantId) {
      sumParams.push(restaurantId);
      sumQuery += ` WHERE m.restaurant_id = $1 `;
    }
    sumQuery += ` ORDER BY m.year DESC, m.month DESC`;
    const sumRes = await pool.query(sumQuery, sumParams);
    const summaries = sumRes.rows;

    // 3. Fetch transactions with restaurant details, pagination, and date filtering
    let txQuery = `
      SELECT 
        t.*,
        r.name AS restaurant_name,
        r.slug AS restaurant_slug
      FROM billing_transactions t
      JOIN restaurants r ON t.restaurant_id = r.id
      WHERE 1=1
    `;
    const txParams: any[] = [];
    let paramIndex = 1;

    if (restaurantId) {
      txParams.push(restaurantId);
      txQuery += ` AND t.restaurant_id = $${paramIndex++}`;
    }
    if (dateFrom) {
      txParams.push(dateFrom);
      txQuery += ` AND t.created_at >= $${paramIndex++}`;
    }
    if (dateTo) {
      txParams.push(dateTo);
      txQuery += ` AND t.created_at <= $${paramIndex}::timestamp + interval '1 day' - interval '1 microsecond'`;
      paramIndex++;
    }

    const txCountQuery = `SELECT count(*) as total FROM (${txQuery}) as sub`;
    const txCountRes = await pool.query(txCountQuery, txParams);
    const totalTransactions = parseInt(txCountRes.rows[0]?.total || '0');

    txQuery += ` ORDER BY t.created_at DESC LIMIT ${limit} OFFSET ${offset}`;
    const txRes = await pool.query(txQuery, txParams);
    const transactions = txRes.rows;

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
        totalTransactions,
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
