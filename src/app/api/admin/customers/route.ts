import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { verifyToken } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const cookieHeader = request.headers.get('cookie') || '';
    const adminToken = cookieHeader.split('; ').find(c => c.startsWith('admin_token='))?.split('=')[1];
    
    if (!adminToken) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await verifyToken(adminToken);
    if (!payload?.isAdmin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const search = searchParams.get('search') || '';
    const offset = (page - 1) * limit;

    let rows;
    let countResult;

    if (search) {
      const searchPattern = `%${search}%`;
      rows = await sql`
        SELECT 
          u.id, 
          u.name, 
          u.phone, 
          COUNT(o.id) FILTER (WHERE o.status = 'PAID' AND o.is_paid = true)::int as total_orders,
          COALESCE(SUM(o.total_price) FILTER (WHERE o.status = 'PAID' AND o.is_paid = true), 0) as total_spent,
          MAX(o.created_at) as last_order_date
        FROM users u
        LEFT JOIN orders o ON o.phone = u.phone
        WHERE u.name ILIKE ${searchPattern} OR u.phone ILIKE ${searchPattern}
        GROUP BY u.id
        ORDER BY total_orders DESC, u.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
      countResult = await sql`
        SELECT COUNT(*) FROM users 
        WHERE name ILIKE ${searchPattern} OR phone ILIKE ${searchPattern}
      `;
    } else {
      rows = await sql`
        SELECT 
          u.id, 
          u.name, 
          u.phone, 
          COUNT(o.id) FILTER (WHERE o.status = 'PAID' AND o.is_paid = true)::int as total_orders,
          COALESCE(SUM(o.total_price) FILTER (WHERE o.status = 'PAID' AND o.is_paid = true), 0) as total_spent,
          MAX(o.created_at) as last_order_date
        FROM users u
        LEFT JOIN orders o ON o.phone = u.phone
        GROUP BY u.id
        ORDER BY total_orders DESC, u.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
      countResult = await sql`SELECT COUNT(*) FROM users`;
    }

    const totalCount = parseInt(countResult[0].count, 10);

    return NextResponse.json({ 
      success: true, 
      data: rows,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error: any) {
    console.error('Error fetching customers:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
