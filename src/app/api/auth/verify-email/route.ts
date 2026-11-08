import { NextRequest, NextResponse } from 'next/server';
import { AuthTokenService } from '@/modules/auth/auth-token.service';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

// POST /api/auth/verify-email - Verify Email OTP
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, otp } = body;

    if (!email || !otp) {
      return NextResponse.json(
        { success: false, error: 'Both email and otp are required' },
        { status: 400, headers: corsHeaders }
      );
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanOtp = String(otp).trim();

    // Verify and consume OTP
    const isValid = await AuthTokenService.verifyAndConsumeOtp(
      cleanEmail,
      cleanOtp,
      'EMAIL_VERIFICATION'
    );

    if (!isValid) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired verification code' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Mark admin email as verified in database (if admin record exists)
    await AuthTokenService.markAdminEmailVerified(cleanEmail);

    return NextResponse.json(
      {
        success: true,
        message: 'Email verified successfully',
        data: {
          email: cleanEmail,
          verified: true,
        },
      },
      { status: 200, headers: corsHeaders }
    );
  } catch (error: any) {
    console.error('Verify email error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to verify email' },
      { status: 500, headers: corsHeaders }
    );
  }
}
