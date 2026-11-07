import { pool } from '@/lib/db';

export type SaaSProductId = 'POS' | 'DIGITAL_MENU' | 'QUEUE_MANAGEMENT';
export type SaaSPlanTier = 'ESSENTIAL' | 'PREMIUM' | 'STANDALONE';
export type BillingCycle = 'MONTHLY' | 'ANNUALLY';

export interface SaaSProduct {
  id: SaaSProductId;
  name: string;
  description: string;
  has_trial: boolean;
  trial_days: number;
  is_active: boolean;
}

export interface SaaSPlanPricing {
  billing_cycle: BillingCycle;
  price: number;
  currency: string;
}

export interface SaaSPlanFeature {
  feature_code: string;
  feature_name: string;
  feature_description: string;
  is_included: boolean;
}

export interface SaaSPlan {
  id: string;
  product_id: SaaSProductId;
  tier: SaaSPlanTier;
  name: string;
  description: string;
  monthly_ai_credits: number;
  is_default_trial_tier: boolean;
  pricing: Record<BillingCycle, number>;
  features: SaaSPlanFeature[];
}

export class SubscriptionService {
  /**
   * Data-driven fallback catalog if database tables are not yet migrated
   */
  private static readonly FALLBACK_CATALOG = {
    products: [
      {
        id: 'POS' as SaaSProductId,
        name: 'Point of Sale (POS)',
        description: 'Complete restaurant POS with Essential and Premium plans',
        has_trial: true,
        trial_days: 14,
        is_active: true,
      },
      {
        id: 'DIGITAL_MENU' as SaaSProductId,
        name: 'Digital Menu',
        description: 'Standalone digital menu solution with contactless QR ordering',
        has_trial: false,
        trial_days: 0,
        is_active: true,
      },
      {
        id: 'QUEUE_MANAGEMENT' as SaaSProductId,
        name: 'Q Management System',
        description: 'Standalone queue management solution for waitlists & tokens',
        has_trial: false,
        trial_days: 0,
        is_active: true,
      },
    ],
    plans: {
      POS_ESSENTIAL: {
        id: 'POS_ESSENTIAL',
        product_id: 'POS' as SaaSProductId,
        tier: 'ESSENTIAL' as SaaSPlanTier,
        name: 'Essential Plan',
        description: 'Core POS, QR ordering, catalogue management, sales & statements, and 10 AI credits.',
        monthly_ai_credits: 10,
        is_default_trial_tier: false,
        pricing: {
          ANNUALLY: 6999,
          MONTHLY: 699,
        },
        features: [
          { feature_code: 'POS_TABLE_MANAGEMENT', feature_name: 'POS & Table Management', feature_description: 'Floor plans, table status, billing & checkout', is_included: true },
          { feature_code: 'DIGITAL_MENU_QR', feature_name: 'Digital Menu & QR Ordering', feature_description: 'Customers scan QR and place orders instantly', is_included: true },
          { feature_code: 'MENU_MANAGEMENT', feature_name: 'Menu Management', feature_description: 'Catalogue, variations and dynamic pricing', is_included: true },
          { feature_code: 'SALES_STATEMENTS', feature_name: 'Sales & Statements', feature_description: 'Detailed analytics and daily statements', is_included: true },
          { feature_code: 'PROFILE_BRANDING', feature_name: 'Customised Profile & Branding', feature_description: 'Brand color, logo, and layout personalization', is_included: true },
          { feature_code: 'AI_ANALYST', feature_name: 'AI Analyst Credits', feature_description: '10 monthly AI Analyst credits', is_included: true },
        ],
      },
      POS_PREMIUM: {
        id: 'POS_PREMIUM',
        product_id: 'POS' as SaaSProductId,
        tier: 'PREMIUM' as SaaSPlanTier,
        name: 'Premium Plan',
        description: 'Everything in Essential + Inventory, Loyalty Points, 30 AI Analyst credits, Inbuilt Finance, & New Features.',
        monthly_ai_credits: 30,
        is_default_trial_tier: true,
        pricing: {
          ANNUALLY: 9999,
          MONTHLY: 999,
        },
        features: [
          { feature_code: 'POS_TABLE_MANAGEMENT', feature_name: 'POS & Table Management', feature_description: 'Floor plans, table status, billing & checkout', is_included: true },
          { feature_code: 'DIGITAL_MENU_QR', feature_name: 'Digital Menu & QR Ordering', feature_description: 'Customers scan QR and place orders instantly', is_included: true },
          { feature_code: 'MENU_MANAGEMENT', feature_name: 'Menu Management', feature_description: 'Catalogue, variations and dynamic pricing', is_included: true },
          { feature_code: 'SALES_STATEMENTS', feature_name: 'Sales & Statements', feature_description: 'Detailed analytics and daily statements', is_included: true },
          { feature_code: 'PROFILE_BRANDING', feature_name: 'Customised Profile & Branding', feature_description: 'Brand color, logo, and layout personalization', is_included: true },
          { feature_code: 'AI_ANALYST', feature_name: 'AI Analyst Credits', feature_description: '30 monthly AI Analyst credits for forecasting and insights', is_included: true },
          { feature_code: 'INVENTORY', feature_name: 'Comprehensive Inventory', feature_description: 'Deep stock management, supplier tracking, and low-stock alerts', is_included: true },
          { feature_code: 'LOYALTY_PROGRAM', feature_name: 'Customisable Loyalty Points', feature_description: 'Customer rewards, point accruals and redemption', is_included: true },
          { feature_code: 'FINANCE_MANAGEMENT', feature_name: 'Inbuilt Finance Management', feature_description: 'Track expenses, vendor payouts, and financial records', is_included: true },
          { feature_code: 'NEW_FEATURES_ACCESS', feature_name: 'Free Access to New Features', feature_description: 'Automatic rollout of standard platform updates', is_included: true },
        ],
      },
      DIGITAL_MENU_STANDALONE: {
        id: 'DIGITAL_MENU_STANDALONE',
        product_id: 'DIGITAL_MENU' as SaaSProductId,
        tier: 'STANDALONE' as SaaSPlanTier,
        name: 'Digital Menu Standalone',
        description: 'Standalone QR digital menu and contactless menu viewing/ordering.',
        monthly_ai_credits: 0,
        is_default_trial_tier: false,
        pricing: {
          ANNUALLY: 2999,
          MONTHLY: 299,
        },
        features: [
          { feature_code: 'DIGITAL_MENU_QR', feature_name: 'Digital Menu & QR Ordering', feature_description: 'Contactless QR menu viewing and direct ordering', is_included: true },
          { feature_code: 'MENU_MANAGEMENT', feature_name: 'Menu Management', feature_description: 'Complete catalogue, item availability and pricing', is_included: true },
          { feature_code: 'PROFILE_BRANDING', feature_name: 'Customised Profile & Branding', feature_description: 'Custom brand colours and header presentation', is_included: true },
        ],
      },
      QUEUE_MGMT_STANDALONE: {
        id: 'QUEUE_MGMT_STANDALONE',
        product_id: 'QUEUE_MANAGEMENT' as SaaSProductId,
        tier: 'STANDALONE' as SaaSPlanTier,
        name: 'Q Management Standalone',
        description: 'Standalone queue management, virtual waitlists, and live counter notifications.',
        monthly_ai_credits: 0,
        is_default_trial_tier: false,
        pricing: {
          ANNUALLY: 2999,
          MONTHLY: 299,
        },
        features: [
          { feature_code: 'QUEUE_MANAGEMENT', feature_name: 'Queue Management System', feature_description: 'Waitlist management, SMS/WhatsApp paging, and TV display board', is_included: true },
        ],
      },
    },
  };

