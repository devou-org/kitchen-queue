import { NextRequest, NextResponse } from 'next/server';
import { updateStaff, deleteStaff } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { verifyToken } from '@/lib/auth';

async function checkAdmin(request: NextRequest) {
  const token = request.cookies.get('admin_token')?.value;
  if (!token) return false;
  const payload = await verifyToken(token);
  return payload?.isAdmin;
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  if (!(await checkAdmin(request))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { id } = params;
    const body = await request.json();
    
    if (body.password) {
      body.password = await hashPassword(body.password);
    }

    const updated = await updateStaff(id, body);
    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  if (!(await checkAdmin(request))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { id } = params;
    await deleteStaff(id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
