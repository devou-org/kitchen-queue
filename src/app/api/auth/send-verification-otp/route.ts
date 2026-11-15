import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { AuthTokenService } from '@/modules/auth/auth-token.service';
import { emailService } from '@/modules/email/email.service';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

// POST /api/auth/send-verification-otp - Send email verification OTP
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, restaurant_name } = body;

    if (!email || typeof email !== 'string' || !email.trim()) {
      return NextResponse.json(
        { success: false, error: 'Email is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    const cleanEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      return NextResponse.json(
        { success: false, error: 'Invalid email address format' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Check if email is already in use by an existing admin account
    const existingAdmin = await pool.query(
      `SELECT id FROM admins WHERE LOWER(email) = $1 LIMIT 1`,
      [cleanEmail]
    );

    if (existingAdmin.rows.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'An account with this email already exists. Please log in or use forgot password.',
        },
        { status: 409, headers: corsHeaders }
      );
    }

    // Generate 6-digit OTP (valid 10 minutes)
    const otp = await AuthTokenService.createVerificationOtp(cleanEmail, 'EMAIL_VERIFICATION', 10);

    // Dispatch verification email via Dependency-Injected EmailService
    const emailResult = await emailService.sendEmailVerificationOtp(cleanEmail, otp, restaurant_name);

    if (!emailResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: emailResult.error || 'Failed to dispatch verification email',
        },
        { status: 500, headers: corsHeaders }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Email verification code sent successfully',
        data: {
          email: cleanEmail,
          expires_in_minutes: 10,
          provider: emailService.getProviderName(),
        },
      },
      { status: 200, headers: corsHeaders }
    );
  } catch (error: any) {
    console.error('Send verification OTP error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to send verification email' },
      { status: 500, headers: corsHeaders }
    );
  }
}
