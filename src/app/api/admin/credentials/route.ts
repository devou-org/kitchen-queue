import { NextRequest, NextResponse } from 'next/server';
import sql, { getRestaurantBySlug } from '@/lib/db';
import { requireAdmin, verifyPassword, hashPassword } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin || !admin.isAdmin) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const slug = request.headers.get('x-restaurant-slug') || 'demo';
    const restaurant = await getRestaurantBySlug(slug);
    if (!restaurant) {
      return NextResponse.json({ success: false, error: 'Restaurant not found' }, { status: 404 });
    }

    const rows = await sql`SELECT id, email FROM admins WHERE restaurant_id = ${restaurant.id} LIMIT 1`;
    const adminUser = rows[0];

    const email = adminUser?.email || admin.email || '';
    return NextResponse.json({ success: true, email });
  } catch (error: any) {
    console.error('Error fetching admin credentials:', error);
    return NextResponse.json({ success: false, error: error.message || 'Failed to fetch credentials' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin || !admin.isAdmin) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const slug = request.headers.get('x-restaurant-slug') || 'demo';
    const restaurant = await getRestaurantBySlug(slug);
    if (!restaurant) {
      return NextResponse.json({ success: false, error: 'Restaurant not found' }, { status: 404 });
    }

    const body = await request.json();
    const { email, currentPassword, newPassword } = body;

    if (!email || typeof email !== 'string' || !email.trim()) {
      return NextResponse.json({ success: false, error: 'Admin email is required' }, { status: 400 });
    }

    const emailTrimmed = email.trim().toLowerCase();

    // Check if email already belongs to a DIFFERENT restaurant's admin
    const existingOther = await sql`
      SELECT id, restaurant_id 
      FROM admins 
      WHERE LOWER(email) = ${emailTrimmed} 
        AND restaurant_id IS NOT NULL 
        AND restaurant_id != ${restaurant.id} 
      LIMIT 1
    `;
    if (existingOther.length > 0) {
      return NextResponse.json({ success: false, error: 'This email is already in use by another restaurant admin.' }, { status: 400 });
    }

    // Fetch existing admin row for this restaurant
    const adminRows = await sql`SELECT id, email, password FROM admins WHERE restaurant_id = ${restaurant.id} LIMIT 1`;
    const existingAdmin = adminRows[0];

    // If current password is provided or existing admin has password, verify it
    if (currentPassword && existingAdmin?.password) {
      const isValid = await verifyPassword(currentPassword, existingAdmin.password);
      if (!isValid) {
        return NextResponse.json({ success: false, error: 'Current password is incorrect' }, { status: 400 });
      }
    }

    let passwordHash: string | null = null;
    if (newPassword && typeof newPassword === 'string' && newPassword.trim().length > 0) {
      if (newPassword.trim().length < 6) {
        return NextResponse.json({ success: false, error: 'New password must be at least 6 characters long' }, { status: 400 });
      }
      passwordHash = await hashPassword(newPassword.trim());
    }

    if (existingAdmin) {
      if (passwordHash) {
        await sql`
          UPDATE admins 
          SET email = ${emailTrimmed}, 
              password = ${passwordHash}, 
              updated_at = NOW() 
          WHERE id = ${existingAdmin.id}
        `;
      } else {
        await sql`
          UPDATE admins 
          SET email = ${emailTrimmed}, 
              updated_at = NOW() 
          WHERE id = ${existingAdmin.id}
        `;
      }
    } else {
      if (!passwordHash) {
        return NextResponse.json({ success: false, error: 'A password is required to create initial admin credentials' }, { status: 400 });
      }
      await sql`
        INSERT INTO admins (email, password, restaurant_id, is_super_admin)
        VALUES (${emailTrimmed}, ${passwordHash}, ${restaurant.id}, false)
      `;
    }

    return NextResponse.json({
      success: true,
      message: 'Admin credentials updated successfully',
      email: emailTrimmed
    });
  } catch (error: any) {
    console.error('Error updating admin credentials:', error);
    return NextResponse.json({ success: false, error: error.message || 'Failed to update credentials' }, { status: 500 });
  }
}
