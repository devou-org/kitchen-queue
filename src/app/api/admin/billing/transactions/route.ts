import { NextRequest, NextResponse } from 'next/server';
import { getRestaurantBySlug } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const slug = request.headers.get('x-restaurant-slug') || 'demo';
    const restaurant = await getRestaurantBySlug(slug);
    
    if (!restaurant) {
      return NextResponse.json({ success: false, error: 'Restaurant not found' }, { status: 404 });
    }

    const admin = await requireAdmin(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = (page - 1) * limit;

    let txQuery = `
      SELECT 
        bt.id, 
        bt.transaction_type, 
        bt.amount, 
        bt.reference_id, 
        bt.description, 
        bt.created_at,
        COALESCE(u.name, ord.customer_name, o_direct.customer_name) AS customer_name,
        ol.phone AS customer_phone
      FROM billing_transactions bt
      LEFT JOIN otp_logs ol ON (bt.transaction_type = 'OTP' AND bt.reference_id = ol.id::text)
      LEFT JOIN users u ON (
        ol.phone IS NOT NULL AND (
          u.phone = ol.phone 
          OR u.phone = REPLACE(ol.phone, '+91', '')
          OR ol.phone = REPLACE(u.phone, '+91', '')
        )
      )
      LEFT JOIN LATERAL (
        SELECT o.customer_name 
        FROM orders o 
        WHERE ol.phone IS NOT NULL AND (
          o.phone = ol.phone 
          OR o.phone = REPLACE(ol.phone, '+91', '')
          OR ol.phone = REPLACE(o.phone, '+91', '')
        )
        ORDER BY o.created_at DESC 
        LIMIT 1
      ) ord ON true
      LEFT JOIN orders o_direct ON (
        bt.transaction_type = 'PER_ORDER' AND bt.reference_id = o_direct.id::text
      )
      WHERE bt.restaurant_id = $1
    `;
    const txParams: any[] = [restaurant.id];
    let paramIndex = 2;

    if (dateFrom) {
      txParams.push(dateFrom);
      txQuery += ` AND bt.created_at >= $${paramIndex++}`;
    }
    if (dateTo) {
      txParams.push(dateTo);
      txQuery += ` AND bt.created_at <= $${paramIndex}::timestamp + interval '1 day' - interval '1 microsecond'`;
      paramIndex++;
    }

    const { pool } = await import('@/lib/db');

    // Aggregate OTP stats for the filtered date range
    let otpStatsQuery = `
      SELECT 
        COUNT(*)::int as count,
        COALESCE(SUM(amount), 0)::float as amount
      FROM billing_transactions
      WHERE restaurant_id = $1 AND transaction_type = 'OTP'
    `;
    const otpStatsParams: any[] = [restaurant.id];
    let otpParamIndex = 2;
    if (dateFrom) {
      otpStatsParams.push(dateFrom);
      otpStatsQuery += ` AND created_at >= $${otpParamIndex++}`;
    }
    if (dateTo) {
      otpStatsParams.push(dateTo);
      otpStatsQuery += ` AND created_at <= $${otpParamIndex}::timestamp + interval '1 day' - interval '1 microsecond'`;
      otpParamIndex++;
    }
    const otpStatsRes = await pool.query(otpStatsQuery, otpStatsParams);
    const otpStats = {
      count: parseInt(otpStatsRes.rows[0]?.count || '0'),
      amount: parseFloat(otpStatsRes.rows[0]?.amount || '0')
    };

    const txCountQuery = `SELECT count(*) as total FROM (${txQuery}) as sub`;
    const txCountRes = await pool.query(txCountQuery, txParams);
    const totalTransactions = parseInt(txCountRes.rows[0]?.total || '0');

    txQuery += ` ORDER BY bt.created_at DESC LIMIT ${limit} OFFSET ${offset}`;
    const txRes = await pool.query(txQuery, txParams);
    const transactions = txRes.rows;

    return NextResponse.json({
      success: true,
      data: {
        transactions,
        totalTransactions,
        otpStats
      }
    });
  } catch (error: any) {
    console.error('Error fetching admin billing transactions:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
