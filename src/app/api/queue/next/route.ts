import { NextRequest, NextResponse } from 'next/server';
import { advanceQueue } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { pusherServer } from '@/lib/pusher';

export async function POST(request: NextRequest) {
  try {
    const adminToken = request.cookies.get('admin_token')?.value;
    const authHeader = request.headers.get('Authorization')?.replace('Bearer ', '');
    const token = adminToken || authHeader;

    if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const payload = await verifyToken(token);
    if (!payload?.isAdmin) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });

    const state = await advanceQueue();

    // Broadcast to all connected customers via Pusher
    await pusherServer.trigger('queue-channel', 'queue_update', {
      type: 'queue_update',
      queue_number: state.current_queue_number,
      last_served_number: state.last_served_number,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      queue_number: state.current_queue_number,
      message: `Queue advanced to #${state.current_queue_number}`,
    });
  } catch (error) {
    console.error('Advance queue error:', error);
    return NextResponse.json({ success: false, border: false, error: error instanceof Error ? error.message : 'Failed to advance queue' }, { status: 400 });
  }
}
