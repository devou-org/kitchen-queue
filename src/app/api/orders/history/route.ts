import { NextRequest, NextResponse } from 'next/server';
import { getOrdersByPhone } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const phone = searchParams.get('phone');

    if (!phone) {
      return NextResponse.json({ success: false, error: 'Phone number is required' }, { status: 400 });
    }

    const orders = await getOrdersByPhone(phone);
    return NextResponse.json({ success: true, data: orders });
  } catch (error) {
    console.error('History fetch error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch history' }, { status: 500 });
  }
}
