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

    const admin = await getAdminByEmail(email.trim());
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Invalid credentials' }, { status: 401 });
    }

    if (!admin.is_super_admin) {
      return NextResponse.json({ success: false, error: 'Access denied. Super admin privileges required.' }, { status: 403 });
    }

    const isValid = await verifyPassword(password, admin.password);
    if (!isValid) {
      return NextResponse.json({ success: false, error: 'Invalid credentials' }, { status: 401 });
    }

    const token = await generateAccessToken({
      userId: admin.id,
      email: admin.email,
      isAdmin: true,
      isSuperAdmin: true,
    } as any, '8h');

    const response = NextResponse.json({
      success: true,
      token,
      user: {
        id: admin.id,
        email: admin.email,
        is_super_admin: true,
      },
    });

    response.cookies.set('super_admin_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 8 * 60 * 60,
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Super admin login error:', error);
    return NextResponse.json({ success: false, error: 'Login failed' }, { status: 500 });
  }
}
