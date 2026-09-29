import { NextResponse } from 'next/server';
import { sql, getRestaurantBySlug, getOrCreateCustomerLoyaltyByPhone, createLoyaltyReward } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { slug } = body;

    if (!slug) {
      return NextResponse.json({ success: false, error: 'Restaurant slug is required' }, { status: 400 });
    }

    const restaurant = await getRestaurantBySlug(slug);
    if (!restaurant) {
      return NextResponse.json({ success: false, error: 'Restaurant not found' }, { status: 404 });
    }

    const restaurantId = restaurant.id;

    // 1. Seed 10 Diverse Sample Customers
    const sampleCustomers = [
      { name: 'Alex Morgan', phone: '9876543210', email: 'alex@example.com', points: 350, visits: 8, progress: 3, spent: 4850, rewards: 2 },
      { name: 'Priya Sharma', phone: '9812345678', email: 'priya@example.com', points: 120, visits: 4, progress: 4, spent: 2200, rewards: 1 },
      { name: 'Rahul Verma', phone: '9988776655', email: 'rahul@example.com', points: 850, visits: 15, progress: 0, spent: 12400, rewards: 5 },
      { name: 'Ananya Iyer', phone: '9765432109', email: 'ananya@example.com', points: 40, visits: 1, progress: 1, spent: 400, rewards: 0 },
      { name: 'Vikram Malhotra', phone: '9654321098', email: 'vikram@example.com', points: 0, visits: 0, progress: 0, spent: 0, rewards: 0 },
      { name: 'Sneha Nambiar', phone: '9123456789', email: 'sneha@example.com', points: 500, visits: 10, progress: 5, spent: 6500, rewards: 3 },
      { name: 'Karan Kapoor', phone: '9234567890', email: 'karan@example.com', points: 210, visits: 6, progress: 1, spent: 2800, rewards: 1 },
      { name: 'Divya Reddy', phone: '9345678901', email: 'divya@example.com', points: 60, visits: 2, progress: 2, spent: 750, rewards: 0 },
      { name: 'Rohan Gupta', phone: '9456789012', email: 'rohan@example.com', points: 1450, visits: 28, progress: 3, spent: 19800, rewards: 9 },
      { name: 'Meera Joshi', phone: '9567890123', email: 'meera@example.com', points: 15, visits: 1, progress: 1, spent: 150, rewards: 0 },
    ];

    const customerIds: { [key: string]: { loyaltyId: string; userId: string } } = {};

    for (const sc of sampleCustomers) {
      const customerLoyalty = await getOrCreateCustomerLoyaltyByPhone(restaurantId, sc.phone, sc.name);
      if (customerLoyalty) {
        // Update with rich test balance & metrics
        await sql`
          UPDATE customer_loyalty
          SET points_balance = ${sc.points},
              total_points_earned = ${sc.points + sc.rewards * 100},
              total_visits = ${sc.visits},
              visit_progress = ${sc.progress},
              rewards_unlocked = ${sc.rewards},
              total_spent = ${sc.spent},
              last_visit_at = NOW()
          WHERE id = ${customerLoyalty.id}
        `;
        customerIds[sc.name] = { loyaltyId: customerLoyalty.id, userId: customerLoyalty.user_id };
      }
    }

    // 2. Seed Sample Rewards Catalog
    const sampleRewards = [
      { name: 'Free Cold Coffee', points_required: 100, reward_type: 'FREE_ITEM', discount_value: 0, min_purchase_amount: 0 },
      { name: '₹50 Flat Voucher', points_required: 80, reward_type: 'DISCOUNT_AMOUNT', discount_value: 50, min_purchase_amount: 200 },
      { name: '15% Special VIP Discount', points_required: 200, reward_type: 'DISCOUNT_PERCENTAGE', discount_value: 15, min_purchase_amount: 500 },
      { name: 'Free Starter Dish', points_required: 150, reward_type: 'FREE_ITEM', discount_value: 0, min_purchase_amount: 0 },
      { name: 'Dessert Complementary Coupon', points_required: 120, reward_type: 'FREE_ITEM', discount_value: 0, min_purchase_amount: 300 },
    ];

    for (const sr of sampleRewards) {
      const existing = await sql`
        SELECT id FROM loyalty_rewards WHERE restaurant_id = ${restaurantId} AND name = ${sr.name} LIMIT 1
      `;
      if (existing.length === 0) {
        await createLoyaltyReward(restaurantId, {
          name: sr.name,
          points_required: sr.points_required,
          reward_type: sr.reward_type as any,
          discount_value: sr.discount_value,
          selected_product_ids: [],
          min_purchase_amount: sr.min_purchase_amount,
        });
      }
    }

    // 3. Seed Sample Audit Transactions
    if (customerIds['Alex Morgan'] && customerIds['Rahul Verma'] && customerIds['Priya Sharma']) {
      const alex = customerIds['Alex Morgan'];
      const rahul = customerIds['Rahul Verma'];
      const priya = customerIds['Priya Sharma'];

      await sql`
        INSERT INTO loyalty_transactions (restaurant_id, customer_loyalty_id, user_id, transaction_type, points_delta, visit_delta, ticket_number, notes)
        VALUES 
          (${restaurantId}, ${alex.loyaltyId}, ${alex.userId}, 'EARN_POINTS', 50, 1, '1001', 'Earned points from POS order #1001'),
          (${restaurantId}, ${alex.loyaltyId}, ${alex.userId}, 'REDEEM_POINTS', -100, 0, '1004', 'Redeemed Free Cold Coffee voucher'),
          (${restaurantId}, ${rahul.loyaltyId}, ${rahul.userId}, 'MANUAL_ADJUSTMENT', 200, 0, NULL, 'Goodwill credit for VIP member'),
          (${restaurantId}, ${priya.loyaltyId}, ${priya.userId}, 'EARN_POINTS', 40, 1, '1012', 'Earned points from Dine-in order #1012')
        ON CONFLICT DO NOTHING
      `;
    }

    return NextResponse.json({ success: true, message: '10 sample customer profiles and test data seeded successfully!' });
  } catch (error: any) {
    console.error('Error seeding loyalty test subjects:', error);
    return NextResponse.json({ success: false, error: error.message || 'Server error' }, { status: 500 });
  }
}
