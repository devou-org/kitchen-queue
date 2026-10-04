-- migration_saas_phase1.sql
-- Phase 1: Multi-Tenant Architecture Database Redesign

-- 1. Create restaurants table
CREATE TABLE IF NOT EXISTS restaurants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL, -- Used for subdomain routing: slug.yourdomain.com
    phone TEXT,
    address TEXT,
    logo_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Create restaurant_modules table for toggling features per restaurant
CREATE TABLE IF NOT EXISTS restaurant_modules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    module_name TEXT NOT NULL, -- e.g., 'DIGITAL_MENU', 'ONLINE_ORDERING', 'QUEUE_MANAGEMENT', etc.
    is_enabled BOOLEAN DEFAULT true,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(restaurant_id, module_name)
);

-- 3. Create a default restaurant for all existing data to prevent orphan records
INSERT INTO restaurants (id, name, slug) 
VALUES ('00000000-0000-0000-0000-000000000000', 'Devou Kitchen', 'demo')
ON CONFLICT (id) DO NOTHING;

-- 4. Add restaurant_id to existing tables

-- Admins (Staff belong to a specific restaurant. Super admins can have restaurant_id = NULL)
ALTER TABLE admins ADD COLUMN IF NOT EXISTS restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE;
UPDATE admins SET restaurant_id = '00000000-0000-0000-0000-000000000000' WHERE restaurant_id IS NULL AND is_super_admin = false;

-- Products
ALTER TABLE products ADD COLUMN IF NOT EXISTS restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE;
UPDATE products SET restaurant_id = '00000000-0000-0000-0000-000000000000' WHERE restaurant_id IS NULL;
ALTER TABLE products ALTER COLUMN restaurant_id SET NOT NULL;

-- Orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE;
UPDATE orders SET restaurant_id = '00000000-0000-0000-0000-000000000000' WHERE restaurant_id IS NULL;
ALTER TABLE orders ALTER COLUMN restaurant_id SET NOT NULL;

-- Queue State (Each restaurant needs its own queue state)
ALTER TABLE queue_state ADD COLUMN IF NOT EXISTS restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE;
UPDATE queue_state SET restaurant_id = '00000000-0000-0000-0000-000000000000' WHERE restaurant_id IS NULL;
ALTER TABLE queue_state ALTER COLUMN restaurant_id SET NOT NULL;
ALTER TABLE queue_state DROP CONSTRAINT IF EXISTS queue_state_restaurant_id_key;
ALTER TABLE queue_state ADD CONSTRAINT queue_state_restaurant_id_key UNIQUE (restaurant_id);

-- OTP Logs
ALTER TABLE otp_logs ADD COLUMN IF NOT EXISTS restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE;
UPDATE otp_logs SET restaurant_id = '00000000-0000-0000-0000-000000000000' WHERE restaurant_id IS NULL;

-- 5. Enable default modules for the 'demo' restaurant
INSERT INTO restaurant_modules (restaurant_id, module_name, is_enabled)
VALUES 
('00000000-0000-0000-0000-000000000000', 'DIGITAL_MENU', true),
('00000000-0000-0000-0000-000000000000', 'ONLINE_ORDERING', true),
('00000000-0000-0000-0000-000000000000', 'QUEUE_MANAGEMENT', true),
('00000000-0000-0000-0000-000000000000', 'INVENTORY', true),
('00000000-0000-0000-0000-000000000000', 'ANALYTICS', true),
('00000000-0000-0000-0000-000000000000', 'REPORTS', true)
ON CONFLICT (restaurant_id, module_name) DO NOTHING;
