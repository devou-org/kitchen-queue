import { NextRequest, NextResponse } from 'next/server';
import { QueueService } from '@/modules/queue/queue.service';
import { verifyToken } from '@/lib/auth';

async function requireSuperAdmin(request: NextRequest) {
  const token = request.cookies.get('super_admin_token')?.value
    || request.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload?.isSuperAdmin) return null;
  return payload;
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireSuperAdmin(req);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { restaurantId, statusEnum, color } = await req.json();

    if (!restaurantId || !statusEnum) {
      return NextResponse.json({ success: false, error: 'restaurantId and statusEnum required' }, { status: 400 });
    }

    await QueueService.addQueueStatus(restaurantId, statusEnum, color || '#cbd5e1');

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Add Queue Status Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const admin = await requireSuperAdmin(req);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const restaurantId = searchParams.get('restaurantId');
    if (!restaurantId) {
      return NextResponse.json({ success: false, error: 'restaurantId required' }, { status: 400 });
    }

    const statuses = await QueueService.getQueueStatuses(restaurantId);
    return NextResponse.json({ success: true, data: statuses });
  } catch (error: any) {
    console.error('Fetch Queue Statuses Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const admin = await requireSuperAdmin(req);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const statusId = searchParams.get('statusId');
    const restaurantId = searchParams.get('restaurantId');
    
    if (!statusId || !restaurantId) {
      return NextResponse.json({ success: false, error: 'statusId and restaurantId required' }, { status: 400 });
    }

    const deleted = await QueueService.deleteQueueStatus(statusId, restaurantId);
    if (!deleted) {
       return NextResponse.json({ success: false, error: 'Status not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Delete Queue Status Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
