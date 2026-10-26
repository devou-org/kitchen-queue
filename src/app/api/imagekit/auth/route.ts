import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { getImageKitAuthParameters } from '@/lib/imagekit';

export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Admin authentication required' },
        { status: 401 }
      );
    }

    const authParameters = getImageKitAuthParameters();
    return NextResponse.json(authParameters);
  } catch (error: any) {
    console.error('[ImageKit Auth Error]:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to generate ImageKit authentication parameters' },
      { status: 500 }
    );
  }
}
