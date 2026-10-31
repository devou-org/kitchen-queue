import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import { verifyToken } from '@/lib/auth';

async function requireSuperAdmin(request: NextRequest) {
  const token = request.cookies.get('super_admin_token')?.value
    || request.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload?.isSuperAdmin) return null;
  return payload;
}

// PUT /api/super-admin/updates/[id] — update an existing update
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireSuperAdmin(request);
  if (!admin) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const { title, version_tag, description, learn_more_url, is_published, published_at } = body;

    if (!title || typeof title !== 'string' || !title.trim()) {
      return NextResponse.json({ success: false, error: 'Title is required' }, { status: 400 });
    }
    if (!description || typeof description !== 'string' || !description.trim()) {
      return NextResponse.json({ success: false, error: 'Description is required' }, { status: 400 });
    }

    const cleanTitle = title.trim();
    const cleanVersion = version_tag ? String(version_tag).trim() : null;
    const cleanDescription = description.trim();
    const cleanUrl = learn_more_url ? String(learn_more_url).trim() : null;
    const published = is_published !== false;
    const publishedDate = published_at ? new Date(published_at) : null;

    const rows = await sql`
      UPDATE system_updates
      SET 
        title = ${cleanTitle},
        version_tag = ${cleanVersion},
        description = ${cleanDescription},
        learn_more_url = ${cleanUrl},
        is_published = ${published},
        published_at = COALESCE(${publishedDate}, published_at),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
      RETURNING *
    `;

    if (!rows || rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Update not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: rows[0] });
  } catch (error: any) {
    console.error('Update system update error:', error);
    return NextResponse.json({ success: false, error: 'Failed to update' }, { status: 500 });
  }
}

// DELETE /api/super-admin/updates/[id] — delete an update
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireSuperAdmin(request);
  if (!admin) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const rows = await sql`
      DELETE FROM system_updates
      WHERE id = ${id}
      RETURNING id
    `;

    if (!rows || rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Update not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Update deleted successfully' });
  } catch (error: any) {
    console.error('Delete system update error:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete update' }, { status: 500 });
  }
}

