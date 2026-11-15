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

    // 3. Get pricing config for current plan / tier (respecting dynamic SaaS catalog & custom overrides)
    const billingPeriod = (restaurant.billing_period || 'MONTHLY').toUpperCase();
    const product = restaurant.selected_product || 'POS';
    const tier = restaurant.billing_tier || 'BASIC';

    let pricingConfig = null;
    let subscriptionPrice = 0;
    let planName = tier;
    let features: string[] = [];

    // Query relational SaaS catalog first
    const saasPlanRes = await sql`
      SELECT 
        p.id as plan_id, 
        p.name as plan_name, 
        p.tier, 
        p.monthly_ai_credits,
        pr.price, 
        pr.billing_cycle, 
        pr.currency
      FROM saas_plans p
      LEFT JOIN saas_plan_pricing pr ON p.id = pr.plan_id AND pr.billing_cycle = ${billingPeriod}
      WHERE (p.product_id = ${product} OR p.product_id = 'POS')
        AND (p.tier = ${tier} OR p.id = ${tier})
      ORDER BY (p.product_id = ${product}) DESC
      LIMIT 1
    `;

    if (saasPlanRes.length > 0 && saasPlanRes[0].price !== null) {
      subscriptionPrice = Number(saasPlanRes[0].price);
      planName = saasPlanRes[0].plan_name;

      // Also get features
      const featRes = await sql`
        SELECT feature_code, feature_name 
        FROM saas_plan_features 
        WHERE plan_id = ${saasPlanRes[0].plan_id} AND is_included = true
      `;
      features = featRes.map((f: any) => f.feature_code || f.feature_name);
    } else {
      // Fallback to static pricing map
      const rawConfig = BILLING_PRICING[tier as BillingTier] || null;
      if (rawConfig) {
        subscriptionPrice = billingPeriod === 'ANNUALLY' && rawConfig.subscriptionAnnual
          ? rawConfig.subscriptionAnnual
          : rawConfig.subscriptionMonthly;
        planName = rawConfig.name;
        features = rawConfig.features;
      }
    }

    // Custom price override if set on restaurant
    if (restaurant.custom_subscription_charge !== null && restaurant.custom_subscription_charge !== undefined) {
      subscriptionPrice = Number(restaurant.custom_subscription_charge);
    } else if (restaurant.custom_plan_price !== null && restaurant.custom_plan_price !== undefined) {
      subscriptionPrice = Number(restaurant.custom_plan_price);
    }

    const otpCharge = restaurant.custom_otp_charge !== null && restaurant.custom_otp_charge !== undefined
      ? Number(restaurant.custom_otp_charge)
      : 0.50;

    // Calculate effective renewal / end date if not explicitly in DB
    let effectiveEndDate = restaurant.billing_end_date;
    if (!effectiveEndDate && restaurant.billing_start_date) {
      const startDate = new Date(restaurant.billing_start_date);
      const computedDate = new Date(startDate);
      if (billingPeriod === 'ANNUALLY') {
        computedDate.setFullYear(computedDate.getFullYear() + 1);
      } else {
        computedDate.setMonth(computedDate.getMonth() + 1);
      }
      effectiveEndDate = computedDate.toISOString();
    }

    pricingConfig = {
      name: planName,
      subscriptionPrice,
      billingPeriod,
      features,
      otpCharge,
      effectiveEndDate,
      isTrial: Boolean(restaurant.is_trial),
      trialEndsAt: restaurant.trial_ends_at,
    };

    const { searchParams } = new URL(request.url);
    const todayParam = searchParams.get('today');

    // 4. Fetch today's OTP usage stats
    let todayOtpStats;
    if (todayParam) {
      todayOtpStats = await sql`
        SELECT 
          COUNT(*)::int as count,
          COALESCE(SUM(amount), 0)::float as amount
        FROM billing_transactions
        WHERE restaurant_id = ${restaurant.id}
          AND transaction_type = 'OTP'
          AND created_at >= ${todayParam}::date
          AND created_at < (${todayParam}::date + interval '1 day')
      `;
    } else {
      todayOtpStats = await sql`
        SELECT 
          COUNT(*)::int as count,
          COALESCE(SUM(amount), 0)::float as amount
        FROM billing_transactions
        WHERE restaurant_id = ${restaurant.id}
          AND transaction_type = 'OTP'
          AND created_at >= CURRENT_DATE
          AND created_at < (CURRENT_DATE + interval '1 day')
      `;
    }

    const todayOtpUsage = {
      count: Number(todayOtpStats[0]?.count || 0),
      amount: Number(todayOtpStats[0]?.amount || 0)
    };

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
          billing_end_date: effectiveEndDate,
          is_trial: restaurant.is_trial,
          trial_ends_at: restaurant.trial_ends_at,
          selected_product: restaurant.selected_product,
        },
        transactions,
        summaries,
        pricingConfig,
        todayOtpUsage,
      }
    });
  } catch (error: any) {
    console.error('Error fetching admin billing details:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
