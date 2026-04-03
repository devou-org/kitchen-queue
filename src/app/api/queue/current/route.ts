import { NextResponse } from 'next/server';
import { getQueueState } from '@/lib/db';

export async function GET() {
  try {
    const state = await getQueueState();
    return NextResponse.json({ success: true, data: state });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to get queue state' }, { status: 500 });
  }
}
