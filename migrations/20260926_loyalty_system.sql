-- Migration: Comprehensive Loyalty System Tables (CRM-based)
-- Created: 2026-09-26

-- 1. Loyalty Settings (Per-Restaurant Configuration)
CREATE TABLE IF NOT EXISTS loyalty_settings (
  restaurant_id UUID PRIMARY KEY REFERENCES restaurants(id) ON DELETE CASCADE,
  is_enabled BOOLEAN DEFAULT true,
  points_earning_rate DECIMAL(10, 4) DEFAULT 0.1000, -- e.g. 0.1 = 1 point per 10 INR spent
  points_redemption_rate_points INT DEFAULT 100,       -- e.g. 100 points = 50 INR
  points_redemption_rate_amount DECIMAL(10, 2) DEFAULT 50.00,
  points_expiry_type VARCHAR(50) DEFAULT 'NEVER',       -- 'NEVER', 'EXPIRE_AFTER_DAYS'
  points_expiry_days INT DEFAULT 365,
  min_order_amount DECIMAL(10, 2) DEFAULT 0.00,
  visit_milestone_count INT DEFAULT 5,                 -- e.g. every 5th visit
  visit_reward_type VARCHAR(50) DEFAULT 'DISCOUNT_AMOUNT', -- 'DISCOUNT_AMOUNT', 'FREE_ITEM'
  visit_reward_value VARCHAR(255) DEFAULT '100',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Loyalty Rewards Catalog ("Add New Reward" Form)
CREATE TABLE IF NOT EXISTS loyalty_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  points_required INT NOT NULL,
  reward_type VARCHAR(50) NOT NULL, -- 'FREE_ITEM', 'DISCOUNT_AMOUNT', 'DISCOUNT_PERCENTAGE'
  discount_value DECIMAL(10, 2) DEFAULT 0.00,
  selected_product_ids JSONB DEFAULT '[]'::jsonb,
  min_purchase_amount DECIMAL(10, 2) DEFAULT 0.00,
  valid_until TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_loyalty_rewards_restaurant ON loyalty_rewards(restaurant_id);

-- 3. Customer Loyalty (Per-Restaurant Customer Ledger linking existing users table)
CREATE TABLE IF NOT EXISTS customer_loyalty (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  points_balance DECIMAL(10, 2) DEFAULT 0.00,
  total_points_earned DECIMAL(10, 2) DEFAULT 0.00,
  total_points_redeemed DECIMAL(10, 2) DEFAULT 0.00,
  total_visits INT DEFAULT 0,
  visit_progress INT DEFAULT 0,
  rewards_unlocked INT DEFAULT 0,
  total_spent DECIMAL(10, 2) DEFAULT 0.00,
  last_visit_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_customer_restaurant_loyalty UNIQUE (restaurant_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_customer_loyalty_restaurant ON customer_loyalty(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_customer_loyalty_user ON customer_loyalty(user_id);

-- 4. Loyalty Transactions (Audit Log & Order Traceability)
CREATE TABLE IF NOT EXISTS loyalty_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  customer_loyalty_id UUID NOT NULL REFERENCES customer_loyalty(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  reward_id UUID REFERENCES loyalty_rewards(id) ON DELETE SET NULL,
  transaction_type VARCHAR(50) NOT NULL, -- 'EARN_POINTS', 'REDEEM_POINTS', 'EARN_VISIT', 'CLAIM_REWARD', 'REVERSAL_REFUND', 'MANUAL_ADJUSTMENT', 'POINTS_EXPIRED'
  points_delta DECIMAL(10, 2) DEFAULT 0.00,
  visit_delta INT DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_loyalty_tx_restaurant ON loyalty_transactions(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_tx_customer ON loyalty_transactions(customer_loyalty_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_tx_order ON loyalty_transactions(order_id);
