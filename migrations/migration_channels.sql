-- migration_channels.sql

CREATE TABLE IF NOT EXISTS restaurant_channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
    channel_name VARCHAR(100) NOT NULL,
    channel_type VARCHAR(50) NOT NULL, -- 'QUEUE', 'ORDERS', 'KITCHEN'
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(restaurant_id, channel_type)
);

-- Seed demo restaurant channels
DO $$
DECLARE
    demo_restaurant_id UUID;
BEGIN
    SELECT id INTO demo_restaurant_id FROM restaurants WHERE slug = 'demo' LIMIT 1;
    IF demo_restaurant_id IS NOT NULL THEN
        INSERT INTO restaurant_channels (restaurant_id, channel_name, channel_type)
        VALUES 
        (demo_restaurant_id, 'queue-channel-' || demo_restaurant_id, 'QUEUE'),
        (demo_restaurant_id, 'orders-channel-' || demo_restaurant_id, 'ORDERS'),
        (demo_restaurant_id, 'kitchen-channel-' || demo_restaurant_id, 'KITCHEN')
        ON CONFLICT (restaurant_id, channel_type) DO NOTHING;
    END IF;
END $$;
