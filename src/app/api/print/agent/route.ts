import { NextRequest, NextResponse } from 'next/server';
import {
  getRestaurantBySlug,
  getAgentHeartbeat,
  updateAgentHeartbeat,
  getPendingPrintJobs,
  getPrintJobById,
  completePrintJob,
} from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

let hasWarnedSecret = false;
function warnSecretMissingOnce() {
  if (!hasWarnedSecret) {
    hasWarnedSecret = true;
    console.warn('⚠️ PRINT_AGENT_SECRET is not set in environment. Allowing agent poll/heartbeat without secret.');
  }
}

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
 * - Used by UI to check agent status (heartbeat) - Public (non-sensitive health status)
 * - Used by agent to poll pending print jobs - Requires x-print-agent-secret
 * - Used by hub to fetch pending print jobs - Requires admin/staff auth
 * - Used by print station to fetch large print job payload - Requires admin/staff auth
 */
export async function GET(request: NextRequest) {
  try {
    const restaurant = await resolveRestaurant(request);
    if (!restaurant) {
      return NextResponse.json({ success: false, error: 'Restaurant not found' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId');

    // If fetching a specific print job by id: requires admin/staff auth
    if (jobId) {
      const admin = await requireAdmin(request);
      if (!admin) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
      }
      if (!admin.isSuperAdmin && admin.restaurantId && admin.restaurantId !== restaurant.id) {
        return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
      }

      const job = await getPrintJobById(restaurant.id, jobId);
      return NextResponse.json({
        success: true,
        job,
      });
    }

    const mode = searchParams.get('mode'); // 'poll' | 'pending' | 'status'

    // If agent is polling for jobs: requires x-print-agent-secret
    if (mode === 'poll') {
      const secret = process.env.PRINT_AGENT_SECRET;
      if (secret) {
        const clientSecret = request.headers.get('x-print-agent-secret');
        if (clientSecret !== secret) {
          return NextResponse.json({ success: false, error: 'Unauthorized agent secret' }, { status: 401 });
        }
      } else {
        warnSecretMissingOnce();
      }

      const printerName = searchParams.get('printer') || 'POS-80C';
      const ip = request.headers.get('x-forwarded-for') || '';
      await updateAgentHeartbeat(restaurant.id, printerName, ip);

      const jobs = await getPendingPrintJobs(restaurant.id);
      return NextResponse.json({
        success: true,
        jobs: jobs || [],
      });
    }

    // If print hub is querying pending jobs for missed-print recovery: requires admin/staff auth
    if (mode === 'pending') {
      const admin = await requireAdmin(request);
      if (!admin) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
      }
      if (!admin.isSuperAdmin && admin.restaurantId && admin.restaurantId !== restaurant.id) {
        return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
      }

      const jobs = await getPendingPrintJobs(restaurant.id);
      return NextResponse.json({
        success: true,
        jobs: jobs || [],
      });
    }

    // Otherwise return agent health status for UI (Public, non-sensitive)
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
 * - Heartbeat from agent (Requires x-print-agent-secret)
 * - Complete job from agent or hub (Requires admin/staff auth)
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
      const secret = process.env.PRINT_AGENT_SECRET;
      if (secret) {
        const clientSecret = request.headers.get('x-print-agent-secret');
        if (clientSecret !== secret) {
          return NextResponse.json({ success: false, error: 'Unauthorized agent secret' }, { status: 401 });
        }
      } else {
        warnSecretMissingOnce();
      }

      const ip = request.headers.get('x-forwarded-for') || '';
      const updated = await updateAgentHeartbeat(restaurant.id, printerName || 'POS-80C', ip);
      return NextResponse.json({ success: true, data: updated });
    }

    if (action === 'complete' && jobId) {
      const admin = await requireAdmin(request);
      if (!admin) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
      }
      if (!admin.isSuperAdmin && admin.restaurantId && admin.restaurantId !== restaurant.id) {
        return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
      }

      await completePrintJob(restaurant.id, jobId);
      return NextResponse.json({ success: true, completed: jobId });
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
