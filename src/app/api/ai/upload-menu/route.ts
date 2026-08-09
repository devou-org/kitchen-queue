import { NextRequest, NextResponse } from 'next/server';
import { AIService } from '@/modules/ai/ai.service';
import { pool } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { restaurant_id, slug, image } = body;

    if (!image) {
      return NextResponse.json(
        { success: false, code: 'INVALID_INPUT', message: 'Image data is required.' },
        { status: 400 }
      );
    }

    let targetRestaurantId = restaurant_id;

    // Resolve restaurant ID from slug if provided and ID missing
    if (!targetRestaurantId && slug) {
      const res = await pool.query('SELECT id FROM restaurants WHERE slug = $1 LIMIT 1', [slug]);
      if (res.rows.length > 0) {
        targetRestaurantId = res.rows[0].id;
      }
    }

    // Determine mime type from base64 string or default to image/jpeg
    let mimeType = 'image/jpeg';
    if (image.startsWith('data:image/png')) {
      mimeType = 'image/png';
    } else if (image.startsWith('data:image/webp')) {
      mimeType = 'image/webp';
    }

    const result = await AIService.extractMenuFromImage(targetRestaurantId, image, mimeType);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          code: result.code,
          message: result.message
        },
        { status: result.code === 'GEMINI_DAILY_LIMIT_REACHED' ? 429 : 400 }
      );
    }

    return NextResponse.json({
      success: true,
      products: (result as any).products,
      tokens: (result as any).tokens
    });

  } catch (error: any) {
    console.error('Error in /api/ai/upload-menu:', error);
    return NextResponse.json(
      {
        success: false,
        code: 'SERVER_ERROR',
        message: error.message || 'Failed to process menu image.'
      },
      { status: 500 }
    );
  }
}
