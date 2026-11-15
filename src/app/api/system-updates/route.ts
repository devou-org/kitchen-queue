import { NextRequest, NextResponse } from 'next/server';
import sql, { pool } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '50', 10), 1), 100);

    const rows = await sql`
      SELECT 
        id, 
        version_tag, 
        title, 
        description, 
        learn_more_url, 
        published_at, 
        created_at
      FROM system_updates
      WHERE is_published = true
      ORDER BY published_at DESC, created_at DESC
      LIMIT ${limit}
    `;

    return NextResponse.json({
      success: true,
      data: rows || [],
    });
  } catch (error: any) {
    console.error('Error fetching system updates:', error);
    // If the table was just created or missing in current pool
    return NextResponse.json({
      success: true,
      data: [],
    });
  }
}

