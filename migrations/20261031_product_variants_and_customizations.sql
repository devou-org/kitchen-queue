-- Migration: Add Product Variants & Customizations
-- Description: Adds variants and customization groups schema to products table,
-- and snapshot columns (selected_variant, selected_customizations, customization_summary)
-- to order_items table.

-- 1. Extend products table for variants & customization groups
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS has_customizations BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS variants JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS customization_groups JSONB DEFAULT '[]'::jsonb;

-- Optional index for faster filtering of customizable items
CREATE INDEX IF NOT EXISTS idx_products_has_customizations 
ON products (restaurant_id, has_customizations) 
WHERE has_customizations = TRUE;

-- 2. Extend order_items table for customization snapshots
ALTER TABLE order_items 
ADD COLUMN IF NOT EXISTS selected_variant JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS selected_customizations JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS customization_summary TEXT DEFAULT NULL;
