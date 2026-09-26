-- ============================================================================
-- CATEGORY REORDERING & RESTAURANT SCOPING MIGRATION
-- ============================================================================

BEGIN;

-- 1. Ensure columns exist on categories table
ALTER TABLE categories ADD COLUMN IF NOT EXISTS restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- 2. Populate categories table with all unique (restaurant_id, category) from products
INSERT INTO categories (restaurant_id, name, sort_order)
SELECT DISTINCT
    p.restaurant_id, 
    TRIM(p.category) AS name, 
    10 AS sort_order
FROM products p
WHERE p.restaurant_id IS NOT NULL 
  AND p.category IS NOT NULL 
  AND TRIM(p.category) != ''
ON CONFLICT DO NOTHING;

-- Clean up any unlinked categories without a restaurant_id
DELETE FROM categories WHERE restaurant_id IS NULL;

-- Make restaurant_id NOT NULL after cleaning up
ALTER TABLE categories ALTER COLUMN restaurant_id SET NOT NULL;

-- 3. Add unique constraint for restaurant_id + name
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'categories_restaurant_id_name_key'
    ) THEN
        ALTER TABLE categories ADD CONSTRAINT categories_restaurant_id_name_key UNIQUE (restaurant_id, name);
    END IF;
END $$;

-- 4. Assign clean sequential sort_orders (10, 20, 30...) grouped by restaurant
WITH RankedCategories AS (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY restaurant_id ORDER BY name ASC) * 10 as new_order
    FROM categories
)
UPDATE categories c
SET sort_order = rc.new_order
FROM RankedCategories rc
WHERE c.id = rc.id;

-- 5. Create index on restaurant_id and sort_order for fast menu ordering
CREATE INDEX IF NOT EXISTS idx_categories_restaurant_sort ON categories(restaurant_id, sort_order ASC);

COMMIT;
