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

// POST /api/auth/forgot-password - Trigger password reset OTP
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email || typeof email !== 'string' || !email.trim()) {
      return NextResponse.json(
        { success: false, error: 'Email is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    const cleanEmail = email.trim().toLowerCase();

    // Query admin account & restaurant name
    const adminRes = await pool.query(
      `SELECT a.id, a.name, a.email, r.name as restaurant_name
       FROM admins a
       LEFT JOIN restaurants r ON a.restaurant_id = r.id
       WHERE LOWER(a.email) = $1
       LIMIT 1`,
      [cleanEmail]
    );

    // If account exists, generate reset code and dispatch email
    if (adminRes.rows.length > 0) {
      const admin = adminRes.rows[0];
      const otp = await AuthTokenService.createVerificationOtp(cleanEmail, 'PASSWORD_RESET', 15);

      await emailService.sendPasswordResetOtp(
        cleanEmail,
        otp,
        undefined,
        admin.restaurant_name || 'Qdine POS'
      );
    }

    // Always return generic success to prevent email enumeration attacks
    return NextResponse.json(
      {
        success: true,
        message: 'If an account exists with this email address, a password reset code has been sent.',
      },
      { status: 200, headers: corsHeaders }
    );
  } catch (error: any) {
    console.error('Forgot password error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to process password reset request' },
      { status: 500, headers: corsHeaders }
    );
  }
}
