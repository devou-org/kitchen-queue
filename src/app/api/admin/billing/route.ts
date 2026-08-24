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
      SELECT id, transaction_type, amount, reference_id, description, created_at
      FROM billing_transactions
      WHERE restaurant_id = ${restaurant.id}
      ORDER BY created_at DESC
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
