-- ============================================================================
-- QDINE INVENTORY MANAGEMENT SYSTEM MIGRATION
-- ============================================================================

BEGIN;

-- 1. Inventory Categories
CREATE TABLE IF NOT EXISTS inventory_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(restaurant_id, name)
);

-- 2. Inventory Measurement Units
CREATE TABLE IF NOT EXISTS inventory_units (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL,
    short_code VARCHAR(20) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(restaurant_id, short_code)
);

-- 3. Suppliers
CREATE TABLE IF NOT EXISTS suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    contact_person VARCHAR(100),
    phone VARCHAR(30),
    email VARCHAR(150),
    address TEXT,
    gst_number VARCHAR(30),
    outstanding_balance NUMERIC(12,2) DEFAULT 0.00,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 4. Inventory Items (Ingredients Master)
CREATE TABLE IF NOT EXISTS inventory_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    category_id UUID REFERENCES inventory_categories(id) ON DELETE SET NULL,
    unit VARCHAR(20) NOT NULL DEFAULT 'kg',
    current_stock NUMERIC(12,3) NOT NULL DEFAULT 0.000,
    min_stock NUMERIC(12,3) NOT NULL DEFAULT 0.000,
    max_stock NUMERIC(12,3) NULL,
    cost_per_unit NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
    storage_location VARCHAR(100),
    track_batches BOOLEAN DEFAULT false,
    track_expiry BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_inventory_items_rest ON inventory_items(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_stock ON inventory_items(restaurant_id, current_stock, min_stock);

-- 5. Inventory Batches
CREATE TABLE IF NOT EXISTS inventory_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
    batch_number VARCHAR(100) NOT NULL,
    initial_quantity NUMERIC(12,3) NOT NULL,
    current_quantity NUMERIC(12,3) NOT NULL,
    cost_per_unit NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    expiry_date DATE NULL,
    received_date DATE NOT NULL DEFAULT CURRENT_DATE,
    supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_inventory_batches_item ON inventory_batches(item_id, status);
CREATE INDEX IF NOT EXISTS idx_inventory_batches_expiry ON inventory_batches(restaurant_id, expiry_date);

-- 6. Stock Movements (Immutable Audit Ledger)
CREATE TABLE IF NOT EXISTS stock_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
    batch_id UUID REFERENCES inventory_batches(id) ON DELETE SET NULL,
    movement_type VARCHAR(30) NOT NULL, -- 'PURCHASE', 'CONSUMPTION', 'WASTAGE', 'ADJUSTMENT', 'RETURN', 'INITIAL'
    quantity NUMERIC(12,3) NOT NULL, -- Positive for stock in, negative for stock out
    balance_after NUMERIC(12,3) NOT NULL,
    unit_cost NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    total_cost NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    reference_type VARCHAR(50), -- 'PURCHASE_ORDER', 'ORDER', 'WASTAGE_RECORD', 'STOCK_TAKE', 'MANUAL'
    reference_id VARCHAR(100),
    reason TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_item ON stock_movements(item_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_movements_rest_date ON stock_movements(restaurant_id, created_at DESC);

-- 7. Purchase Orders / Stock Receipts
CREATE TABLE IF NOT EXISTS purchase_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
    po_number VARCHAR(100) NOT NULL,
    invoice_number VARCHAR(100),
    received_date DATE NOT NULL DEFAULT CURRENT_DATE,
    status VARCHAR(30) NOT NULL DEFAULT 'RECEIVED', -- 'DRAFT', 'RECEIVED', 'CANCELLED'
    subtotal NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    tax_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    total_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    payment_status VARCHAR(30) NOT NULL DEFAULT 'UNPAID', -- 'PAID', 'PARTIAL', 'UNPAID'
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS purchase_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
    quantity NUMERIC(12,3) NOT NULL,
    unit VARCHAR(20) NOT NULL,
    unit_price NUMERIC(12,2) NOT NULL,
    tax_rate NUMERIC(5,2) DEFAULT 0.00,
    total_price NUMERIC(12,2) NOT NULL,
    batch_number VARCHAR(100),
    expiry_date DATE
);

-- 8. Wastages
CREATE TABLE IF NOT EXISTS wastages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
    batch_id UUID REFERENCES inventory_batches(id) ON DELETE SET NULL,
    quantity NUMERIC(12,3) NOT NULL,
    unit VARCHAR(20) NOT NULL,
    unit_cost NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    total_cost NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    reason VARCHAR(50) NOT NULL, -- 'SPOILAGE', 'EXPIRED', 'DAMAGED', 'OVERPRODUCTION', 'WRONG_PREPARATION', 'STAFF_CONSUMPTION', 'OTHER'
    notes TEXT,
    logged_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_wastages_rest ON wastages(restaurant_id, logged_at DESC);

-- 9. Stock Adjustments (Physical count reconciliation)
CREATE TABLE IF NOT EXISTS stock_adjustments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
    system_stock NUMERIC(12,3) NOT NULL,
    physical_stock NUMERIC(12,3) NOT NULL,
    adjusted_quantity NUMERIC(12,3) NOT NULL,
    reason TEXT NOT NULL,
    adjusted_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 10. Recipes / BOM (Bill of Materials)
CREATE TABLE IF NOT EXISTS recipes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    instructions TEXT,
    yield_servings INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(restaurant_id, product_id)
);

CREATE TABLE IF NOT EXISTS recipe_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
    quantity NUMERIC(12,3) NOT NULL,
    unit VARCHAR(20) NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_recipe_items_recipe ON recipe_items(recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipe_items_item ON recipe_items(item_id);

COMMIT;
