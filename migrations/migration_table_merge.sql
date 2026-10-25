-- Migration: Table Merge Support
-- 1. Add self-referencing foreign key for table merge
ALTER TABLE restaurant_tables
ADD COLUMN IF NOT EXISTS merged_into_table_id UUID REFERENCES restaurant_tables(id) ON DELETE SET NULL;

-- 2. Partial index: Only index tables that are actually merged into another table
-- This keeps memory consumption in Postgres shared buffers near zero
CREATE INDEX IF NOT EXISTS idx_restaurant_tables_merged_into 
ON restaurant_tables(restaurant_id, merged_into_table_id) 
WHERE merged_into_table_id IS NOT NULL;

-- 3. Safety constraint: Prevent a table from being merged into itself
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_no_self_merge'
    ) THEN
        ALTER TABLE restaurant_tables 
        ADD CONSTRAINT chk_no_self_merge 
        CHECK (id != merged_into_table_id);
    END IF;
END $$;
