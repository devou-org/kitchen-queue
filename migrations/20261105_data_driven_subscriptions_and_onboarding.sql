-- Migration: 20261105_data_driven_subscriptions_and_onboarding.sql
-- Enables completely data-driven products, plans, pricing cycles, features, and onboarding rules

-- 1. SaaS Products Table
CREATE TABLE IF NOT EXISTS saas_products (
    id VARCHAR(50) PRIMARY KEY, -- 'POS', 'DIGITAL_MENU', 'QUEUE_MANAGEMENT'
    name VARCHAR(100) NOT NULL,
    description TEXT,
    has_trial BOOLEAN DEFAULT false,
    trial_days INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. SaaS Subscription Plans Table
CREATE TABLE IF NOT EXISTS saas_plans (
    id VARCHAR(50) PRIMARY KEY, -- 'POS_ESSENTIAL', 'POS_PREMIUM', 'DIGITAL_MENU_STANDALONE', 'QUEUE_MGMT_STANDALONE'
    product_id VARCHAR(50) NOT NULL REFERENCES saas_products(id) ON DELETE CASCADE,
    tier VARCHAR(50) NOT NULL, -- 'ESSENTIAL', 'PREMIUM', 'STANDALONE'
    name VARCHAR(100) NOT NULL,
    description TEXT,
    monthly_ai_credits INTEGER NOT NULL DEFAULT 0,
    is_default_trial_tier BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. SaaS Plan Pricing (Independent Billing Cycles: Monthly / Annually)
CREATE TABLE IF NOT EXISTS saas_plan_pricing (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id VARCHAR(50) NOT NULL REFERENCES saas_plans(id) ON DELETE CASCADE,
    billing_cycle VARCHAR(20) NOT NULL CHECK (billing_cycle IN ('MONTHLY', 'ANNUALLY')),
    price DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'INR',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_plan_billing_cycle UNIQUE (plan_id, billing_cycle)
);

-- 4. SaaS Plan Features & Module Mapping
CREATE TABLE IF NOT EXISTS saas_plan_features (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id VARCHAR(50) NOT NULL REFERENCES saas_plans(id) ON DELETE CASCADE,
    feature_code VARCHAR(50) NOT NULL,
    feature_name VARCHAR(100) NOT NULL,
    feature_description TEXT,
    is_included BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_plan_feature UNIQUE (plan_id, feature_code)
);

-- 5. Extend Restaurants Table with Product and Trial tracking
ALTER TABLE restaurants
ADD COLUMN IF NOT EXISTS selected_product VARCHAR(50) DEFAULT 'POS',
ADD COLUMN IF NOT EXISTS is_trial BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
ADD COLUMN IF NOT EXISTS custom_plan_price DECIMAL(10, 2) DEFAULT NULL;

-- 6. Seed SaaS Products
INSERT INTO saas_products (id, name, description, has_trial, trial_days, is_active)
VALUES
('POS', 'Point of Sale (POS)', 'Complete restaurant POS with Essential and Premium plans', true, 14, true),
('DIGITAL_MENU', 'Digital Menu', 'Standalone digital menu and QR catalogue solution', false, 0, true),
('QUEUE_MANAGEMENT', 'Q Management System', 'Standalone queue management and waitlist solution', false, 0, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  has_trial = EXCLUDED.has_trial,
  trial_days = EXCLUDED.trial_days,
  is_active = EXCLUDED.is_active;

-- 7. Seed SaaS Plans
INSERT INTO saas_plans (id, product_id, tier, name, description, monthly_ai_credits, is_default_trial_tier, is_active)
VALUES
('POS_ESSENTIAL', 'POS', 'ESSENTIAL', 'Essential Plan', 'Core POS, QR ordering, menu, sales & statements, profile branding, and 10 AI credits.', 10, false, true),
('POS_PREMIUM', 'POS', 'PREMIUM', 'Premium Plan', 'Everything in Essential plus inventory, loyalty, 30 AI credits, finance management, and free access to new features.', 30, true, true),
('DIGITAL_MENU_STANDALONE', 'DIGITAL_MENU', 'STANDALONE', 'Digital Menu Standalone', 'Standalone QR menu and contactless catalogue viewing.', 0, false, true),
('QUEUE_MGMT_STANDALONE', 'QUEUE_MANAGEMENT', 'STANDALONE', 'Q Management Standalone', 'Standalone digital queue management and guest paging.', 0, false, true)
ON CONFLICT (id) DO UPDATE SET
  tier = EXCLUDED.tier,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  monthly_ai_credits = EXCLUDED.monthly_ai_credits,
  is_default_trial_tier = EXCLUDED.is_default_trial_tier,
  is_active = EXCLUDED.is_active;

-- 8. Seed Plan Pricing (Configurable Monthly and Annually)
INSERT INTO saas_plan_pricing (plan_id, billing_cycle, price, currency)
VALUES
-- Essential Plan: ₹6,999/yr, ₹699/mo (configurable)
('POS_ESSENTIAL', 'ANNUALLY', 6999.00, 'INR'),
('POS_ESSENTIAL', 'MONTHLY', 699.00, 'INR'),
-- Premium Plan: ₹9,999/yr, ₹999/mo (configurable)
('POS_PREMIUM', 'ANNUALLY', 9999.00, 'INR'),
('POS_PREMIUM', 'MONTHLY', 999.00, 'INR'),
-- Digital Menu Standalone
('DIGITAL_MENU_STANDALONE', 'ANNUALLY', 2999.00, 'INR'),
('DIGITAL_MENU_STANDALONE', 'MONTHLY', 299.00, 'INR'),
-- Queue Management Standalone
('QUEUE_MGMT_STANDALONE', 'ANNUALLY', 2999.00, 'INR'),
('QUEUE_MGMT_STANDALONE', 'MONTHLY', 299.00, 'INR')
ON CONFLICT (plan_id, billing_cycle) DO UPDATE SET
  price = EXCLUDED.price;

-- 9. Seed Plan Features
-- Essential Features
INSERT INTO saas_plan_features (plan_id, feature_code, feature_name, feature_description, is_included)
VALUES
('POS_ESSENTIAL', 'POS_TABLE_MANAGEMENT', 'POS & Table Management', 'Complete control over floor plans, orders and checkout processes.', true),
('POS_ESSENTIAL', 'DIGITAL_MENU_QR', 'Digital Menu & QR Ordering', 'Customers can scan QR codes and place orders instantly.', true),
('POS_ESSENTIAL', 'MENU_MANAGEMENT', 'Menu Management', 'Manage the entire product catalogue, variations and pricing.', true),
('POS_ESSENTIAL', 'SALES_STATEMENTS', 'Sales & Statements', 'Detailed reports and daily statements to track revenue.', true),
('POS_ESSENTIAL', 'PROFILE_BRANDING', 'Customised Profile & Branding', 'Customise the digital menu to match the restaurant brand identity.', true),
('POS_ESSENTIAL', 'AI_ANALYST', 'AI Analyst Credits', '10 AI Analyst credits to ask questions about sales, top items, peak hours.', true)
ON CONFLICT (plan_id, feature_code) DO NOTHING;

-- Premium Features (Includes Essential + Advanced)
INSERT INTO saas_plan_features (plan_id, feature_code, feature_name, feature_description, is_included)
VALUES
('POS_PREMIUM', 'POS_TABLE_MANAGEMENT', 'POS & Table Management', 'Complete control over floor plans, orders and checkout processes.', true),
('POS_PREMIUM', 'DIGITAL_MENU_QR', 'Digital Menu & QR Ordering', 'Customers can scan QR codes and place orders instantly.', true),
('POS_PREMIUM', 'MENU_MANAGEMENT', 'Menu Management', 'Manage the entire product catalogue, variations and pricing.', true),
('POS_PREMIUM', 'SALES_STATEMENTS', 'Sales & Statements', 'Detailed reports and daily statements to track revenue.', true),
('POS_PREMIUM', 'PROFILE_BRANDING', 'Customised Profile & Branding', 'Customise the digital menu to match the restaurant brand identity.', true),
('POS_PREMIUM', 'AI_ANALYST', 'AI Analyst Credits', '30 AI Analyst credits for insights, forecasting and business analysis.', true),
('POS_PREMIUM', 'INVENTORY', 'Comprehensive Inventory', 'Deep stock management, supplier tracking, and automated low-stock alerts.', true),
('POS_PREMIUM', 'LOYALTY_PROGRAM', 'Customisable Loyalty Points', 'Build a customised rewards system and convert first-time diners into regulars.', true),
('POS_PREMIUM', 'FINANCE_MANAGEMENT', 'Inbuilt Finance Management', 'Track expenses, manage vendor payouts, and maintain restaurant financial records.', true),
('POS_PREMIUM', 'NEW_FEATURES_ACCESS', 'Free Access to New Features', 'Automatically receive new standard platform features at no additional cost.', true)
ON CONFLICT (plan_id, feature_code) DO NOTHING;

-- Standalone Digital Menu Features
INSERT INTO saas_plan_features (plan_id, feature_code, feature_name, feature_description, is_included)
VALUES
('DIGITAL_MENU_STANDALONE', 'DIGITAL_MENU_QR', 'Digital Menu & QR Catalogue', 'Customers can scan QR codes and browse menu items.', true),
('DIGITAL_MENU_STANDALONE', 'MENU_MANAGEMENT', 'Menu Management', 'Manage product catalogue, variations, and pricing.', true),
('DIGITAL_MENU_STANDALONE', 'PROFILE_BRANDING', 'Customised Profile & Branding', 'Customise the digital menu to match brand identity.', true)
ON CONFLICT (plan_id, feature_code) DO NOTHING;

-- Standalone Queue Management Features
INSERT INTO saas_plan_features (plan_id, feature_code, feature_name, feature_description, is_included)
VALUES
('QUEUE_MGMT_STANDALONE', 'QUEUE_MANAGEMENT', 'Queue Management System', 'Full standalone waitlist, token issuance, queue TV screen, and SMS/WhatsApp notifications.', true)
ON CONFLICT (plan_id, feature_code) DO NOTHING;

