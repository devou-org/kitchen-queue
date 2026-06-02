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
    const offset = (page - 1) * limit;

    const rows = await sql`
      SELECT 
        r.*, 
        u.name as user_name, 
        u.phone as user_phone, 
        o.ticket_number
      FROM reviews r
      LEFT JOIN users u ON u.id = r.user_id
      LEFT JOIN orders o ON o.id = r.order_id
      ORDER BY r.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const countResult = await sql`SELECT COUNT(*) FROM reviews`;
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
    console.error('Error fetching reviews:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
