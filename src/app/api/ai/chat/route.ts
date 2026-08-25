import { NextRequest, NextResponse } from 'next/server';
import { getRestaurantBySlug, pool } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { AIAnalystService } from '@/modules/ai/ai-analyst.service';
import { AIRepository } from '@/modules/ai/ai.repository';

export async function POST(request: NextRequest) {
  try {
    const slug = request.headers.get('x-restaurant-slug');
    if (!slug) {
      return NextResponse.json({ success: false, error: 'Restaurant slug is required in x-restaurant-slug header' }, { status: 400 });
    }

    const restaurant = await getRestaurantBySlug(slug);
    if (!restaurant) {
      return NextResponse.json({ success: false, error: 'Restaurant not found' }, { status: 404 });
    }

    const admin = await requireAdmin(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Check AI credits status
    const creditData = await AIRepository.getRestaurantAICredits(restaurant.id);
    if (creditData.remaining_credits <= 0 || creditData.used_credits >= creditData.allocated_credits) {
      return NextResponse.json(
        {
          success: false,
          creditsExhausted: true,
          error: 'Credits used fully. If you want more, buy credits from admin. Credits reset every month.'
        },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { message, sessionId } = body;

    if (!message || typeof message !== 'string' || !message.trim()) {
      return NextResponse.json({ success: false, error: 'Message is required' }, { status: 400 });
    }

    const result = await AIAnalystService.processChat({
      restaurantId: restaurant.id,
      sessionId,
      message: message.trim()
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('API /api/ai/chat POST error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const slug = request.headers.get('x-restaurant-slug');
    if (!slug) {
      return NextResponse.json({ success: false, error: 'Restaurant slug required' }, { status: 400 });
    }

    const restaurant = await getRestaurantBySlug(slug);
    if (!restaurant) {
      return NextResponse.json({ success: false, error: 'Restaurant not found' }, { status: 404 });
    }

    const admin = await requireAdmin(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (sessionId) {
      const messages = await AIAnalystService.getSessionMessages(sessionId, 50);
      return NextResponse.json({ success: true, messages });
    }

    // List recent sessions for restaurant
    const sessionsRes = await pool.query(
      `SELECT id, title, created_at, updated_at
       FROM ai_chat_sessions
       WHERE restaurant_id = $1
       ORDER BY updated_at DESC
       LIMIT 20`,
      [restaurant.id]
    );

    return NextResponse.json({ success: true, sessions: sessionsRes.rows });
  } catch (error: any) {
    console.error('API /api/ai/chat GET error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch chat data' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const slug = request.headers.get('x-restaurant-slug');
    if (!slug) return NextResponse.json({ success: false, error: 'Restaurant slug required' }, { status: 400 });

    const restaurant = await getRestaurantBySlug(slug);
    if (!restaurant) return NextResponse.json({ success: false, error: 'Restaurant not found' }, { status: 404 });

    const admin = await requireAdmin(request);
    if (!admin) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (sessionId) {
      await pool.query(`DELETE FROM ai_chat_sessions WHERE id = $1 AND restaurant_id = $2`, [sessionId, restaurant.id]);
    } else {
      await pool.query(`DELETE FROM ai_chat_sessions WHERE restaurant_id = $1`, [restaurant.id]);
    }

    return NextResponse.json({ success: true, message: 'Chat history deleted successfully' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Failed to delete chat session' }, { status: 500 });
  }
}
