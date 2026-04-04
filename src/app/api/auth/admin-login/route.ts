import { NextRequest, NextResponse } from 'next/server';
import { verifyPassword, generateToken } from '@/lib/auth';
import { getUserByEmail } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json({ success: false, error: 'Email and password are required' }, { status: 400 });
    }

    const userEmail = email.trim();
    
    const expectedEmail = process.env.ADMIN_EMAIL || "admin@renjzkitchen.com";
    if (userEmail !== expectedEmail) {
      return NextResponse.json({ success: false, error: 'Invalid credentials (E)' }, { status: 401 });
    }

    const hash = "$2b$10$L40pis2dxrnJNtl9ZJXoLO21U.CXI3mOm5I2Ez3A9BiZLx6dAYeDe";
    if (!hash) {
      return NextResponse.json({ success: false, error: 'Admin account not seamlessly configured in .env' }, { status: 401 });
    }

    const isValid = await verifyPassword(password, hash);
    if (!isValid) {
      return NextResponse.json({ success: false, error: 'Invalid credentials (P)' }, { status: 401 });
    }

    const token = await generateToken({
      userId: 'admin-system',
      email: userEmail,
      isAdmin: true,
    }, '8h');

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
