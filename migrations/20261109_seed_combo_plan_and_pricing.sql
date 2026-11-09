-- Seed 5th Plan: Digital Menu + Queue Combo (Standalone Combo)
INSERT INTO saas_plans (id, product_id, tier, name, description, monthly_ai_credits, is_default_trial_tier, is_active)
VALUES
('COMBO_STANDALONE', 'DIGITAL_MENU', 'STANDALONE', 'Digital Menu + Queue Combo', 'Standalone digital QR menu and contactless catalogue bundled with live queue & token management.', 0, false, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  is_active = EXCLUDED.is_active;

-- Seed Pricing for Combo Plan
INSERT INTO saas_plan_pricing (plan_id, billing_cycle, price, currency, is_active)
VALUES
('COMBO_STANDALONE', 'ANNUALLY', 4999.00, 'INR', true),
('COMBO_STANDALONE', 'MONTHLY', 499.00, 'INR', true)
ON CONFLICT (plan_id, billing_cycle) DO UPDATE SET
  price = EXCLUDED.price;

-- Seed Features for Combo Plan
INSERT INTO saas_plan_features (plan_id, feature_code, feature_name, feature_description, is_included)
VALUES
('COMBO_STANDALONE', 'DIGITAL_MENU_QR', 'Digital Menu & QR Catalogue', 'Contactless QR menu viewing for customers', true),
('COMBO_STANDALONE', 'MENU_MANAGEMENT', 'Menu Management', 'Complete catalogue, item availability and pricing', true),
('COMBO_STANDALONE', 'PROFILE_BRANDING', 'Customised Profile & Branding', 'Custom brand colours and header presentation', true),
('COMBO_STANDALONE', 'QUEUE_MANAGEMENT', 'Queue Management System', 'Waitlist management, SMS paging, and TV display board', true)
ON CONFLICT (plan_id, feature_code) DO NOTHING;
