import { NextRequest, NextResponse } from 'next/server';
import { AIRepository } from '@/modules/ai/ai.repository';
import { getRestaurantBySlug } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const slugHeader = request.headers.get('x-restaurant-slug');
    const { searchParams } = new URL(request.url);
    const slugParam = searchParams.get('slug');
    const slug = slugHeader || slugParam;

    if (!slug) {
      return NextResponse.json(
        { success: false, error: 'Restaurant slug is required' },
        { status: 400 }
      );
    }

    const restaurant = await getRestaurantBySlug(slug);
    if (!restaurant) {
      return NextResponse.json(
        { success: false, error: 'Restaurant not found' },
        { status: 404 }
      );
    }

    const creditData = await AIRepository.getRestaurantAICredits(restaurant.id);

    return NextResponse.json({
      success: true,
      data: creditData
    });
  } catch (error: any) {
    console.error('Error fetching AI credits:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch AI credit details' },
      { status: 500 }
    );
  }
}
