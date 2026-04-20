import { NextRequest, NextResponse } from 'next/server';
import { generateOTP, generateOTPToken, sendOTPviaSMS } from '@/lib/auth';
import { validatePhone } from '@/lib/validators';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phone } = body;

    if (!phone) {
      return NextResponse.json({ success: false, error: 'Phone number is required' }, { status: 400 });
    }

    const validation = validatePhone(phone);
    if (!validation.valid) {
      return NextResponse.json({ success: false, error: validation.message }, { status: 400 });
    }

    const otp = generateOTP();
    const otp_token = await generateOTPToken(phone, otp, '1m');

    const smsSent = await sendOTPviaSMS(phone, otp);
    if (!smsSent) {
      return NextResponse.json({ success: false, error: 'Failed to send OTP. Please try again.' }, { status: 502 });
    }



    return NextResponse.json({
      success: true,
      message: 'OTP sent to your phone',
      otp_token,
      expires_in: 300,
    });
  } catch (error) {
    console.error('Send OTP error:', error);
    return NextResponse.json({ success: false, error: 'Failed to send OTP' }, { status: 500 });
  }
}
