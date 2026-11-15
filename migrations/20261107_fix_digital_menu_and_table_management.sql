-- Migration: Fix Standalone Digital Menu modules and Table Management defaults
-- Date: 2026-11-07

-- 1. Update Standalone Digital Menu description and feature text in SaaS catalog
UPDATE saas_products 
SET description = 'Standalone digital menu and QR catalogue solution' 
WHERE id = 'DIGITAL_MENU';

UPDATE saas_plans 
SET description = 'Standalone QR menu and contactless catalogue viewing.' 
WHERE id = 'DIGITAL_MENU_STANDALONE';

UPDATE saas_plan_features 
SET feature_name = 'Digital Menu & QR Catalogue',
    feature_description = 'Customers can scan QR codes and browse menu items.'
WHERE plan_id = 'DIGITAL_MENU_STANDALONE' AND feature_code = 'DIGITAL_MENU_QR';

-- 2. For Standalone Digital Menu restaurants, turn off ONLINE_ORDERING and TABLE_MANAGEMENT
INSERT INTO restaurant_modules (restaurant_id, module_name, is_enabled)
SELECT id, 'ONLINE_ORDERING', false 
FROM restaurants 
WHERE selected_product = 'DIGITAL_MENU'
ON CONFLICT (restaurant_id, module_name) DO UPDATE SET is_enabled = false, updated_at = NOW();

INSERT INTO restaurant_modules (restaurant_id, module_name, is_enabled)
SELECT id, 'TABLE_MANAGEMENT', false 
FROM restaurants 
WHERE selected_product = 'DIGITAL_MENU'
ON CONFLICT (restaurant_id, module_name) DO UPDATE SET is_enabled = false, updated_at = NOW();

-- 3. For Standalone Queue Management restaurants, turn off ONLINE_ORDERING, TABLE_MANAGEMENT, and DIGITAL_MENU
INSERT INTO restaurant_modules (restaurant_id, module_name, is_enabled)
SELECT id, 'ONLINE_ORDERING', false 
FROM restaurants 
WHERE selected_product = 'QUEUE_MANAGEMENT'
ON CONFLICT (restaurant_id, module_name) DO UPDATE SET is_enabled = false, updated_at = NOW();

INSERT INTO restaurant_modules (restaurant_id, module_name, is_enabled)
SELECT id, 'TABLE_MANAGEMENT', false 
FROM restaurants 
WHERE selected_product = 'QUEUE_MANAGEMENT'
ON CONFLICT (restaurant_id, module_name) DO UPDATE SET is_enabled = false, updated_at = NOW();

INSERT INTO restaurant_modules (restaurant_id, module_name, is_enabled)
SELECT id, 'DIGITAL_MENU', false 
FROM restaurants 
WHERE selected_product = 'QUEUE_MANAGEMENT'
ON CONFLICT (restaurant_id, module_name) DO UPDATE SET is_enabled = false, updated_at = NOW();

-- 4. For POS restaurants, ensure TABLE_MANAGEMENT is enabled by default
INSERT INTO restaurant_modules (restaurant_id, module_name, is_enabled)
SELECT id, 'TABLE_MANAGEMENT', true 
FROM restaurants 
WHERE selected_product = 'POS' OR selected_product IS NULL
ON CONFLICT (restaurant_id, module_name) DO NOTHING;

-- 5. For POS Essential restaurants, turn off Finance, Inventory, Loyalty, and Queue
INSERT INTO restaurant_modules (restaurant_id, module_name, is_enabled)
SELECT id, 'FINANCE_MANAGEMENT', false 
FROM restaurants 
WHERE billing_tier = 'ESSENTIAL'
ON CONFLICT (restaurant_id, module_name) DO UPDATE SET is_enabled = false, updated_at = NOW();

INSERT INTO restaurant_modules (restaurant_id, module_name, is_enabled)
SELECT id, 'INVENTORY', false 
FROM restaurants 
WHERE billing_tier = 'ESSENTIAL'
ON CONFLICT (restaurant_id, module_name) DO UPDATE SET is_enabled = false, updated_at = NOW();

INSERT INTO restaurant_modules (restaurant_id, module_name, is_enabled)
SELECT id, 'LOYALTY_PROGRAM', false 
FROM restaurants 
WHERE billing_tier = 'ESSENTIAL'
ON CONFLICT (restaurant_id, module_name) DO UPDATE SET is_enabled = false, updated_at = NOW();

INSERT INTO restaurant_modules (restaurant_id, module_name, is_enabled)
SELECT id, 'QUEUE_MANAGEMENT', false 
FROM restaurants 
WHERE billing_tier = 'ESSENTIAL'
ON CONFLICT (restaurant_id, module_name) DO UPDATE SET is_enabled = false, updated_at = NOW();

UPDATE restaurants 
SET monthly_ai_credits = 10 
WHERE billing_tier = 'ESSENTIAL';

-- 6. Clean up duplicates, re-point foreign keys in queues, and ensure unique constraint on queue_status
WITH ranked_status AS (
  SELECT id, restaurant_id, possible_queue_status,
         ROW_NUMBER() OVER (
           PARTITION BY restaurant_id, possible_queue_status 
           ORDER BY 
             CASE WHEN id IN (SELECT queue_status_id FROM queues WHERE queue_status_id IS NOT NULL) THEN 0 ELSE 1 END,
             id
         ) as rn
  FROM queue_status
),
canonical_status AS (
  SELECT id, restaurant_id, possible_queue_status
  FROM ranked_status
  WHERE rn = 1
),
duplicate_status AS (
  SELECT r.id as old_id, c.id as new_id
  FROM ranked_status r
  JOIN canonical_status c 
    ON r.restaurant_id = c.restaurant_id 
   AND r.possible_queue_status = c.possible_queue_status
  WHERE r.rn > 1
)
UPDATE queues q
SET queue_status_id = d.new_id
FROM duplicate_status d
WHERE q.queue_status_id = d.old_id;

WITH ranked_status AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY restaurant_id, possible_queue_status 
           ORDER BY 
             CASE WHEN id IN (SELECT queue_status_id FROM queues WHERE queue_status_id IS NOT NULL) THEN 0 ELSE 1 END,
             id
         ) as rn
  FROM queue_status
)
DELETE FROM queue_status
WHERE id IN (
  SELECT id FROM ranked_status WHERE rn > 1
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'queue_status_restaurant_id_possible_queue_status_key'
    ) THEN
        ALTER TABLE queue_status 
        ADD CONSTRAINT queue_status_restaurant_id_possible_queue_status_key 
        UNIQUE (restaurant_id, possible_queue_status);
    END IF;
END $$;

-- 7. Seed default queue statuses (Pending, Seated, Cancelled) for all restaurants
INSERT INTO queue_status (restaurant_id, possible_queue_status, color, priority)
SELECT id, 'PENDING', '#f59e0b', 1
FROM restaurants
ON CONFLICT (restaurant_id, possible_queue_status) DO NOTHING;

INSERT INTO queue_status (restaurant_id, possible_queue_status, color, priority)
SELECT id, 'SEATED', '#10b981', 2
FROM restaurants
ON CONFLICT (restaurant_id, possible_queue_status) DO NOTHING;

INSERT INTO queue_status (restaurant_id, possible_queue_status, color, priority)
SELECT id, 'CANCELLED', '#ef4444', 3
FROM restaurants
ON CONFLICT (restaurant_id, possible_queue_status) DO NOTHING;

