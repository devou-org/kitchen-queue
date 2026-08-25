-- Migration: AI Credits Table and Per-Restaurant Quota Settings
-- Date: 2026-08-25

-- 1. Add tokens_per_credit column to global gemini_config table (Default: 2000 tokens = 1 credit)
ALTER TABLE gemini_config 
ADD COLUMN IF NOT EXISTS tokens_per_credit INTEGER NOT NULL DEFAULT 2000;

-- 2. Add custom AI credits columns to restaurants table
-- default_monthly_credits: allocated per month (default 10 credits)
-- custom_ai_credits_override: NULL by default; if set, overrides default monthly credits for that specific restaurant
ALTER TABLE restaurants
ADD COLUMN IF NOT EXISTS monthly_ai_credits INTEGER NOT NULL DEFAULT 10,
ADD COLUMN IF NOT EXISTS custom_ai_credits INTEGER DEFAULT NULL;

-- 3. Create ai_credits table to track monthly credit usage and token usage per restaurant
CREATE TABLE IF NOT EXISTS ai_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  billing_period VARCHAR(7) NOT NULL, -- Format: 'YYYY-MM', e.g. '2026-08'
  allocated_credits INTEGER NOT NULL DEFAULT 10,
  used_credits NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  used_tokens BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_restaurant_billing_period UNIQUE (restaurant_id, billing_period)
);

-- Index for fast lookup by restaurant and billing period
CREATE INDEX IF NOT EXISTS idx_ai_credits_restaurant_period ON ai_credits(restaurant_id, billing_period);

-- Insert fallback row in gemini_config if not exists
INSERT INTO gemini_config (id, model, rpm_limit, tpm_limit, rpd_limit, max_output_tokens, is_enabled, tokens_per_credit)
SELECT gen_random_uuid(), 'gemini-3.5-flash-lite', 15, 200000, 1500, 2000, true, 2000
WHERE NOT EXISTS (SELECT 1 FROM gemini_config);
