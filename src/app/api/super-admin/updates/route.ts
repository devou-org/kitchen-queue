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

// GET /api/super-admin/updates — list all updates (published and drafts)
export async function GET(request: NextRequest) {
  const admin = await requireSuperAdmin(request);
  if (!admin) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const rows = await sql`
      SELECT 
        id, 
        version_tag, 
        title, 
        description, 
        learn_more_url, 
        is_published, 
        published_at, 
        created_at, 
        updated_at
      FROM system_updates
      ORDER BY published_at DESC, created_at DESC
    `;
    return NextResponse.json({ success: true, data: rows || [] });
  } catch (error: any) {
    console.error('List system updates error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch updates' }, { status: 500 });
  }
}

// POST /api/super-admin/updates — create a new update
export async function POST(request: NextRequest) {
  const admin = await requireSuperAdmin(request);
  if (!admin) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
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
    const publishedDate = published_at ? new Date(published_at) : new Date();

    const rows = await sql`
      INSERT INTO system_updates (
        title,
        version_tag,
        description,
        learn_more_url,
        is_published,
        published_at
      ) VALUES (
        ${cleanTitle},
        ${cleanVersion},
        ${cleanDescription},
        ${cleanUrl},
        ${published},
        ${publishedDate}
      )
      RETURNING *
    `;

    return NextResponse.json({ success: true, data: rows[0] });
  } catch (error: any) {
    console.error('Create system update error:', error);
    return NextResponse.json({ success: false, error: 'Failed to create update' }, { status: 500 });
  }
}

