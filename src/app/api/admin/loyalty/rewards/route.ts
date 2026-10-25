import { NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth';
import { 
  getRestaurantBySlug, 
  getLoyaltyRewards, 
  createLoyaltyReward, 
  updateLoyaltyReward, 
  deleteLoyaltyReward 
} from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const slug = searchParams.get('slug');

    if (!slug) {
      return NextResponse.json({ success: false, error: 'Restaurant slug is required' }, { status: 400 });
    }

    const restaurant = await getRestaurantBySlug(slug);
    if (!restaurant) {
      return NextResponse.json({ success: false, error: 'Restaurant not found' }, { status: 404 });
    }

    const rewards = await getLoyaltyRewards(restaurant.id);
    return NextResponse.json({ success: true, data: rewards });
  } catch (error: any) {
    console.error('Error fetching loyalty rewards:', error);
    return NextResponse.json({ success: false, error: error.message || 'Server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { admin } = await getAuthContext(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { slug, name, points_required, reward_type, discount_value, selected_product_ids, min_purchase_amount, valid_until } = body;

    if (!slug || !name || points_required === undefined || !reward_type) {
      return NextResponse.json({ success: false, error: 'Name, points_required, and reward_type are required' }, { status: 400 });
    }

    const restaurant = await getRestaurantBySlug(slug);
    if (!restaurant) {
      return NextResponse.json({ success: false, error: 'Restaurant not found' }, { status: 404 });
    }

    const reward = await createLoyaltyReward(restaurant.id, {
      name,
      points_required: Number(points_required),
      reward_type,
      discount_value: Number(discount_value || 0),
      selected_product_ids: selected_product_ids || [],
      min_purchase_amount: Number(min_purchase_amount || 0),
      valid_until: valid_until || null
    });

    return NextResponse.json({ success: true, data: reward });
  } catch (error: any) {
    console.error('Error creating loyalty reward:', error);
    return NextResponse.json({ success: false, error: error.message || 'Server error' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const { admin } = await getAuthContext(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { slug, reward_id, ...rewardData } = body;

    if (!slug || !reward_id) {
      return NextResponse.json({ success: false, error: 'Slug and reward_id are required' }, { status: 400 });
    }

    const restaurant = await getRestaurantBySlug(slug);
    if (!restaurant) {
      return NextResponse.json({ success: false, error: 'Restaurant not found' }, { status: 404 });
    }

    const updated = await updateLoyaltyReward(restaurant.id, reward_id, rewardData);
    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    console.error('Error updating loyalty reward:', error);
    return NextResponse.json({ success: false, error: error.message || 'Server error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { admin } = await getAuthContext(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const slug = searchParams.get('slug');
    const reward_id = searchParams.get('reward_id');

    if (!slug || !reward_id) {
      return NextResponse.json({ success: false, error: 'Slug and reward_id are required' }, { status: 400 });
    }

    const restaurant = await getRestaurantBySlug(slug);
    if (!restaurant) {
      return NextResponse.json({ success: false, error: 'Restaurant not found' }, { status: 404 });
    }

    await deleteLoyaltyReward(restaurant.id, reward_id);
    return NextResponse.json({ success: true, message: 'Reward deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting loyalty reward:', error);
    return NextResponse.json({ success: false, error: error.message || 'Server error' }, { status: 500 });
  }
}
