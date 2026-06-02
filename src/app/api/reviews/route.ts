import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { verifyToken } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const cookieHeader = request.headers.get('cookie') || '';
    const token = cookieHeader.split('; ').find(c => c.startsWith('auth_token='))?.split('=')[1];
    
    let userId = null;
    if (token) {
      try {
        const payload = await verifyToken(token);
        userId = payload?.userId || null;
      } catch (e) {}
    }

    const { orderId, rating, comment } = await request.json();

    if (!orderId || !rating || rating < 1 || rating > 5) {
      return NextResponse.json({ success: false, error: 'Invalid input' }, { status: 400 });
    }

    // Verify the order exists
    const orders = await sql`
      SELECT id, user_id FROM orders 
      WHERE id = ${orderId} 
    `;
    if (orders.length === 0) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
    }
    
    const finalUserId = userId || orders[0].user_id || null;

    // Check if review already exists
    const existing = await sql`SELECT id FROM reviews WHERE order_id = ${orderId}`;
    if (existing.length > 0) {
      return NextResponse.json({ success: false, error: 'Review already submitted for this order' }, { status: 400 });
    }

    const rows = await sql`
      INSERT INTO reviews (user_id, order_id, rating, comment)
      VALUES (${finalUserId}, ${orderId}, ${rating}, ${comment || null})
      RETURNING *
    `;

    return NextResponse.json({ success: true, data: rows[0] });
  } catch (error: any) {
    console.error('Error submitting review:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
