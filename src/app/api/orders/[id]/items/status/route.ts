import { NextRequest, NextResponse } from 'next/server';
import { getRestaurantBySlug, updateOrderItemStatus } from '@/lib/db';
import { getAuthContext } from '@/lib/auth';
import { pusherServer } from '@/lib/pusher';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const slug = request.headers.get('x-restaurant-slug') || 'demo';
    const restaurant = await getRestaurantBySlug(slug);

    if (!restaurant) {
      return NextResponse.json({ success: false, error: 'Restaurant not found' }, { status: 404 });
    }

    const { admin } = await getAuthContext(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized: Admin or staff access required' }, { status: 401 });
    }

    if (admin.isStaff && admin.restaurantId !== restaurant.id) {
      return NextResponse.json({ success: false, error: 'Forbidden: Wrong restaurant' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { item_ids, counter, status } = body;

    if (!status || typeof status !== 'string') {
      return NextResponse.json({ success: false, error: 'Status is required' }, { status: 400 });
    }

    const updatedOrder = await updateOrderItemStatus(restaurant.id, id, {
      itemIds: Array.isArray(item_ids) ? item_ids : undefined,
      counter: typeof counter === 'string' && counter.trim() ? counter.trim() : undefined,
      status,
    });

    if (!updatedOrder) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
    }

    // Broadcast live event via Pusher
    try {
      await pusherServer.trigger(`queue-channel-${restaurant.id}`, 'order_update', {
        type: 'order_update',
        restaurant_id: restaurant.id,
        order_id: id,
        ticket_number: updatedOrder.ticket_number,
        new_status: updatedOrder.status,
        item_ids: Array.isArray(item_ids) ? item_ids : undefined,
        counter: typeof counter === 'string' ? counter : undefined,
        item_status: status.toUpperCase(),
        items: updatedOrder.items,
        table_number: updatedOrder.table_number,
        is_paid: updatedOrder.is_paid,
        timestamp: new Date().toISOString(),
      });
    } catch (pushErr) {
      console.error('❌ Pusher trigger failed on item status update:', pushErr);
    }

    return NextResponse.json({ success: true, data: updatedOrder });
  } catch (error: any) {
    console.error('Error updating order item status:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
}
