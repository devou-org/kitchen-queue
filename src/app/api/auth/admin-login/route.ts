import { NextRequest, NextResponse } from 'next/server';
import { verifyPassword, generateAccessToken } from '@/lib/auth';
import { getAdminByEmail } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json({ success: false, error: 'Email and password are required' }, { status: 400 });
    }

    const userEmail = email.trim();

    const admin = await getAdminByEmail(userEmail);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Invalid credentials' }, { status: 401 });
    }

    const isValid = await verifyPassword(password, admin.password);
    if (!isValid) {
      return NextResponse.json({ success: false, error: 'Invalid credentials' }, { status: 401 });
    }

    const token = await generateAccessToken({
      userId: 'admin-system',
      email: userEmail,
      isAdmin: true,
    }, '1d');

    const response = NextResponse.json({
      success: true,
      token,
      user: {
        id: 'admin-system',
        email: userEmail,
        name: 'System Admin',
        is_admin: true,
      },
    });

    response.cookies.set('admin_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 8 * 60 * 60, // 8 hours
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Admin login error:', error);
    return NextResponse.json({ success: false, error: 'Login failed' }, { status: 500 });
  }
}
