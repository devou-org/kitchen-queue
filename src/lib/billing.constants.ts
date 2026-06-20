// Billing Tiers
export type BillingTier = 'BASIC' | 'PRO' | 'COMPLETE';

// Billing Models
export type BillingModel = 'SUBSCRIPTION' | 'PER_ORDER' | 'ONE_TIME';

export interface TierPricing {
  name: string;
  features: string[];
  subscriptionMonthly: number;
  oneTime: number | null; // null if not available
  otpCharge: number | null; // null if not available
  perOrder: {
    commissionPercent: number; // e.g. 0.02 (2%)
    flatLimit: number; // ₹100
    flatCharge: number; // ₹2
  } | null; // null if not available
}

export const BILLING_PRICING: Record<BillingTier, TierPricing> = {
  BASIC: {
    name: 'Basic',
    features: ['DIGITAL_MENU'],
    subscriptionMonthly: 399,
    oneTime: null,
    otpCharge: null,
    perOrder: null,
  },
  PRO: {
    name: 'Pro',
    features: ['DIGITAL_MENU', 'QUEUE_MANAGEMENT'],
    subscriptionMonthly: 999,
    oneTime: 15000,
    otpCharge: 0.50,
    perOrder: {
      commissionPercent: 0.02,
      flatLimit: 100,
      flatCharge: 2,
    },
  },
  COMPLETE: {
    name: 'Complete',
    features: ['DIGITAL_MENU', 'QUEUE_MANAGEMENT', 'ALL_FEATURES'],
    subscriptionMonthly: 1499,
    oneTime: 30000,
    otpCharge: 0.50,
    perOrder: {
      commissionPercent: 0.03,
      flatLimit: 100,
      flatCharge: 3,
    },
  },
};

// Validation rules
export function validateTierAndModel(tier: BillingTier, model: BillingModel): { valid: boolean; error?: string } {
  const pricing = BILLING_PRICING[tier];
  if (!pricing) {
    return { valid: false, error: 'Invalid billing tier.' };
  }

  if (tier === 'BASIC') {
    if (model === 'PER_ORDER') {
      return { valid: false, error: 'Tier Basic does not support Per Order billing.' };
    }
    if (model === 'ONE_TIME') {
      return { valid: false, error: 'Tier Basic does not support One Time billing.' };
    }
  }

  return { valid: true };
}
