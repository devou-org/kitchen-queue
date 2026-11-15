// Billing Tiers
export type BillingTier = 'BASIC' | 'PRO' | 'COMPLETE' | 'STANDALONE' | 'ESSENTIAL' | 'PREMIUM';

// Billing Models
export type BillingModel = 'SUBSCRIPTION' | 'PER_ORDER' | 'ONE_TIME';

export interface TierPricing {
  name: string;
  features: string[];
  subscriptionMonthly: number;
  subscriptionAnnual?: number;
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
    subscriptionAnnual: 3999,
    oneTime: null,
    otpCharge: null,
    perOrder: null,
  },
  PRO: {
    name: 'Pro',
    features: ['DIGITAL_MENU', 'QUEUE_MANAGEMENT'],
    subscriptionMonthly: 999,
    subscriptionAnnual: 9999,
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
    subscriptionAnnual: 14999,
    oneTime: 30000,
    otpCharge: 0.50,
    perOrder: {
      commissionPercent: 0.03,
      flatLimit: 100,
      flatCharge: 3,
    },
  },
  STANDALONE: {
    name: 'Standalone Plan',
    features: ['DIGITAL_MENU'],
    subscriptionMonthly: 299,
    subscriptionAnnual: 2999,
    oneTime: null,
    otpCharge: 0.50,
    perOrder: null,
  },
  ESSENTIAL: {
    name: 'Essential Plan',
    features: ['POS', 'TABLE_MANAGEMENT', 'DIGITAL_MENU', 'ANALYTICS', 'REPORTS'],
    subscriptionMonthly: 699,
    subscriptionAnnual: 6999,
    oneTime: null,
    otpCharge: 0.50,
    perOrder: null,
  },
  PREMIUM: {
    name: 'Premium Plan',
    features: ['POS', 'TABLE_MANAGEMENT', 'DIGITAL_MENU', 'ANALYTICS', 'REPORTS', 'INVENTORY', 'LOYALTY_PROGRAM', 'FINANCE_MANAGEMENT', 'QUEUE_MANAGEMENT'],
    subscriptionMonthly: 999,
    subscriptionAnnual: 9999,
    oneTime: null,
    otpCharge: 0.50,
    perOrder: null,
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

  if (tier === 'PRO' && model === 'PER_ORDER') {
    return { valid: false, error: 'Tier Pro does not support Per Order (Commission) billing.' };
  }

  return { valid: true };
}
