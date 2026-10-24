-- ============================================================================
-- QDINE: ITEMWISE KITCHEN NOTES ARCHITECTURE MIGRATION
-- ============================================================================

BEGIN;

-- Add notes column to order_items for per-item kitchen instructions
ALTER TABLE order_items 
ADD COLUMN IF NOT EXISTS notes TEXT;

COMMIT;
