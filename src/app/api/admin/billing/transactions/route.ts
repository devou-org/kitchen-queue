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
      SELECT id, transaction_type, amount, reference_id, description, created_at
      FROM billing_transactions
      WHERE restaurant_id = $1
    `;
    const txParams: any[] = [restaurant.id];
    let paramIndex = 2;

    if (dateFrom) {
      txParams.push(dateFrom);
      txQuery += ` AND created_at >= $${paramIndex++}`;
    }
    if (dateTo) {
      txParams.push(dateTo);
      txQuery += ` AND created_at <= $${paramIndex}::timestamp + interval '1 day' - interval '1 microsecond'`;
      paramIndex++;
    }

    const { pool } = await import('@/lib/db');

    const txCountQuery = `SELECT count(*) as total FROM (${txQuery}) as sub`;
    const txCountRes = await pool.query(txCountQuery, txParams);
    const totalTransactions = parseInt(txCountRes.rows[0]?.total || '0');

    txQuery += ` ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`;
    const txRes = await pool.query(txQuery, txParams);
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
