import { NextRequest, NextResponse } from 'next/server';
import sql, { getRestaurantBySlug } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { BILLING_PRICING, BillingTier } from '@/lib/billing.constants';

export async function GET(request: NextRequest) {
  try {
    const slug = request.headers.get('x-restaurant-slug') || 'demo';
    const restaurant = await getRestaurantBySlug(slug);
    
    if (!restaurant) {
      return NextResponse.json({ success: false, error: 'Restaurant not found' }, { status: 404 });
    }

    const admin = await requireAdmin(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // 1. Fetch transactions (latest 50)
    const transactions = await sql`
      SELECT 
        bt.id, 
        bt.transaction_type, 
        bt.amount, 
        bt.reference_id, 
        bt.description, 
        bt.created_at,
        COALESCE(
          o.customer_name,
          (SELECT o2.customer_name FROM orders o2 WHERE o2.id::text = bt.reference_id LIMIT 1),
          (SELECT o3.customer_name FROM otp_logs ol JOIN orders o3 ON o3.phone = ol.phone WHERE ol.id::text = bt.reference_id AND o3.restaurant_id = bt.restaurant_id ORDER BY o3.created_at DESC LIMIT 1),
          (SELECT u.name FROM otp_logs ol2 JOIN users u ON u.phone = ol2.phone WHERE ol2.id::text = bt.reference_id LIMIT 1)
        ) AS customer_name,
        COALESCE(
          o.ticket_number,
          (SELECT o2.ticket_number FROM orders o2 WHERE o2.id::text = bt.reference_id LIMIT 1),
          (SELECT o3.ticket_number FROM otp_logs ol JOIN orders o3 ON o3.phone = ol.phone WHERE ol.id::text = bt.reference_id AND o3.restaurant_id = bt.restaurant_id ORDER BY o3.created_at DESC LIMIT 1)
        ) AS ticket_number
      FROM billing_transactions bt
      LEFT JOIN orders o ON o.id::text = bt.reference_id
      WHERE bt.restaurant_id = ${restaurant.id}
      ORDER BY bt.created_at DESC
      LIMIT 50
    `;

    // 2. Fetch monthly billing summaries
    const summaries = await sql`
      SELECT id, month, year, order_charges, otp_charges, subscription_charges, adjustments, total_amount, status, created_at
      FROM monthly_billing_summary
      WHERE restaurant_id = ${restaurant.id}
      ORDER BY year DESC, month DESC
    `;

    // 3. Get pricing config for current tier (respecting custom overrides if set)
    const tier = (restaurant.billing_tier || 'BASIC') as BillingTier;
    const rawConfig = BILLING_PRICING[tier] || null;
    let pricingConfig = null;
    if (rawConfig) {
      const subPrice = restaurant.custom_subscription_charge !== null && restaurant.custom_subscription_charge !== undefined
        ? Number(restaurant.custom_subscription_charge)
        : rawConfig.subscriptionMonthly;

      const otpCharge = restaurant.custom_otp_charge !== null && restaurant.custom_otp_charge !== undefined
        ? Number(restaurant.custom_otp_charge)
        : rawConfig.otpCharge;

      pricingConfig = {
        name: rawConfig.name,
        subscriptionPrice: subPrice,
        features: rawConfig.features,
        otpCharge: otpCharge,
        perOrderCommission: rawConfig.perOrder ? {
          threshold: rawConfig.perOrder.flatLimit,
          belowPercent: rawConfig.perOrder.commissionPercent * 100,
          aboveFlat: rawConfig.perOrder.flatCharge
        } : undefined
      };
    }

    return NextResponse.json({
      success: true,
      data: {
        restaurant: {
          id: restaurant.id,
          name: restaurant.name,
          slug: restaurant.slug,
          billing_tier: restaurant.billing_tier,
          billing_model: restaurant.billing_model,
          billing_period: restaurant.billing_period,
          billing_status: restaurant.billing_status,
          billing_start_date: restaurant.billing_start_date,
          billing_end_date: restaurant.billing_end_date,
        },
        transactions,
        summaries,
        pricingConfig,
      }
    });
  } catch (error: any) {
    console.error('Error fetching admin billing details:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
