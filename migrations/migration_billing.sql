-- Migration: Add Billing Fields and Billing Tables

-- 1. Alter restaurants table
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS billing_tier VARCHAR(50) DEFAULT 'BASIC';
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS billing_model VARCHAR(50) DEFAULT 'SUBSCRIPTION';
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS billing_status VARCHAR(50) DEFAULT 'ACTIVE';
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS billing_start_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS billing_end_date TIMESTAMP WITH TIME ZONE;

-- 2. Create billing_transactions table
CREATE TABLE IF NOT EXISTS billing_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    transaction_type VARCHAR(50) NOT NULL, -- SUBSCRIPTION, PER_ORDER, OTP, ONE_TIME, ADJUSTMENT
    amount DECIMAL(10,2) NOT NULL,
    reference_id VARCHAR(100),
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for billing transactions performance
CREATE INDEX IF NOT EXISTS idx_billing_tx_restaurant_id ON billing_transactions(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_billing_tx_created_at ON billing_transactions(created_at);

-- 3. Create monthly_billing_summary table
CREATE TABLE IF NOT EXISTS monthly_billing_summary (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
    year INTEGER NOT NULL,
    order_charges DECIMAL(10,2) DEFAULT 0.00,
    otp_charges DECIMAL(10,2) DEFAULT 0.00,
    subscription_charges DECIMAL(10,2) DEFAULT 0.00,
    adjustments DECIMAL(10,2) DEFAULT 0.00,
    total_amount DECIMAL(10,2) DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_restaurant_month_year UNIQUE (restaurant_id, month, year)
);

CREATE INDEX IF NOT EXISTS idx_monthly_billing_lookup ON monthly_billing_summary(restaurant_id, year, month);
