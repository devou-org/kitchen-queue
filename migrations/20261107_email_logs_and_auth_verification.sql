-- Migration: 20261107_email_logs_and_auth_verification.sql
-- Adds email_logs, auth_verification_tokens, and admin email verification status

-- 1. Create email_logs table for comprehensive audit of all outbound emails
CREATE TABLE IF NOT EXISTS email_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_email VARCHAR(255) NOT NULL,
    subject VARCHAR(255) NOT NULL,
    template_type VARCHAR(100) NOT NULL, -- 'EMAIL_VERIFICATION', 'PASSWORD_RESET', 'PASSWORD_CHANGED', 'WELCOME_ONBOARDING', 'GENERAL'
    status VARCHAR(50) NOT NULL, -- 'SENT', 'FAILED', 'SIMULATED'
    provider VARCHAR(50) NOT NULL, -- 'console', 'smtp', 'resend', 'custom'
    provider_message_id VARCHAR(255),
    error_message TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_email_logs_recipient ON email_logs(recipient_email);
CREATE INDEX IF NOT EXISTS idx_email_logs_template ON email_logs(template_type);
CREATE INDEX IF NOT EXISTS idx_email_logs_created_at ON email_logs(created_at DESC);

-- 2. Create auth_verification_tokens table for OTP & Token verification lifecycle
CREATE TABLE IF NOT EXISTS auth_verification_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL,
    token VARCHAR(255) NOT NULL,
    token_type VARCHAR(50) NOT NULL, -- 'EMAIL_VERIFICATION', 'PASSWORD_RESET'
    expires_at TIMESTAMPTZ NOT NULL,
    is_used BOOLEAN DEFAULT false,
    used_at TIMESTAMPTZ DEFAULT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_auth_tokens_lookup ON auth_verification_tokens(email, token, token_type);
CREATE INDEX IF NOT EXISTS idx_auth_tokens_expires_at ON auth_verification_tokens(expires_at);

-- 3. Extend admins table with verification status
ALTER TABLE admins
ADD COLUMN IF NOT EXISTS is_email_verified BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ DEFAULT NULL;
