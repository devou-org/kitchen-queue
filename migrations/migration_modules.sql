-- migration_modules.sql
-- Queue Management & Orders Module

-- 1. Create queue_status_enum if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'queue_status_enum') THEN
        CREATE TYPE queue_status_enum AS ENUM ('WAITING', 'SEATED', 'CANCELLED', 'NO_SHOW');
    END IF;
END$$;

-- 2. Create queue_status table
CREATE TABLE IF NOT EXISTS queue_status (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    possible_queue_status queue_status_enum NOT NULL,
    restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 3. Create queues table
CREATE TABLE IF NOT EXISTS queues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    queue_status_id UUID REFERENCES queue_status(id),
    token_number INT NOT NULL,
    queue_type VARCHAR(50),
    party_size INT DEFAULT 1,
    estimated_wait_time INT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 4. Alter orders table to include new references
ALTER TABLE orders ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS queue_id UUID REFERENCES queues(id) ON DELETE SET NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS table_number VARCHAR(20);

-- 5. Seed default queue statuses for the demo restaurant
DO $$
DECLARE
    demo_restaurant_id UUID;
BEGIN
    SELECT id INTO demo_restaurant_id FROM restaurants WHERE slug = 'demo' LIMIT 1;
    IF demo_restaurant_id IS NOT NULL THEN
        INSERT INTO queue_status (possible_queue_status, restaurant_id)
        VALUES 
        ('WAITING', demo_restaurant_id),
        ('SEATED', demo_restaurant_id),
        ('CANCELLED', demo_restaurant_id),
        ('NO_SHOW', demo_restaurant_id)
        ON CONFLICT DO NOTHING;
    END IF;
END $$;
