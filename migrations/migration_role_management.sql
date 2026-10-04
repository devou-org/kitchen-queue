-- ============================================================================
-- QDINE ROLE MANAGEMENT & ACCESS CONTROL MIGRATION
-- ============================================================================

BEGIN;

-- 1. Ensure required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Create roles table
CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(restaurant_id, name)
);

-- 3. Add role_id foreign key column to staffs table
ALTER TABLE staffs
ADD COLUMN IF NOT EXISTS role_id UUID REFERENCES roles(id) ON DELETE SET NULL;

-- 4. Add name column to admins table if not already present
ALTER TABLE admins
ADD COLUMN IF NOT EXISTS name VARCHAR(100);

-- 5. Create performance indexes
CREATE INDEX IF NOT EXISTS idx_roles_restaurant ON roles(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_staffs_role_id ON staffs(role_id);
CREATE INDEX IF NOT EXISTS idx_roles_default ON roles(restaurant_id, is_default);

-- 6. Seed default roles for all existing restaurants
-- Roles: Waiter, Kitchen Staff, Cashier, Manager
INSERT INTO roles (restaurant_id, name, description, permissions, is_default)
SELECT 
    r.id,
    dr.name,
    dr.description,
    dr.permissions::jsonb,
    true
FROM restaurants r
CROSS JOIN (
    VALUES 
        ('Waiter', 'Floor staff handling dine-in tables, table orders, and checking active orders', '["pos", "orders", "tables"]'),
        ('Kitchen Staff', 'Kitchen and chef display for viewing and preparing live orders', '["orders"]'),
        ('Cashier', 'Counter staff managing billing, POS orders, tables, and daily sales reports', '["pos", "orders", "tables", "analytics"]'),
        ('Manager', 'General manager overseeing operations, menu items, inventory, analytics, and staff', '["pos", "orders", "tables", "products", "inventory", "analytics", "staff"]')
) AS dr(name, description, permissions)
ON CONFLICT (restaurant_id, name) DO NOTHING;

-- 7. Link existing unlinked staff records to matching role by name
UPDATE staffs s
SET role_id = r.id
FROM roles r
WHERE s.restaurant_id = r.restaurant_id
  AND s.role_id IS NULL
  AND LOWER(TRIM(s.role)) = LOWER(TRIM(r.name));

-- 8. Fallback link for any remaining unlinked staff to Waiter role
UPDATE staffs s
SET role_id = r.id
FROM roles r
WHERE s.restaurant_id = r.restaurant_id
  AND s.role_id IS NULL
  AND LOWER(TRIM(r.name)) = 'waiter';

COMMIT;
