-- Migration: Add GST tracking to orders table

-- Alter table to add GST tracking columns
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS subtotal NUMERIC(12,2),
ADD COLUMN IF NOT EXISTS gst_amount NUMERIC(12,2),
ADD COLUMN IF NOT EXISTS gst_rate NUMERIC(5,2),
ADD COLUMN IF NOT EXISTS gst_type VARCHAR(20); -- Using VARCHAR here for simplicity and safety, though it matches gst_type_enum

-- Backfill existing orders
-- For existing orders, we assume they were made before GST was tracked,
-- so total_price equals subtotal, and GST is 0.
UPDATE orders
SET 
  subtotal = total_price,
  gst_amount = 0.00,
  gst_rate = 0.00,
  gst_type = 'NONE'
WHERE subtotal IS NULL;
