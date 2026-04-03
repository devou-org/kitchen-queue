-- Culinary Conductor Seed Data
-- Run this script in your Neon Dashboard SQL Editor after creating the schema

-- 1. Initialize the global Queue State if not already present
INSERT INTO queue_state (id, current_queue_number, last_served_number, updated_at)
VALUES (1, 1, 0, CURRENT_TIMESTAMP)
ON CONFLICT (id) DO NOTHING;

-- 2. Insert Base Admin User
-- Password represents the bcrypt hash for 'admin123'
INSERT INTO users (id, phone, name, role, created_at)
VALUES (
    gen_random_uuid(),
    '+919999999999',
    'Kitchen Admin',
    'ADMIN',
    CURRENT_TIMESTAMP
) ON CONFLICT (phone) DO NOTHING;

-- 3. Insert Products
INSERT INTO products (id, name, category, price, stock_quantity, buffer_quantity, image_url, status, created_at, updated_at)
VALUES 
    (gen_random_uuid(), 'Classic Smash Burger', 'Mains', 249.00, 50, 10, 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&h=300&fit=crop', 'AVAILABLE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'Spicy Chicken Sandwich', 'Mains', 299.00, 40, 5, 'https://images.unsplash.com/photo-1606755962773-d324e0a13086?w=400&h=300&fit=crop', 'AVAILABLE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'Truffle Parmesan Fries', 'Sides', 189.00, 100, 20, 'https://images.unsplash.com/photo-1534080564583-6be75777b70a?w=400&h=300&fit=crop', 'AVAILABLE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'Coastal Fish Tacos', 'Mains', 349.00, 15, 5, 'https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?w=400&h=300&fit=crop', 'AVAILABLE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'Loaded Nachos', 'Sides', 219.00, 30, 5, 'https://images.unsplash.com/photo-1513456852971-30c0b8199d4d?w=400&h=300&fit=crop', 'LOW_STOCK', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'Mango Tango Smoothie', 'Beverages', 149.00, 0, 10, 'https://images.unsplash.com/photo-1553530666-ba11a90a2a47?w=400&h=300&fit=crop', 'OUT_OF_STOCK', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'Cold Brew Iced Coffee', 'Beverages', 129.00, 50, 10, 'https://images.unsplash.com/photo-1517701550927-30cfcb61dba5?w=400&h=300&fit=crop', 'AVAILABLE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'Double Chocolate Brownie', 'Desserts', 170.00, 25, 5, 'https://images.unsplash.com/photo-1606890737304-57a1ca8a5b62?w=400&h=300&fit=crop', 'AVAILABLE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- 4. Create some active orders (Mock data)
-- For demonstration, we'll insert two pending orders and one preparing
DO $$
DECLARE
    dummy_product_id_1 UUID;
    dummy_product_id_2 UUID;
    dummy_order_id_1 UUID := gen_random_uuid();
    dummy_order_id_2 UUID := gen_random_uuid();
BEGIN
    SELECT id INTO dummy_product_id_1 FROM products WHERE name = 'Classic Smash Burger' LIMIT 1;
    SELECT id INTO dummy_product_id_2 FROM products WHERE name = 'Truffle Parmesan Fries' LIMIT 1;
    
    IF dummy_product_id_1 IS NOT NULL THEN
        -- Insert Order 1
        INSERT INTO orders (id, ticket_number, customer_name, phone, status, total_price, is_paid, party_size, created_at, updated_at)
        VALUES (dummy_order_id_1, 2, 'Alice Smith', '+919988776655', 'PENDING', 438.00, FALSE, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
        
        INSERT INTO order_items (id, order_id, product_id, quantity, price_at_purchase)
        VALUES (gen_random_uuid(), dummy_order_id_1, dummy_product_id_1, 1, 249.00),
               (gen_random_uuid(), dummy_order_id_1, dummy_product_id_2, 1, 189.00);
               
        -- Insert Order 2
        INSERT INTO orders (id, ticket_number, customer_name, phone, status, total_price, is_paid, party_size, notes, created_at, updated_at)
        VALUES (dummy_order_id_2, 3, 'Bob Jones', '+919988776656', 'PREPARING', 249.00, TRUE, 1, 'No pickles please', CURRENT_TIMESTAMP - interval '10 minutes', CURRENT_TIMESTAMP);
        
        INSERT INTO order_items (id, order_id, product_id, quantity, price_at_purchase)
        VALUES (gen_random_uuid(), dummy_order_id_2, dummy_product_id_1, 1, 249.00);
    END IF;
END $$;
