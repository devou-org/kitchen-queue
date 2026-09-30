import { NextRequest, NextResponse } from 'next/server';
import { verifyPassword, generateAccessToken, generateRefreshToken } from '@/lib/auth';
import { getAdminByEmail, getStaffByEmail, getRestaurantById } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json({ success: false, error: 'Email and password are required' }, { status: 400 });
    }

    const userEmail = email.trim();

    // 1. First check if user is a System Admin / Owner in admins table
    const admin = await getAdminByEmail(userEmail);
    if (admin) {
      const isValid = await verifyPassword(password, admin.password);
      if (isValid) {
        const token = await generateAccessToken({
          userId: admin.id || 'admin-system',
          email: userEmail,
          name: 'System Admin',
          isAdmin: true,
          permissions: ['*'],
          restaurantId: admin.restaurant_id,
        }, '1d');

        const refreshToken = await generateRefreshToken({
          userId: 'admin-system',
          tokenVersion: 1,
        }, '90d');

        const response = NextResponse.json({
          success: true,
          token,
          user: {
            id: admin.id || 'admin-system',
            email: userEmail,
            name: 'System Admin',
            role: 'ADMIN',
            permissions: ['*'],
            is_admin: true,
          },
        });

        response.cookies.set('admin_token', token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 24 * 60 * 60,
          path: '/',
        });

        response.cookies.set('admin_logged_in', '1', {
          httpOnly: false,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 90 * 24 * 60 * 60,
          path: '/',
        });

        response.cookies.set('admin_refresh_token', refreshToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 90 * 24 * 60 * 60,
          path: '/',
        });

        return response;
      }
    }

    // 2. If not found in admins, check if user is a Staff member
    const staff = await getStaffByEmail(userEmail);
    if (staff && staff.is_active !== false) {
      const isValid = await verifyPassword(password, staff.password);
      if (isValid) {
        const restaurant = staff.restaurant_id ? await getRestaurantById(staff.restaurant_id) : null;

        // Extract permissions
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
          restaurantSlug: restaurant?.slug,
          restaurantName: restaurant?.name,
        }, '1d');

        const refreshToken = await generateRefreshToken({
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
            restaurant_slug: restaurant?.slug,
            restaurant_name: restaurant?.name,
          },
        });

        response.cookies.set('admin_token', token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 24 * 60 * 60,
          path: '/',
        });

        response.cookies.set('admin_logged_in', '1', {
          httpOnly: false,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 90 * 24 * 60 * 60,
          path: '/',
        });

        response.cookies.set('staff_token', token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 24 * 60 * 60,
          path: '/',
        });

        response.cookies.set('admin_refresh_token', refreshToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 90 * 24 * 60 * 60,
          path: '/',
        });

        return response;
      }
    }

    return NextResponse.json({ success: false, error: 'Invalid credentials or inactive account' }, { status: 401 });
  } catch (error) {
    console.error('Unified admin login error:', error);
    return NextResponse.json({ success: false, error: 'Login failed' }, { status: 500 });
  }
}

