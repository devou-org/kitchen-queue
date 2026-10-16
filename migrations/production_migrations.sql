-- ============================================================================
-- CONSOLIDATED PRODUCTION MIGRATION FOR AI ANALYST & AI CREDIT MANAGEMENT
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. GEMINI GLOBAL CONFIGURATION & QUOTA MANAGEMENT
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS gemini_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model VARCHAR(100) NOT NULL DEFAULT 'gemini-3.5-flash-lite',
    rpm_limit INTEGER NOT NULL DEFAULT 15,
    tpm_limit BIGINT NOT NULL DEFAULT 200000,
    rpd_limit INTEGER NOT NULL DEFAULT 1500,
    max_output_tokens INTEGER NOT NULL DEFAULT 2000,
    is_enabled BOOLEAN NOT NULL DEFAULT true,
    tokens_per_credit INTEGER NOT NULL DEFAULT 2000,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Ensure tokens_per_credit column exists if table was created previously
ALTER TABLE gemini_config 
ADD COLUMN IF NOT EXISTS tokens_per_credit INTEGER NOT NULL DEFAULT 2000;

-- Seed default global configuration if table is empty
INSERT INTO gemini_config (model, rpm_limit, tpm_limit, rpd_limit, max_output_tokens, is_enabled, tokens_per_credit)
SELECT 'gemini-3.5-flash-lite', 15, 200000, 1500, 2000, true, 2000
WHERE NOT EXISTS (SELECT 1 FROM gemini_config);

-- ----------------------------------------------------------------------------
-- 2. DAILY USAGE & REQUEST LOGGING
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS gemini_daily_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usage_date DATE UNIQUE NOT NULL,
    request_count INTEGER NOT NULL DEFAULT 0,
    input_tokens BIGINT NOT NULL DEFAULT 0,
    is_enabled BOOLEAN NOT NULL DEFAULT true,
    disabled_reason VARCHAR(50) NULL,
    disabled_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS gemini_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NULL REFERENCES restaurants(id) ON DELETE SET NULL,
    request_type VARCHAR(50) NOT NULL,
    model VARCHAR(100) NOT NULL,
    input_tokens INTEGER DEFAULT 0,
    output_tokens INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    status VARCHAR(30) NOT NULL,
    error_code VARCHAR(100) NULL,
    error_message TEXT NULL,
    response_time_ms INTEGER NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS gemini_request_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_type VARCHAR(50) UNIQUE NOT NULL,
    max_output_tokens INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Seed request configs for AI operations
INSERT INTO gemini_request_config (request_type, max_output_tokens)
VALUES
    ('MENU_EXTRACTION', 4000),
    ('PRODUCT_EXTRACTION', 500),
    ('DESCRIPTION_GENERATION', 2000),
    ('BUSINESS_ANALYST_CHAT', 10000)
ON CONFLICT (request_type) 
DO UPDATE SET max_output_tokens = EXCLUDED.max_output_tokens, updated_at = CURRENT_TIMESTAMP;

CREATE TABLE IF NOT EXISTS gemini_usage_monthly (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL,
    usage_year INTEGER NOT NULL,
    usage_month INTEGER NOT NULL,
    request_count INTEGER NOT NULL DEFAULT 0,
    input_tokens BIGINT NOT NULL DEFAULT 0,
    output_tokens BIGINT NOT NULL DEFAULT 0,
    total_tokens BIGINT NOT NULL DEFAULT 0,
    success_count INTEGER NOT NULL DEFAULT 0,
    error_count INTEGER NOT NULL DEFAULT 0,
    UNIQUE (restaurant_id, usage_year, usage_month)
);

-- ----------------------------------------------------------------------------
-- 3. RESTAURANT AI CREDIT ALLOCATION & USAGE TRACKING
-- ----------------------------------------------------------------------------

-- Add AI credit allowance fields to restaurants table
ALTER TABLE restaurants
ADD COLUMN IF NOT EXISTS monthly_ai_credits INTEGER NOT NULL DEFAULT 10,
ADD COLUMN IF NOT EXISTS custom_ai_credits INTEGER DEFAULT NULL;

-- Create ai_credits table for tracking monthly usage against credit limits
CREATE TABLE IF NOT EXISTS ai_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  billing_period VARCHAR(7) NOT NULL, -- Format: 'YYYY-MM'
  allocated_credits INTEGER NOT NULL DEFAULT 10,
  used_credits NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  used_tokens BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_restaurant_billing_period UNIQUE (restaurant_id, billing_period)
);

CREATE INDEX IF NOT EXISTS idx_ai_credits_restaurant_period ON ai_credits(restaurant_id, billing_period);

-- ----------------------------------------------------------------------------
-- 4. AI BUSINESS ANALYST CHAT SESSIONS & MESSAGES
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS ai_chat_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL DEFAULT 'Business Analysis Chat',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ai_chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES ai_chat_sessions(id) ON DELETE CASCADE,
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL,
    content TEXT NOT NULL,
    tool_calls JSONB NULL,
    tool_results JSONB NULL,
    tokens_used INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_chat_messages_session ON ai_chat_messages(session_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_ai_chat_sessions_restaurant ON ai_chat_sessions(restaurant_id, updated_at DESC);

COMMIT;
