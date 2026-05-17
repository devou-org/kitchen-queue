import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';

async function requireSuperAdmin(request: NextRequest) {
  const token = request.cookies.get('super_admin_token')?.value
    || request.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload?.isSuperAdmin) return null;
  return payload;
}

export async function GET(request: NextRequest) {
  const admin = await requireSuperAdmin(request);
  if (!admin) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const apiKey = process.env.FAST2SMS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ success: false, error: 'FAST2SMS_API_KEY is not configured in .env.local' });
  }

  try {
    const res = await fetch(`https://www.fast2sms.com/dev/wallet?authorization=${apiKey}`, {
      method: 'GET',
      headers: {
        'accept': 'application/json'
      },
      next: { revalidate: 60 } // Cache balance for 60 seconds
    });

    const data = await res.json();
    
    if (data && typeof data.wallet !== 'undefined') {
      return NextResponse.json({
        success: true,
        wallet: data.wallet // In Fast2SMS this is a decimal number representing the remaining balance in INR
      });
    }

    return NextResponse.json({ success: false, error: 'Invalid response from Fast2SMS API', raw: data });
  } catch (error: any) {
    console.error('Fast2SMS Wallet API error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Failed to connect to Fast2SMS API' }, { status: 500 });
  }
}
