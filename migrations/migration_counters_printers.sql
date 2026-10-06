-- ============================================================
-- Migration: Counters & Printers Infrastructure
-- Description:
--   1. Creates `counters` table for stations/kitchen sections
--   2. Adds printer configurations (printer_name, printer_type, printer_address)
--   3. Adds `counter` assignment column to `products` table
--   4. Creates `print_jobs` table for Cloud / Local Desktop KOT print queues
--   5. Creates `print_agent_heartbeats` table for hardware printer agents
-- ============================================================
 -- 1. Create counters table

CREATE TABLE IF NOT EXISTS counters
    ( id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                                  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
                                                                                                   name VARCHAR(100) NOT NULL,
                                                                                                                     code VARCHAR(50) NULL,
                                                                                                                                      display_order INT DEFAULT 0,
                                                                                                                                                                is_active BOOLEAN DEFAULT true,
                                                                                                                                                                                          printer_name VARCHAR(100) DEFAULT 'POS-80C',
                                                                                                                                                                                                                            printer_type VARCHAR(50) DEFAULT 'DEFAULT',
                                                                                                                                                                                                                                                             printer_address VARCHAR(200) NULL,
                                                                                                                                                                                                                                                                                          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                                                                                                                                                                                                                                                                                                                         updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP);

-- Ensure unique counter name per restaurant
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'unique_restaurant_counter_name'
    ) THEN
        ALTER TABLE counters ADD CONSTRAINT unique_restaurant_counter_name UNIQUE (restaurant_id, name);
    END IF;
END $$;

-- Indexes for counters

CREATE INDEX IF NOT EXISTS idx_counters_restaurant ON counters(restaurant_id);


CREATE INDEX IF NOT EXISTS idx_counters_order ON counters(restaurant_id, display_order, is_active);

-- 2. Ensure columns exist on counters (in case the table already existed with older schema)

ALTER TABLE counters ADD COLUMN IF NOT EXISTS code VARCHAR(50) NULL,
                                                               ADD COLUMN IF NOT EXISTS display_order INT DEFAULT 0,
                                                                                                                  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
                                                                                                                                                                     ADD COLUMN IF NOT EXISTS printer_name VARCHAR(100) DEFAULT 'POS-80C',
                                                                                                                                                                                                                                ADD COLUMN IF NOT EXISTS printer_type VARCHAR(50) DEFAULT 'DEFAULT',
                                                                                                                                                                                                                                                                                          ADD COLUMN IF NOT EXISTS printer_address VARCHAR(200) NULL,
                                                                                                                                                                                                                                                                                                                                                ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;

-- 3. Add counter column to products table for station routing

ALTER TABLE products ADD COLUMN IF NOT EXISTS counter VARCHAR(255);


CREATE INDEX IF NOT EXISTS idx_products_restaurant_counter ON products(restaurant_id, counter);

-- 4. Create print_jobs table for KOT dispatch queue

CREATE TABLE IF NOT EXISTS print_jobs
    ( id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                                  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
                                                                                                   order_id UUID NULL,
                                                                                                                 ticket_number INT NULL,
                                                                                                                                   counter_name VARCHAR(100) NULL,
                                                                                                                                                             printer_name VARCHAR(100) DEFAULT 'POS-80C',
                                                                                                                                                                                               raw_base64 TEXT NOT NULL,
                                                                                                                                                                                                               status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
                                                                                                                                                                                                                                                   created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                                                                                                                                                                                                                                                                                  printed_at TIMESTAMPTZ NULL);


CREATE INDEX IF NOT EXISTS idx_print_jobs_status ON print_jobs(restaurant_id, status, created_at);


CREATE INDEX IF NOT EXISTS idx_print_jobs_order ON print_jobs(restaurant_id, order_id);

-- 5. Create print_agent_heartbeats table for Desktop / Network agents

CREATE TABLE IF NOT EXISTS print_agent_heartbeats
    ( restaurant_id UUID PRIMARY KEY REFERENCES restaurants(id) ON DELETE CASCADE,
                                                                          printer_name VARCHAR(100) DEFAULT 'POS-80C',
                                                                                                            ip_address VARCHAR(100) NULL,
                                                                                                                                    last_heartbeat TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP);