  /**
   * Fetch all active SaaS products from database (with fallback)
   */
  static async getProducts(): Promise<SaaSProduct[]> {
    try {
      const res = await pool.query(
        `SELECT id, name, description, has_trial, trial_days, is_active
         FROM saas_products
         WHERE is_active = true
         ORDER BY id ASC`
      );
      if (res.rows.length > 0) {
        return res.rows;
      }
    } catch {
      // Fallback if table does not exist
    }
    return this.FALLBACK_CATALOG.products;
  }

  /**
   * Fetch plans by product ID with pricing & features
   */
  static async getPlansByProduct(productId: SaaSProductId): Promise<SaaSPlan[]> {
    try {
      const planRes = await pool.query(
        `SELECT id, product_id, tier, name, description, monthly_ai_credits, is_default_trial_tier, is_active
         FROM saas_plans
         WHERE product_id = $1 AND is_active = true
         ORDER BY id ASC`,
        [productId]
      );

      if (planRes.rows.length > 0) {
        const plans: SaaSPlan[] = [];
        for (const row of planRes.rows) {
          const pricingRes = await pool.query(
            `SELECT billing_cycle, price, currency
             FROM saas_plan_pricing
             WHERE plan_id = $1 AND is_active = true`,
            [row.id]
          );

          const pricing: Record<BillingCycle, number> = {
            ANNUALLY: 0,
            MONTHLY: 0,
          };
          for (const pr of pricingRes.rows) {
            pricing[pr.billing_cycle as BillingCycle] = Number(pr.price);
          }

          const featRes = await pool.query(
            `SELECT feature_code, feature_name, feature_description, is_included
             FROM saas_plan_features
             WHERE plan_id = $1 AND is_included = true`,
            [row.id]
          );

          plans.push({
            ...row,
            pricing,
            features: featRes.rows,
          });
        }
        return plans;
      }
    } catch {
      // Fallback
    }

    // Fallback matching
    return Object.values(this.FALLBACK_CATALOG.plans).filter((p) => p.product_id === productId);
  }

