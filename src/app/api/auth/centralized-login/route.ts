import { NextRequest, NextResponse } from 'next/server';
import { verifyPassword, generateAccessToken, generateRefreshToken } from '@/lib/auth';
import { getAdminByEmail, getStaffByEmail, getRestaurantById } from '@/lib/db';
import sql from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'Email and password are required' },
        { status: 400 }
      );
    }

    const userEmail = email.trim().toLowerCase();

    // 1. Check if user is an Admin in the admins table
    const admin = await getAdminByEmail(userEmail);
    if (admin) {
      const isValid = await verifyPassword(password, admin.password);
      if (isValid) {
        // Case A: Super Admin
        if (admin.is_super_admin) {
          const token = await generateAccessToken({
            userId: admin.id,
            email: userEmail,
            isAdmin: true,
            isSuperAdmin: true,
          } as any, '8h');

          const response = NextResponse.json({
            success: true,
            token,
            role: 'SUPER_ADMIN',
            redirect_url: '/super-admin',
            user: {
              id: admin.id,
              email: userEmail,
              name: 'Super Admin',
              role: 'SUPER_ADMIN',
              is_super_admin: true,
              is_admin: true,
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
        }

        // Case B: Restaurant Admin / Owner
        const restaurant = admin.restaurant_id ? await getRestaurantById(admin.restaurant_id) : null;
        let slug = restaurant?.slug;

        // If restaurant_id was not directly set on admin, look for a restaurant associated with this admin
        if (!slug && admin.id) {
          const restRows = await sql`
            SELECT id, slug, name FROM restaurants WHERE id = ${admin.restaurant_id} LIMIT 1
          `;
          if (restRows.length > 0) {
            slug = restRows[0].slug;
          }
        }

        // Fallback to first available restaurant or demo if not mapped
        if (!slug) {
          const fallbackRest = await sql`SELECT slug FROM restaurants ORDER BY created_at ASC LIMIT 1`;
          slug = fallbackRest[0]?.slug || 'demo';
        }

        const token = await generateAccessToken({
          userId: admin.id || 'admin-system',
          email: userEmail,
          name: restaurant?.name ? `${restaurant.name} Admin` : 'System Admin',
          isAdmin: true,
          permissions: ['*'],
          restaurantId: restaurant?.id || admin.restaurant_id,
          restaurantSlug: slug,
          restaurantName: restaurant?.name,
        }, '1d');

        const refreshToken = await generateRefreshToken({
          userId: admin.id || 'admin-system',
          tokenVersion: 1,
        }, '90d');

        const redirectUrl = `/${slug}/admin/orders`;

        const response = NextResponse.json({
          success: true,
          token,
          slug,
          redirect_url: redirectUrl,
          user: {
            id: admin.id || 'admin-system',
            email: userEmail,
            name: restaurant?.name ? `${restaurant.name} Admin` : 'System Admin',
            role: 'ADMIN',
            permissions: ['*'],
            is_admin: true,
            restaurant_id: restaurant?.id || admin.restaurant_id,
            restaurant_slug: slug,
            restaurant_name: restaurant?.name,
          },
        });

        // Set auth cookies
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

    // 2. Check if user is a Staff member
    const staff = await getStaffByEmail(userEmail);
    if (staff && staff.is_active !== false) {
      const isValid = await verifyPassword(password, staff.password);
      if (isValid) {
        const restaurant = staff.restaurant_id ? await getRestaurantById(staff.restaurant_id) : null;
        const slug = restaurant?.slug || 'demo';

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
          restaurantSlug: slug,
          restaurantName: restaurant?.name,
        }, '1d');

        const refreshToken = await generateRefreshToken({
          userId: staff.id,
          tokenVersion: 1,
        }, '90d');

        // Determine destination based on role and permissions
        let redirectUrl = `/${slug}/staff/menu`;
        const upperRole = roleName.toUpperCase();
        if (upperRole.includes('KITCHEN') || upperRole === 'CHEF') {
          redirectUrl = `/${slug}/admin/orders`;
        } else if (upperRole.includes('MANAGER') || permissions.includes('*')) {
          redirectUrl = `/${slug}/admin/orders`;
        } else {
          redirectUrl = `/${slug}/staff/menu`;
        }

        const response = NextResponse.json({
          success: true,
          token,
          slug,
          redirect_url: redirectUrl,
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
            restaurant_slug: slug,
            restaurant_name: restaurant?.name,
          },
        });

        // Set cookies
        response.cookies.set('admin_token', token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 24 * 60 * 60,
          path: '/',
        });

        response.cookies.set('staff_token', token, {
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

    return NextResponse.json(
      { success: false, error: 'Invalid email or password' },
      { status: 401 }
    );
  } catch (error) {
    console.error('Centralized login error:', error);
    return NextResponse.json(
      { success: false, error: 'An unexpected error occurred during login' },
      { status: 500 }
    );
  }
}
