import { NextRequest, NextResponse } from 'next/server';
import { verifyPassword, generateAccessToken } from '@/lib/auth';
import { getStaffByEmail } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json({ success: false, error: 'Email and password are required' }, { status: 400 });
    }

    const userEmail = email.trim();

    const staff = await getStaffByEmail(userEmail);
    if (!staff || !staff.is_active) {
      return NextResponse.json({ success: false, error: 'Invalid credentials or inactive account' }, { status: 401 });
    }

    const isValid = await verifyPassword(password, staff.password);
    if (!isValid) {
      return NextResponse.json({ success: false, error: 'Invalid credentials' }, { status: 401 });
    }

    const token = await generateAccessToken({
      userId: staff.id,
      email: staff.email,
      isAdmin: false,
      isStaff: true,
      role: staff.role
    } as any, '1d');

    const response = NextResponse.json({
      success: true,
      token,
      user: {
        id: staff.id,
        email: staff.email,
        name: staff.name,
        role: staff.role,
        is_staff: true,
      },
    });

    response.cookies.set('staff_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 8 * 60 * 60, // 8 hours
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Staff login error:', error);
    return NextResponse.json({ success: false, error: 'Login failed' }, { status: 500 });
  }
}
