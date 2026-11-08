import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
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

// POST /api/auth/reset-password - Verify reset code and update password
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, otp, new_password } = body;

    if (!email || !otp || !new_password) {
      return NextResponse.json(
        { success: false, error: 'email, otp, and new_password are required' },
        { status: 400, headers: corsHeaders }
      );
    }

    if (typeof new_password !== 'string' || new_password.length < 6) {
      return NextResponse.json(
        { success: false, error: 'Password must be at least 6 characters long' },
        { status: 400, headers: corsHeaders }
      );
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanOtp = String(otp).trim();

    // 1. Verify and consume the reset OTP
    const isValid = await AuthTokenService.verifyAndConsumeOtp(
      cleanEmail,
      cleanOtp,
      'PASSWORD_RESET'
    );

    if (!isValid) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired password reset code' },
        { status: 400, headers: corsHeaders }
      );
    }

    // 2. Fetch admin & restaurant info for notification and redirect URL
    const adminRes = await pool.query(
      `SELECT a.id, a.name, r.name as restaurant_name, r.slug as restaurant_slug
       FROM admins a
       LEFT JOIN restaurants r ON a.restaurant_id = r.id
       WHERE LOWER(a.email) = $1
       LIMIT 1`,
      [cleanEmail]
    );

    if (adminRes.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No admin account found for this email address' },
        { status: 404, headers: corsHeaders }
      );
    }

    const admin = adminRes.rows[0];

    // 3. Hash new password and update in database
    const passwordHash = await hashPassword(new_password);
    await AuthTokenService.updateAdminPassword(cleanEmail, passwordHash);

    // 4. Dispatch confirmation email (async)
    emailService
      .sendPasswordChangedNotification(cleanEmail, admin.restaurant_name)
      .catch((err) => console.error('Failed to dispatch password changed confirmation:', err));

    return NextResponse.json(
      {
        success: true,
        message: 'Password has been successfully updated. You may now log in with your new password.',
        data: {
          email: cleanEmail,
          login_url: admin.restaurant_slug
            ? `/${admin.restaurant_slug}/admin/login`
            : '/login',
        },
      },
      { status: 200, headers: corsHeaders }
    );
  } catch (error: any) {
    console.error('Reset password error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to reset password' },
      { status: 500, headers: corsHeaders }
    );
  }
}
