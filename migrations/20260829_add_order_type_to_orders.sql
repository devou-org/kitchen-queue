-- Add order_type column to orders table with default 'DINE_IN'
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS order_type VARCHAR(50) DEFAULT 'DINE_IN';

-- Add check constraint for valid order types if not existing
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_orders_order_type'
    ) THEN
        ALTER TABLE orders 
        ADD CONSTRAINT chk_orders_order_type 
        CHECK (order_type IN ('DINE_IN', 'TAKEAWAY', 'DELIVERY'));
    END IF;
END $$;
