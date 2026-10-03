-- ============================================================================
-- FIX CATEGORIES MULTI-TENANT CONSTRAINT
-- ============================================================================
-- Drops the obsolete global UNIQUE(name) constraint on categories table so
-- that multiple restaurants can have categories with the same name (e.g. "Beverages").
-- Scoping is enforced per restaurant by categories_restaurant_id_name_key UNIQUE(restaurant_id, name).

BEGIN;

-- 1. Drop old single-tenant unique constraint and index on name
ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_name_key;
DROP INDEX IF EXISTS categories_name_key;

-- 2. Ensure multi-tenant composite unique constraint exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'categories_restaurant_id_name_key'
    ) THEN
        ALTER TABLE categories ADD CONSTRAINT categories_restaurant_id_name_key UNIQUE (restaurant_id, name);
    END IF;
END $$;

COMMIT;
