import { NextRequest, NextResponse } from 'next/server';
import { resolveRestaurantId } from '../helper';
import { getRecipes, getRecipeByProductId, upsertRecipe } from '@/lib/inventory';

export async function GET(request: NextRequest) {
  try {
    const restaurantId = await resolveRestaurantId(request);
    if (!restaurantId) {
      return NextResponse.json({ success: false, error: 'Unauthorized or restaurant not found' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('product_id');

    if (productId) {
      const recipe = await getRecipeByProductId(restaurantId, productId);
      return NextResponse.json({ success: true, data: recipe });
    }

    const recipes = await getRecipes(restaurantId);
    return NextResponse.json({ success: true, data: recipes });
  } catch (error: any) {
    console.error('Get recipes error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const restaurantId = await resolveRestaurantId(request);
    if (!restaurantId) {
      return NextResponse.json({ success: false, error: 'Unauthorized or restaurant not found' }, { status: 401 });
    }

    const body = await request.json();
    if (!body.product_id || !Array.isArray(body.items)) {
      return NextResponse.json({ success: false, error: 'Product ID and items array are required' }, { status: 400 });
    }

    const recipe = await upsertRecipe(restaurantId, body);
    return NextResponse.json({ success: true, data: recipe });
  } catch (error: any) {
    console.error('Upsert recipe error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
