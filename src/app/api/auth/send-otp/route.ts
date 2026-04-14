import { NextRequest, NextResponse } from 'next/server';
import { generateOTP, storeOTP, canSendOTP, sendOTPviaSMS } from '@/lib/auth';
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

    if (!canSendOTP(phone)) {
      return NextResponse.json({
        success: false,
        error: 'Please wait 60 seconds before requesting another OTP'
      }, { status: 429 });
    }

    const otp = generateOTP();
    storeOTP(phone, otp);

    // Try sending SMS, if fails, log the OTP in dev mode
    const smsSent = await sendOTPviaSMS(phone, otp);



    return NextResponse.json({
      success: true,
      message: 'OTP sent to your phone',
      expires_in: 600,
    });
  } catch (error) {
    console.error('Send OTP error:', error);
    return NextResponse.json({ success: false, error: 'Failed to send OTP' }, { status: 500 });
  }
}
