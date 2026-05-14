import { NextRequest, NextResponse } from 'next/server';
import { verifyOTPToken, generateAccessToken, generateRefreshToken } from '@/lib/auth';
import sql, { getUserByPhone, createUser } from '@/lib/db';
import { validateOTP } from '@/lib/validators';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code, otp_token } = body;

    if (!otp_token || !code) {
      return NextResponse.json({ success: false, error: 'OTP token and OTP code are required' }, { status: 400 });
    }

    const otpValidation = validateOTP(code);
    if (!otpValidation.valid) {
      return NextResponse.json({ success: false, error: otpValidation.message }, { status: 400 });
    }

    const otpPayload = await verifyOTPToken(otp_token);
    if (!otpPayload) {
      return NextResponse.json({ success: false, error: 'OTP token is invalid or expired' }, { status: 401 });
    }

    if (otpPayload.otp !== code) {
      return NextResponse.json({ success: false, error: 'Invalid OTP' }, { status: 401 });
    }

    const phone = otpPayload.phone;

    // Get or create user
    let user = await getUserByPhone(phone);
    if (!user) {
      user = await createUser(phone);
    }

    // User is considered verified because we are issuing tokens after successful OTP check

    const token = await generateAccessToken({
      userId: user.id,
      phone: user.phone,
      isAdmin: user.is_admin || false,
    }, '1d');

    const refreshToken = await generateRefreshToken({
      userId: user.id,
      tokenVersion: user.refresh_token_version || 1,
    }, '30d');

    const response = NextResponse.json({
      success: true,
      token, // access token
      user: {
        id: user.id,
        phone: user.phone,
        name: user.name,
        is_admin: user.is_admin,
      },
    });

    // Set auth_token (access token) cookie (optional, primarily for frontend JS access if needed)
    response.cookies.set('auth_token', token, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60, // 1 day
      path: '/',
    });

    // Set refresh_token cookie (Strictly HttpOnly)
    response.cookies.set('refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax', // or 'strict'
      maxAge: 30 * 24 * 60 * 60, // 30 days
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Verify OTP error:', error);
    return NextResponse.json({ success: false, error: 'Verification failed' }, { status: 500 });
  }
}
 
