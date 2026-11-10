-- 1. Update QUEUE_MGMT_STANDALONE plan to be the combo (Q Management + Digital Menu)
UPDATE saas_plans
SET 
  name = 'Q Management & Digital Menu',
  description = 'Standalone digital queue management with live waitlists, customer paging, and contactless QR digital menu.'
WHERE id = 'QUEUE_MGMT_STANDALONE';

-- 2. Add Digital Menu features to QUEUE_MGMT_STANDALONE
INSERT INTO saas_plan_features (plan_id, feature_code, feature_name, feature_description, is_included)
VALUES
('QUEUE_MGMT_STANDALONE', 'DIGITAL_MENU_QR', 'Digital Menu & QR Catalogue', 'Contactless QR menu viewing for customers while waiting in line', true),
('QUEUE_MGMT_STANDALONE', 'MENU_MANAGEMENT', 'Menu Management', 'Complete catalogue, item availability, and pricing', true),
('QUEUE_MGMT_STANDALONE', 'PROFILE_BRANDING', 'Customised Profile & Branding', 'Custom brand colours and header presentation', true)
ON CONFLICT (plan_id, feature_code) DO UPDATE SET
  is_included = true,
  feature_name = EXCLUDED.feature_name,
  feature_description = EXCLUDED.feature_description;

-- 3. Remove redundant duplicate COMBO_STANDALONE if present
DELETE FROM saas_plan_pricing WHERE plan_id = 'COMBO_STANDALONE';
DELETE FROM saas_plan_features WHERE plan_id = 'COMBO_STANDALONE';
DELETE FROM saas_plans WHERE id = 'COMBO_STANDALONE';

-- 4. For any existing restaurants with selected_product = 'QUEUE_MANAGEMENT', ensure DIGITAL_MENU module is enabled
INSERT INTO restaurant_modules (restaurant_id, module_name, is_enabled)
SELECT id, 'DIGITAL_MENU', true
FROM restaurants
WHERE selected_product = 'QUEUE_MANAGEMENT'
ON CONFLICT (restaurant_id, module_name)
DO UPDATE SET is_enabled = true, updated_at = NOW();

