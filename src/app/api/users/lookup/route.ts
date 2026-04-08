import { NextRequest, NextResponse } from 'next/server';
import { getUserByName } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const name = searchParams.get('name');

    if (!name || name.length < 2) {
      return NextResponse.json({ success: true, data: null });
    }

    const user = await getUserByName(name.trim());
    return NextResponse.json({ success: true, data: user });
  } catch (error) {
    console.error('User lookup error:', error);
    return NextResponse.json({ success: false, error: 'Lookup failed' }, { status: 500 });
  }
}
