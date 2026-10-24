-- =====================================================================
-- Migration: 20261019_finance_module.sql
-- Description: Finance & Accounts Management Module for QDine
-- Includes:
--   1. finance_transactions (Central unified income & expense ledger)
--   2. finance_till_reconciliations (End-of-day cash drawer reconciliation)
--   3. finance_daily_summaries (Fast pre-aggregated daily summaries)
-- =====================================================================

-- 1. FINANCE TRANSACTIONS TABLE
CREATE TABLE IF NOT EXISTS finance_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    entry_type VARCHAR(20) NOT NULL CHECK (entry_type IN ('INCOME', 'EXPENSE')),
    source VARCHAR(50) NOT NULL CHECK (source IN ('POS_SALES', 'INVENTORY_PURCHASE', 'PETTY_CASH', 'OVERHEAD', 'OTHER')),
    reference_id UUID,
    reference_number VARCHAR(100),
    category VARCHAR(100) NOT NULL DEFAULT 'General',
    amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    tax_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    net_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    payment_method VARCHAR(50) NOT NULL DEFAULT 'UPI',
    description TEXT,
    receipt_url TEXT,
    created_by UUID,
    transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for finance transactions
CREATE INDEX IF NOT EXISTS idx_finance_tx_restaurant_date 
    ON finance_transactions(restaurant_id, transaction_date DESC);

CREATE INDEX IF NOT EXISTS idx_finance_tx_restaurant_type 
    ON finance_transactions(restaurant_id, entry_type);

CREATE INDEX IF NOT EXISTS idx_finance_tx_reference 
    ON finance_transactions(reference_id) 
    WHERE reference_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_finance_tx_restaurant_source 
    ON finance_transactions(restaurant_id, source);

-- 2. TILL RECONCILIATIONS TABLE
CREATE TABLE IF NOT EXISTS finance_till_reconciliations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    business_date DATE NOT NULL,
    opening_cash DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    system_cash_sales DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    cash_expenses DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    expected_drawer_cash DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    actual_counted_cash DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    discrepancy DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    status VARCHAR(20) NOT NULL DEFAULT 'BALANCED' CHECK (status IN ('BALANCED', 'SHORT', 'OVER')),
    notes TEXT,
    closed_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_till_restaurant_date UNIQUE(restaurant_id, business_date)
);

CREATE INDEX IF NOT EXISTS idx_till_recon_restaurant_date 
    ON finance_till_reconciliations(restaurant_id, business_date DESC);

-- 3. DAILY SUMMARIES TABLE
CREATE TABLE IF NOT EXISTS finance_daily_summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    business_date DATE NOT NULL,
    total_revenue DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    cogs_expenses DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    operating_expenses DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    tax_collected DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    tax_paid DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    net_profit DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_finance_summary_restaurant_date UNIQUE(restaurant_id, business_date)
);

CREATE INDEX IF NOT EXISTS idx_finance_summary_restaurant_date 
    ON finance_daily_summaries(restaurant_id, business_date DESC);
