import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, hashPassword } from '@/lib/auth';
import sql from '@/lib/db';

async function requireSuperAdmin(request: NextRequest) {
  const token = request.cookies.get('super_admin_token')?.value
    || request.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload?.isSuperAdmin) return null;
  return payload;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireSuperAdmin(request);
  if (!admin) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  try {
    const { id } = await params;
    const rows = await sql`SELECT email FROM admins WHERE restaurant_id = ${id} LIMIT 1`;
    const adminUser = rows[0];

    return NextResponse.json({ success: true, email: adminUser?.email || '' });
  } catch (error) {
    console.error('Error fetching admin details:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch admin' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireSuperAdmin(request);
  if (!admin) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  try {
    const { id } = await params;
    const body = await request.json();
    const { email, password } = body;

    if (!email) {
      return NextResponse.json({ success: false, error: 'Email is required' }, { status: 400 });
    }

    const emailTrimmed = email.trim();
    
    // Check if email already belongs to a DIFFERENT restaurant or is super admin (without restaurant_id)
    const existingRows = await sql`SELECT id, restaurant_id FROM admins WHERE email = ${emailTrimmed} LIMIT 1`;
    if (existingRows.length > 0 && existingRows[0].restaurant_id !== id) {
      return NextResponse.json({ success: false, error: 'Email is already used by another admin.' }, { status: 400 });
    }

    let passwordHash = undefined;
    if (password && password.trim().length > 0) {
      passwordHash = await hashPassword(password);
    }

    const adminForRestaurant = await sql`SELECT id FROM admins WHERE restaurant_id = ${id} LIMIT 1`;

    if (adminForRestaurant.length > 0) {
      // Update existing admin for this restaurant
      if (passwordHash) {
        await sql`
          UPDATE admins 
          SET email = ${emailTrimmed}, password = ${passwordHash}, updated_at = NOW() 
          WHERE restaurant_id = ${id}
        `;
      } else {
        await sql`
          UPDATE admins 
          SET email = ${emailTrimmed}, updated_at = NOW() 
          WHERE restaurant_id = ${id}
        `;
      }
    } else {
      // Insert new admin
      if (!passwordHash) {
         return NextResponse.json({ success: false, error: 'Password is required to create a new admin' }, { status: 400 });
      }
      await sql`
        INSERT INTO admins (email, password, restaurant_id, is_super_admin)
        VALUES (${emailTrimmed}, ${passwordHash}, ${id}, false)
      `;
    }

    return NextResponse.json({ success: true, message: 'Admin credentials updated successfully' });
  } catch (error) {
    console.error('Error updating admin credentials:', error);
    return NextResponse.json({ success: false, error: 'Failed to update admin credentials' }, { status: 500 });
  }
}
