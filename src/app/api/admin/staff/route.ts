import { NextRequest, NextResponse } from 'next/server';
import { getStaffs, createStaff } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { verifyToken } from '@/lib/auth';

async function checkAdmin(request: NextRequest) {
  const token = request.cookies.get('admin_token')?.value;
  if (!token) return false;
  const payload = await verifyToken(token);
  return payload?.isAdmin;
}

export async function GET(request: NextRequest) {
  if (!(await checkAdmin(request))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const staffs = await getStaffs();
    return NextResponse.json({ success: true, data: staffs });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!(await checkAdmin(request))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const { name, email, phone, password, role } = body;

    if (!name || !email || !password) {
      return NextResponse.json({ success: false, error: 'Name, email, and password are required' }, { status: 400 });
    }

    const hashedPassword = await hashPassword(password);

    const staff = await createStaff({
      name,
      email,
      phone,
      password: hashedPassword,
      role: role || 'KITCHEN'
    });

    return NextResponse.json({ success: true, data: staff });
  } catch (error: any) {
    if (error.message.includes('limit reached')) {
      return NextResponse.json({ success: false, error: error.message }, { status: 403 });
    }
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