  /**
   * Provision subscription and modules during customer onboarding
   */
  static async provisionOnboardingSubscription(
    restaurantId: string,
    options: {
      product: SaaSProductId;
      planTier?: 'ESSENTIAL' | 'PREMIUM' | 'STANDALONE';
      billingCycle?: 'MONTHLY' | 'ANNUALLY';
      customPrice?: number;
    }
  ) {
    const selectedProduct = options.product || 'POS';
    const billingCycle = options.billingCycle || 'ANNUALLY';
    const now = new Date();

    if (selectedProduct === 'POS') {
      // 14-day Free Trial with full Premium features unlocked and 30 AI Analyst credits
      const trialDays = 14;
      const trialEndDate = new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1000);
      const chosenTier = options.planTier || 'PREMIUM';

      // Update restaurant subscription status
      await pool.query(
        `UPDATE restaurants 
         SET 
           billing_tier = $1,
           billing_model = 'SUBSCRIPTION',
           billing_status = 'TRIAL',
           billing_period = $2,
           billing_start_date = $3,
           billing_end_date = $4,
           monthly_ai_credits = 30,
           selected_product = 'POS',
           is_trial = true,
           trial_ends_at = $4,
           custom_plan_price = $5
         WHERE id = $6`,
        [chosenTier, billingCycle, now.toISOString(), trialEndDate.toISOString(), options.customPrice || null, restaurantId]
      );

      // Seed 30 AI credits for current billing period
      const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      await pool.query(
        `INSERT INTO ai_credits (restaurant_id, billing_period, allocated_credits, used_credits)
         VALUES ($1, $2, 30, 0.00)
         ON CONFLICT (restaurant_id, billing_period)
         DO UPDATE SET allocated_credits = 30`,
        [restaurantId, currentPeriod]
      );

      // Activate all Premium modules for trial
      const trialModules = [
        { name: 'DIGITAL_MENU', enabled: true },
        { name: 'ONLINE_ORDERING', enabled: true },
        { name: 'QUEUE_MANAGEMENT', enabled: true },
        { name: 'INVENTORY', enabled: true },
        { name: 'LOYALTY_PROGRAM', enabled: true },
        { name: 'FINANCE_MANAGEMENT', enabled: true },
        { name: 'ANALYTICS', enabled: true },
        { name: 'REPORTS', enabled: true },
      ];

      for (const mod of trialModules) {
        await pool.query(
          `INSERT INTO restaurant_modules (restaurant_id, module_name, is_enabled)
           VALUES ($1, $2, $3)
           ON CONFLICT (restaurant_id, module_name)
           DO UPDATE SET is_enabled = $3, updated_at = NOW()`,
          [restaurantId, mod.name, mod.enabled]
        );
      }

      return {
        product: 'POS',
        is_trial: true,
        trial_days: 14,
        trial_ends_at: trialEndDate.toISOString(),
        tier: chosenTier,
        billing_cycle: billingCycle,
        monthly_ai_credits: 30,
        unlocked_tier: 'PREMIUM',
      };
    } else if (selectedProduct === 'DIGITAL_MENU') {
      // Standalone Digital Menu
      await pool.query(
        `UPDATE restaurants 
         SET 
           billing_tier = 'STANDALONE',
           billing_model = 'SUBSCRIPTION',
           billing_status = 'ACTIVE',
           billing_period = $1,
           billing_start_date = $2,
           monthly_ai_credits = 0,
           selected_product = 'DIGITAL_MENU',
           is_trial = false,
           trial_ends_at = NULL,
           custom_plan_price = $3
         WHERE id = $4`,
        [billingCycle, now.toISOString(), options.customPrice || null, restaurantId]
      );

      // Enable only Digital Menu modules
      const digitalMenuModules = [
        { name: 'DIGITAL_MENU', enabled: true },
        { name: 'ONLINE_ORDERING', enabled: true },
        { name: 'QUEUE_MANAGEMENT', enabled: false },
        { name: 'INVENTORY', enabled: false },
        { name: 'LOYALTY_PROGRAM', enabled: false },
        { name: 'FINANCE_MANAGEMENT', enabled: false },
        { name: 'ANALYTICS', enabled: false },
        { name: 'REPORTS', enabled: false },
      ];

      for (const mod of digitalMenuModules) {
        await pool.query(
          `INSERT INTO restaurant_modules (restaurant_id, module_name, is_enabled)
           VALUES ($1, $2, $3)
           ON CONFLICT (restaurant_id, module_name)
           DO UPDATE SET is_enabled = $3, updated_at = NOW()`,
          [restaurantId, mod.name, mod.enabled]
        );
      }

      return {
        product: 'DIGITAL_MENU',
        is_trial: false,
        trial_days: 0,
        trial_ends_at: null,
        tier: 'STANDALONE',
        billing_cycle: billingCycle,
        monthly_ai_credits: 0,
        unlocked_tier: 'STANDALONE',
      };
    } else if (selectedProduct === 'QUEUE_MANAGEMENT') {
      // Standalone Queue Management
      await pool.query(
        `UPDATE restaurants 
         SET 
           billing_tier = 'STANDALONE',
           billing_model = 'SUBSCRIPTION',
           billing_status = 'ACTIVE',
           billing_period = $1,
           billing_start_date = $2,
           monthly_ai_credits = 0,
           selected_product = 'QUEUE_MANAGEMENT',
           is_trial = false,
           trial_ends_at = NULL,
           custom_plan_price = $3
         WHERE id = $4`,
        [billingCycle, now.toISOString(), options.customPrice || null, restaurantId]
      );

      // Enable only Queue Management module
      const qModules = [
        { name: 'DIGITAL_MENU', enabled: false },
        { name: 'ONLINE_ORDERING', enabled: false },
        { name: 'QUEUE_MANAGEMENT', enabled: true },
        { name: 'INVENTORY', enabled: false },
        { name: 'LOYALTY_PROGRAM', enabled: false },
        { name: 'FINANCE_MANAGEMENT', enabled: false },
        { name: 'ANALYTICS', enabled: false },
        { name: 'REPORTS', enabled: false },
      ];

      for (const mod of qModules) {
        await pool.query(
          `INSERT INTO restaurant_modules (restaurant_id, module_name, is_enabled)
           VALUES ($1, $2, $3)
           ON CONFLICT (restaurant_id, module_name)
           DO UPDATE SET is_enabled = $3, updated_at = NOW()`,
          [restaurantId, mod.name, mod.enabled]
        );
      }

      return {
        product: 'QUEUE_MANAGEMENT',
        is_trial: false,
        trial_days: 0,
        trial_ends_at: null,
        tier: 'STANDALONE',
        billing_cycle: billingCycle,
        monthly_ai_credits: 0,
        unlocked_tier: 'STANDALONE',
      };
    }

    throw new Error(`Unsupported product: ${selectedProduct}`);
  }
}

