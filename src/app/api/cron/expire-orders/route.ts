import { NextRequest, NextResponse } from 'next/server';
import { expireOldOrders } from '@/lib/db';

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');

  // Vercel Cron jobs send a specific bearer token if configured, 
  // but for now we'll allow it or check a secret if provided in env
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const result = await expireOldOrders();
    const parts = [];
    if (result.closedCount) parts.push(`closed ${result.closedCount} paid order(s)`);
    if (result.expiredCount) parts.push(`expired ${result.expiredCount} unpaid order(s)`);
    const details = parts.length > 0 ? parts.join(', ') : '0 orders processed';
    
    return NextResponse.json({
      success: true,
      message: `Successfully processed old orders (${details}).`,
      expiredCount: result.expiredCount,
      closedCount: result.closedCount,
      totalProcessed: result.totalProcessed,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Cron job error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
