import { NextRequest, NextResponse } from 'next/server';
import { getOtpStats } from '@/lib/db';
import { jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'fallback-secret-change-in-production-32chars!!'
);

export async function GET(request: NextRequest) {
  try {
    // 1. Basic Admin Auth Check
    const token = request.cookies.get('admin_token')?.value;
    if (!token) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    try {
      await jwtVerify(token, JWT_SECRET);
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid session' }, { status: 401 });
    }

    // 2. Get Range from query params
    const { searchParams } = new URL(request.url);
    const dateFrom = searchParams.get('date_from');
    const dateTo = searchParams.get('date_to');

    if (!dateFrom || !dateTo) {
      return NextResponse.json({ success: false, error: 'Date range required' }, { status: 400 });
    }

    // 3. Fetch Stats
    const stats = await getOtpStats(dateFrom, dateTo);
    
    const totalCount = stats.reduce((sum, s) => sum + (s.count || 0), 0);
    const totalCost = stats.reduce((sum, s) => sum + parseFloat(s.cost || '0'), 0);

    return NextResponse.json({
      success: true,
      data: stats,
      summary: {
        total_otps: totalCount,
        total_cost: totalCost,
        rate_per_otp: 0.50
      }
    });
  } catch (error) {
    console.error('OTP Stats error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch stats' }, { status: 500 });
  }
}
