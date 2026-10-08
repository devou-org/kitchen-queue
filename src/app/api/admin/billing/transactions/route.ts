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

    let whereClause = ` WHERE bt.restaurant_id = $1`;
    const txParams: any[] = [restaurant.id];
    let paramIndex = 2;

    if (dateFrom) {
      txParams.push(dateFrom);
      whereClause += ` AND bt.created_at >= $${paramIndex++}`;
    }
    if (dateTo) {
      txParams.push(dateTo);
      whereClause += ` AND bt.created_at <= $${paramIndex}::timestamp + interval '1 day' - interval '1 microsecond'`;
      paramIndex++;
    }

    const { pool } = await import('@/lib/db');

    const txCountQuery = `SELECT count(*) as total FROM billing_transactions bt ${whereClause}`;
    const txCountRes = await pool.query(txCountQuery, txParams);
    const totalTransactions = parseInt(txCountRes.rows[0]?.total || '0');

    const txDataQuery = `
      SELECT 
        bt.id, 
        bt.transaction_type, 
        bt.amount, 
        bt.reference_id, 
        bt.description, 
        bt.created_at,
        COALESCE(
          o.customer_name,
          (SELECT o2.customer_name FROM orders o2 WHERE o2.id::text = bt.reference_id LIMIT 1),
          (SELECT o3.customer_name FROM otp_logs ol JOIN orders o3 ON o3.phone = ol.phone WHERE ol.id::text = bt.reference_id AND o3.restaurant_id = bt.restaurant_id ORDER BY o3.created_at DESC LIMIT 1),
          (SELECT u.name FROM otp_logs ol2 JOIN users u ON u.phone = ol2.phone WHERE ol2.id::text = bt.reference_id LIMIT 1)
        ) AS customer_name,
        COALESCE(
          o.ticket_number,
          (SELECT o2.ticket_number FROM orders o2 WHERE o2.id::text = bt.reference_id LIMIT 1),
          (SELECT o3.ticket_number FROM otp_logs ol JOIN orders o3 ON o3.phone = ol.phone WHERE ol.id::text = bt.reference_id AND o3.restaurant_id = bt.restaurant_id ORDER BY o3.created_at DESC LIMIT 1)
        ) AS ticket_number,
        COALESCE(
          o.id::text,
          (SELECT o2.id::text FROM orders o2 WHERE o2.id::text = bt.reference_id LIMIT 1),
          (SELECT o3.id::text FROM otp_logs ol JOIN orders o3 ON o3.phone = ol.phone WHERE ol.id::text = bt.reference_id AND o3.restaurant_id = bt.restaurant_id ORDER BY o3.created_at DESC LIMIT 1)
        ) AS order_id
      FROM billing_transactions bt
      LEFT JOIN orders o ON o.id::text = bt.reference_id
      ${whereClause}
      ORDER BY bt.created_at DESC 
      LIMIT ${limit} OFFSET ${offset}
    `;

    const txRes = await pool.query(txDataQuery, txParams);
    const transactions = txRes.rows;

    return NextResponse.json({
      success: true,
      data: {
        transactions,
        totalTransactions
      }
    });
  } catch (error: any) {
    console.error('Error fetching admin billing transactions:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
