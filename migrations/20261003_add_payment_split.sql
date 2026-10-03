-- ============================================================================
-- ADD PAYMENT SPLIT SUPPORT & EXPAND PAYMENT METHOD
-- ============================================================================
-- Expands orders.payment_method to VARCHAR(255) to accommodate descriptive split labels
-- and adds orders.payment_split JSONB column for detailed payment allocation tracking.

BEGIN;

ALTER TABLE orders 
  ALTER COLUMN payment_method TYPE VARCHAR(255);

ALTER TABLE orders 
  ADD COLUMN IF NOT EXISTS payment_split JSONB;

COMMIT;
