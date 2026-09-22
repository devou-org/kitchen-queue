import { NextRequest, NextResponse } from 'next/server';
import { generateAccessToken, generateRefreshToken } from '@/lib/auth';
import { jwtVerify } from 'jose';
import sql from '@/lib/db';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'fallback-secret-change-in-production-32chars!!'
);

export async function POST(request: NextRequest) {
  try {
    const refreshToken = request.cookies.get('refresh_token')?.value;
    const adminRefreshToken = request.cookies.get('admin_refresh_token')?.value;

    const tokenToVerify = adminRefreshToken || refreshToken;

    if (!tokenToVerify) {
      return NextResponse.json({ success: false, error: 'No refresh token' }, { status: 401 });
    }

    let payload;
    try {
      const verified = await jwtVerify(tokenToVerify, JWT_SECRET);
      payload = verified.payload as any;
    } catch (err) {
      return NextResponse.json({ success: false, error: 'Invalid refresh token' }, { status: 401 });
    }

    if (!payload || !payload.userId) {
      return NextResponse.json({ success: false, error: 'Invalid refresh token payload' }, { status: 401 });
    }

    // Handle Admin Refresh
    if (payload.userId === 'admin-system') {
      const token = await generateAccessToken({
        userId: 'admin-system',
        email: payload.email || 'admin@system.local',
        isAdmin: true,
      }, '1d');

      const newRefreshToken = await generateRefreshToken({
        userId: 'admin-system',
        tokenVersion: 1,
      }, '90d');

      const response = NextResponse.json({
        success: true,
        token,
        user: {
          id: 'admin-system',
          email: payload.email,
          name: 'System Admin',
          is_admin: true,
        },
      });

      response.cookies.set('admin_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 24 * 60 * 60, // 1 day
        path: '/',
      });

      response.cookies.set('admin_refresh_token', newRefreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 90 * 24 * 60 * 60, // 90 days
        path: '/',
      });

      response.cookies.set('admin_logged_in', '1', { httpOnly: false, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 90 * 24 * 60 * 60, path: '/' });

      return response;
    }

    // Handle Staff Member Refresh
    const staffRows = await sql`
      SELECT s.*, r.name as role_name, r.permissions as role_permissions, res.slug as restaurant_slug, res.name as restaurant_name
      FROM staffs s
      LEFT JOIN roles r ON r.id = s.role_id
      LEFT JOIN restaurants res ON res.id = s.restaurant_id
      WHERE s.id = ${payload.userId} AND s.is_active = true
      LIMIT 1
    `;
    const staff = staffRows[0];
    if (staff) {
      let permissions: string[] = [];
      if (staff.role_permissions) {
        permissions = Array.isArray(staff.role_permissions)
          ? staff.role_permissions
          : typeof staff.role_permissions === 'string'
            ? JSON.parse(staff.role_permissions)
            : [];
      } else if (staff.role === 'KITCHEN') {
        permissions = ['orders'];
      } else {
        permissions = ['pos', 'orders', 'tables'];
      }

      const roleName = staff.role_name || staff.role || 'Staff';

      const token = await generateAccessToken({
        userId: staff.id,
        email: staff.email,
        name: staff.name,
        isAdmin: false,
        isStaff: true,
        role: roleName,
        roleId: staff.role_id,
        permissions: permissions,
        restaurantId: staff.restaurant_id,
        restaurantSlug: staff.restaurant_slug,
        restaurantName: staff.restaurant_name,
      }, '1d');

      const newRefreshToken = await generateRefreshToken({
        userId: staff.id,
        tokenVersion: 1,
      }, '90d');

      const response = NextResponse.json({
        success: true,
        token,
        user: {
          id: staff.id,
          email: staff.email,
          name: staff.name,
          role: roleName,
          role_id: staff.role_id,
          permissions: permissions,
          is_admin: false,
          is_staff: true,
          restaurant_id: staff.restaurant_id,
          restaurant_slug: staff.restaurant_slug,
          restaurant_name: staff.restaurant_name,
        },
      });

      response.cookies.set('admin_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 24 * 60 * 60,
        path: '/',
      });
      response.cookies.set('admin_logged_in', '1', { httpOnly: false, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 90 * 24 * 60 * 60, path: '/' });
      response.cookies.set('staff_token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 24 * 60 * 60, path: '/' });
      response.cookies.set('admin_refresh_token', newRefreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 90 * 24 * 60 * 60,
        path: '/',
      });

      return response;
    }

    // Handle Standard User Refresh
    const userRows = await sql`SELECT * FROM users WHERE id = ${payload.userId} LIMIT 1`;
    const user = userRows[0];

    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 401 });
    }

    // Optional: check token version to revoke tokens if needed
    if (payload.tokenVersion && user.refresh_token_version && payload.tokenVersion !== user.refresh_token_version) {
       return NextResponse.json({ success: false, error: 'Refresh token revoked' }, { status: 401 });
    }

    const token = await generateAccessToken({
      userId: user.id,
      phone: user.phone,
      isAdmin: user.is_admin || false,
    }, '1d');

    // Optional: Rotate refresh token
    const newRefreshToken = await generateRefreshToken({
      userId: user.id,
      tokenVersion: user.refresh_token_version || 1,
    }, '365d');

    const response = NextResponse.json({
      success: true,
      token,
      user: {
        id: user.id,
        phone: user.phone,
        name: user.name,
        is_admin: user.is_admin,
        is_phone_verified: user.is_phone_verified,
      },
    });

    response.cookies.set('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60, // 1 day
      path: '/',
    });

    response.cookies.set('refresh_token', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 365 * 24 * 60 * 60, // 365 days
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Refresh token error:', error);
    return NextResponse.json({ success: false, error: 'Failed to refresh token' }, { status: 500 });
  }
}
 
