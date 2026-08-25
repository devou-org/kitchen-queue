-- Migration script for Table Management System

-- 1. Create restaurant_tables table
CREATE TABLE IF NOT EXISTS restaurant_tables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    table_number VARCHAR(50) NOT NULL,
    capacity INT NOT NULL DEFAULT 4,
    status VARCHAR(20) NOT NULL DEFAULT 'AVAILABLE', -- 'AVAILABLE', 'OCCUPIED'
    qr_code_url TEXT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(restaurant_id, table_number)
);

-- Index for table lookup by restaurant and table_number
CREATE INDEX IF NOT EXISTS idx_restaurant_tables_rest_table ON restaurant_tables(restaurant_id, table_number);

-- 2. Add status timestamp tracking columns and table_id to orders table
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS table_id UUID REFERENCES restaurant_tables(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS pending_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN IF NOT EXISTS preparing_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS ready_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

-- Index for active order queries per table
CREATE INDEX IF NOT EXISTS idx_orders_restaurant_table_status ON orders(restaurant_id, table_number, status);
