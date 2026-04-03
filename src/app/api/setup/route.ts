import { NextResponse } from 'next/server';
import sql from '@/lib/db';

export async function GET() {
  try {

    // 1. Create Tables
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        phone VARCHAR(20) UNIQUE NOT NULL,
        name VARCHAR(100),
        role VARCHAR(20) DEFAULT 'CUSTOMER',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS products (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) NOT NULL,
        category VARCHAR(50) NOT NULL,
        price DECIMAL(10,2) NOT NULL,
        stock_quantity INTEGER DEFAULT 0,
        buffer_quantity INTEGER DEFAULT 0,
        image_url VARCHAR(255),
        status VARCHAR(20) DEFAULT 'AVAILABLE',
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS orders (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        ticket_number SERIAL,
        customer_name VARCHAR(100) NOT NULL,
        phone VARCHAR(20) NOT NULL,
        status VARCHAR(20) DEFAULT 'PENDING',
        total_price DECIMAL(10,2) NOT NULL,
        is_paid BOOLEAN DEFAULT FALSE,
        party_size INTEGER DEFAULT 1,
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS order_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
        product_id UUID REFERENCES products(id) ON DELETE RESTRICT,
        quantity INTEGER NOT NULL,
        price_at_purchase DECIMAL(10,2) NOT NULL
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS queue_state (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        current_queue_number INTEGER DEFAULT 1,
        last_served_number INTEGER DEFAULT 0,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS analytics_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        event_type VARCHAR(50) NOT NULL,
        data JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;

    // 2. Seed Data
    
    // Global Queue State
    await sql`
      INSERT INTO queue_state (id, current_queue_number, last_served_number, updated_at)
      VALUES (1, 1, 0, CURRENT_TIMESTAMP)
      ON CONFLICT (id) DO NOTHING;
    `;

    // Base Admin User
    await sql`
      INSERT INTO users (id, phone, name, role, created_at)
      VALUES (
          gen_random_uuid(),
          '+919999999999',
          'Kitchen Admin',
          'ADMIN',
          CURRENT_TIMESTAMP
      ) ON CONFLICT (phone) DO NOTHING;
    `;

    // Products
    await sql`
      INSERT INTO products (id, name, category, price, stock_quantity, buffer_quantity, image_url, status, created_at, updated_at)
      VALUES 
          (gen_random_uuid(), 'Classic Smash Burger', 'Mains', 249.00, 50, 10, 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&h=300&fit=crop', 'AVAILABLE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
          (gen_random_uuid(), 'Spicy Chicken Sandwich', 'Mains', 299.00, 40, 5, 'https://images.unsplash.com/photo-1606755962773-d324e0a13086?w=400&h=300&fit=crop', 'AVAILABLE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
          (gen_random_uuid(), 'Truffle Parmesan Fries', 'Sides', 189.00, 100, 20, 'https://images.unsplash.com/photo-1534080564583-6be75777b70a?w=400&h=300&fit=crop', 'AVAILABLE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
          (gen_random_uuid(), 'Coastal Fish Tacos', 'Mains', 349.00, 15, 5, 'https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?w=400&h=300&fit=crop', 'AVAILABLE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
          (gen_random_uuid(), 'Loaded Nachos', 'Sides', 219.00, 30, 5, 'https://images.unsplash.com/photo-1513456852971-30c0b8199d4d?w=400&h=300&fit=crop', 'LOW_STOCK', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
          (gen_random_uuid(), 'Mango Tango Smoothie', 'Beverages', 149.00, 0, 10, 'https://images.unsplash.com/photo-1553530666-ba11a90a2a47?w=400&h=300&fit=crop', 'OUT_OF_STOCK', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
          (gen_random_uuid(), 'Cold Brew Iced Coffee', 'Beverages', 129.00, 50, 10, 'https://images.unsplash.com/photo-1517701550927-30cfcb61dba5?w=400&h=300&fit=crop', 'AVAILABLE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
          (gen_random_uuid(), 'Double Chocolate Brownie', 'Desserts', 170.00, 25, 5, 'https://images.unsplash.com/photo-1606890737304-57a1ca8a5b62?w=400&h=300&fit=crop', 'AVAILABLE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT DO NOTHING;
    `;

    return NextResponse.json({ success: true, message: 'Database setup and seeded successfully! You can now log in.' });
  } catch (error: any) {
    console.error('Setup DB Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
