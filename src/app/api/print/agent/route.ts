import { NextRequest, NextResponse } from 'next/server';
import {
  getRestaurantBySlug,
  getAgentHeartbeat,
  updateAgentHeartbeat,
  getPendingPrintJobs,
  completePrintJob,
} from '@/lib/db';

async function resolveRestaurant(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get('slug') || request.headers.get('x-restaurant-slug');
  if (slug) {
    return await getRestaurantBySlug(slug);
  }
  return null;
}

/**
 * GET /api/print/agent
 * - Used by UI to check agent status (heartbeat)
 * - Used by agent to poll pending print jobs
 */
export async function GET(request: NextRequest) {
  try {
    const restaurant = await resolveRestaurant(request);
    if (!restaurant) {
      return NextResponse.json({ success: false, error: 'Restaurant not found' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('mode'); // 'poll' or 'status'

    // If agent is polling for jobs
    if (mode === 'poll') {
      const printerName = searchParams.get('printer') || 'POS-80C';
      const ip = request.headers.get('x-forwarded-for') || '';
      await updateAgentHeartbeat(restaurant.id, printerName, ip);

      const jobs = await getPendingPrintJobs(restaurant.id);
      return NextResponse.json({
        success: true,
        jobs: jobs || [],
      });
    }

    // Otherwise return agent health status for UI
    const heartbeat = await getAgentHeartbeat(restaurant.id);
    return NextResponse.json({
      success: true,
      online: Boolean(heartbeat?.is_online),
      secondsAgo: heartbeat?.seconds_ago ?? null,
      printerName: heartbeat?.printer_name || 'POS-80C',
      lastHeartbeat: heartbeat?.last_heartbeat || null,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

/**
 * POST /api/print/agent
 * - Heartbeat from agent
 * - Complete job from agent
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { slug, action, jobId, printerName } = body;

    const restaurant = await getRestaurantBySlug(slug);
    if (!restaurant) {
      return NextResponse.json({ success: false, error: 'Restaurant not found' }, { status: 404 });
    }

    if (action === 'heartbeat') {
      const ip = request.headers.get('x-forwarded-for') || '';
      const updated = await updateAgentHeartbeat(restaurant.id, printerName || 'POS-80C', ip);
      return NextResponse.json({ success: true, data: updated });
    }

    if (action === 'complete' && jobId) {
      await completePrintJob(restaurant.id, jobId);
      return NextResponse.json({ success: true, completed: jobId });
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
