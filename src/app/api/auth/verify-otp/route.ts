import { NextRequest, NextResponse } from 'next/server';
import { verifyOTPCode, generateToken } from '@/lib/auth';
import { getUserByPhone, createUser } from '@/lib/db';
import { validatePhone, validateOTP } from '@/lib/validators';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phone, code } = body;

    if (!phone || !code) {
      return NextResponse.json({ success: false, error: 'Phone and OTP code are required' }, { status: 400 });
    }

    const phoneValidation = validatePhone(phone);
    if (!phoneValidation.valid) {
      return NextResponse.json({ success: false, error: phoneValidation.message }, { status: 400 });
    }

    const otpValidation = validateOTP(code);
    if (!otpValidation.valid) {
      return NextResponse.json({ success: false, error: otpValidation.message }, { status: 400 });
    }

    const result = verifyOTPCode(phone, code);
    if (!result.valid) {
      return NextResponse.json({ success: false, error: result.message }, { status: 401 });
    }

    // Get or create user
    let user = await getUserByPhone(phone);
    if (!user) {
      user = await createUser(phone);
    }

    const token = await generateToken({
      userId: user.id,
      phone: user.phone,
      isAdmin: user.is_admin || false,
    }, '7d');

    const response = NextResponse.json({
      success: true,
      token,
      user: {
        id: user.id,
        phone: user.phone,
        name: user.name,
        is_admin: user.is_admin,
      },
    });

    // Set cookie
    response.cookies.set('auth_token', token, {
      httpOnly: false, // Set to false so client-side can check it or just rely on localStorage
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Verify OTP error:', error);
    return NextResponse.json({ success: false, error: 'Verification failed' }, { status: 500 });
  }
}
