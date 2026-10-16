-- Migration: Gemini Global Usage & Quota Management System
-- Date: 2026-08-09

-- 1. TABLE: gemini_config (Global Configuration - No restaurant_id)
CREATE TABLE IF NOT EXISTS gemini_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model VARCHAR(100) NOT NULL DEFAULT 'gemini-flash-latest',
    rpm_limit INTEGER NOT NULL DEFAULT 10,
    tpm_limit BIGINT NOT NULL DEFAULT 200000,
    rpd_limit INTEGER NOT NULL DEFAULT 200,
    max_output_tokens INTEGER NOT NULL DEFAULT 1000,
    is_enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Seed default global configuration if table is empty
INSERT INTO gemini_config (model, rpm_limit, tpm_limit, rpd_limit, max_output_tokens, is_enabled)
SELECT 'gemini-flash-latest', 10, 200000, 200, 1000, true
WHERE NOT EXISTS (SELECT 1 FROM gemini_config);

-- 2. TABLE: gemini_daily_usage (Global Usage for current usage day)
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

-- 3. TABLE: gemini_usage (Individual Gemini request log - restaurant_id for attribution only)
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

-- 4. TABLE: gemini_request_config (Operation-specific output limits)
CREATE TABLE IF NOT EXISTS gemini_request_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_type VARCHAR(50) UNIQUE NOT NULL,
    max_output_tokens INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Seed request-specific output limits
INSERT INTO gemini_request_config (request_type, max_output_tokens)
VALUES
    ('MENU_EXTRACTION', 4000),
    ('PRODUCT_EXTRACTION', 500),
    ('DESCRIPTION_GENERATION', 2000)
ON CONFLICT (request_type) DO NOTHING;

-- 5. TABLE: gemini_usage_monthly (Monthly aggregate per restaurant)
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
