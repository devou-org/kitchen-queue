-- Migration: Add order_type column to orders table
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS order_type VARCHAR(50) DEFAULT 'DINE_IN';

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_orders_order_type'
    ) THEN
        ALTER TABLE orders 
        ADD CONSTRAINT chk_orders_order_type 
        CHECK (order_type IN ('DINE_IN', 'TAKEAWAY'));
    END IF;
END $$;
