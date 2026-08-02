-- Migration: Add GST settings to restaurants table

-- Create ENUM type for GST Type if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'gst_type_enum') THEN
        CREATE TYPE gst_type_enum AS ENUM ('REGULAR', 'COMPOSITION', 'NONE');
    END IF;
END
$$;

-- Alter table to add GST columns
ALTER TABLE restaurants
ADD COLUMN IF NOT EXISTS gst_type gst_type_enum NOT NULL DEFAULT 'NONE',
ADD COLUMN IF NOT EXISTS gst_number VARCHAR(20),
ADD COLUMN IF NOT EXISTS gst_rate NUMERIC(5,2) DEFAULT 5.00;

-- Backfill existing restaurants (just to be safe, though DEFAULT handles it)
UPDATE restaurants
SET gst_type = 'NONE', gst_rate = 0.00
WHERE gst_type IS NULL;
