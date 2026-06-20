import { NextResponse } from 'next/server';
import sql from '@/lib/db';

export async function GET() {
  try {
    // 1. Create Restaurants table
    await sql`
      CREATE TABLE IF NOT EXISTS restaurants (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        slug TEXT UNIQUE NOT NULL,
        phone TEXT,
        address TEXT,
        logo_url TEXT,
        primary_color VARCHAR(50) DEFAULT '#971345',
        secondary_color VARCHAR(50) DEFAULT '#EC7951',
        menu_layout VARCHAR(50) DEFAULT 'GRID',
        menu_title VARCHAR(200) DEFAULT 'Today''s Specials',
        menu_description TEXT DEFAULT 'Hand-curated coastal delicacies prepared with traditional recipes.',
        billing_tier VARCHAR(50) DEFAULT 'BASIC',
        billing_model VARCHAR(50) DEFAULT 'SUBSCRIPTION',
        billing_status VARCHAR(50) DEFAULT 'ACTIVE',
        billing_start_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        billing_end_date TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;

    // 2. Create Restaurant Modules table
    await sql`
      CREATE TABLE IF NOT EXISTS restaurant_modules (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
        module_name TEXT NOT NULL,
        is_enabled BOOLEAN DEFAULT true,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(restaurant_id, module_name)
      );
    `;

    // 3. Create Users table
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        phone VARCHAR(20) UNIQUE NOT NULL,
        name VARCHAR(100),
        role VARCHAR(20) DEFAULT 'CUSTOMER',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;

    // 4. Create Admins table
    await sql`
      CREATE TABLE IF NOT EXISTS admins (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        is_super_admin BOOLEAN DEFAULT false,
        restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;

    // 5. Create Products table
    await sql`
      CREATE TABLE IF NOT EXISTS products (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
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

    // 6. Create Queue Status table
    await sql`
      CREATE TABLE IF NOT EXISTS queue_status (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        possible_queue_status VARCHAR(50) NOT NULL,
        restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(restaurant_id, possible_queue_status)
      );
    `;

    // 7. Create Queues table
    await sql`
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
    `;

    // 8. Create Orders table
    await sql`
      CREATE TABLE IF NOT EXISTS orders (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
        ticket_number SERIAL,
        customer_name VARCHAR(100) NOT NULL,
        phone VARCHAR(20) NOT NULL,
        status VARCHAR(20) DEFAULT 'PENDING',
        total_price DECIMAL(10,2) NOT NULL,
        is_paid BOOLEAN DEFAULT FALSE,
        party_size INTEGER DEFAULT 1,
        table_number VARCHAR(20),
        notes TEXT,
        user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        queue_id UUID REFERENCES queues(id) ON DELETE SET NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;

    // 9. Create Order Items table
    await sql`
      CREATE TABLE IF NOT EXISTS order_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
        product_id UUID REFERENCES products(id) ON DELETE RESTRICT,
        quantity INTEGER NOT NULL,
        price_at_purchase DECIMAL(10,2) NOT NULL,
        UNIQUE(order_id, product_id)
      );
    `;

    // 10. Create Queue State table
    await sql`
      CREATE TABLE IF NOT EXISTS queue_state (
        id SERIAL PRIMARY KEY,
        restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE UNIQUE,
        current_queue_number INTEGER DEFAULT 1,
        last_served_number INTEGER DEFAULT 0,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;

    // 11. Create Analytics Events table
    await sql`
      CREATE TABLE IF NOT EXISTS analytics_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        event_type VARCHAR(50) NOT NULL,
        data JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;

    // 12. Create Daily OTP Stats table
    await sql`
      CREATE TABLE IF NOT EXISTS daily_otp_stats (
        date DATE PRIMARY KEY,
        count INTEGER DEFAULT 0,
        cost NUMERIC(10, 2) DEFAULT 0.00,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;

    // 13. Create OTP Logs table
    await sql`
      CREATE TABLE IF NOT EXISTS otp_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
        phone TEXT NOT NULL,
        sent_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        status TEXT DEFAULT 'SENT'
      );
    `;

    // 14. Create Restaurant Channels table
    await sql`
      CREATE TABLE IF NOT EXISTS restaurant_channels (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
        channel_name VARCHAR(100) NOT NULL,
        channel_type VARCHAR(50) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(restaurant_id, channel_type)
      );
    `;

    // 15. Create Billing Transactions table
    await sql`
      CREATE TABLE IF NOT EXISTS billing_transactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
        transaction_type VARCHAR(50) NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        reference_id VARCHAR(100),
        description TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;

    // 16. Create Monthly Billing Summary table
    await sql`
      CREATE TABLE IF NOT EXISTS monthly_billing_summary (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
        month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
        year INTEGER NOT NULL,
        order_charges DECIMAL(10,2) DEFAULT 0.00,
        otp_charges DECIMAL(10,2) DEFAULT 0.00,
        subscription_charges DECIMAL(10,2) DEFAULT 0.00,
        adjustments DECIMAL(10,2) DEFAULT 0.00,
        total_amount DECIMAL(10,2) DEFAULT 0.00,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT uq_restaurant_month_year UNIQUE (restaurant_id, month, year)
      );
    `;

    // Create Indexes
    await sql`CREATE INDEX IF NOT EXISTS idx_billing_tx_restaurant_id ON billing_transactions(restaurant_id);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_billing_tx_created_at ON billing_transactions(created_at);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_monthly_billing_lookup ON monthly_billing_summary(restaurant_id, year, month);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_otp_logs_date ON otp_logs(sent_at);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_otp_logs_phone ON otp_logs(phone);`;

    // 17. Seed Data
    // Default Restaurant (demo)
    await sql`
      INSERT INTO restaurants (id, name, slug) 
      VALUES ('00000000-0000-0000-0000-000000000000', 'Devou Kitchen', 'demo')
      ON CONFLICT (id) DO NOTHING;
    `;

    // Default Modules
    const ALL_MODULES = ['DIGITAL_MENU', 'ONLINE_ORDERING', 'QUEUE_MANAGEMENT', 'INVENTORY', 'ANALYTICS', 'REPORTS'];
    for (const mod of ALL_MODULES) {
      await sql`
        INSERT INTO restaurant_modules (restaurant_id, module_name, is_enabled)
        VALUES ('00000000-0000-0000-0000-000000000000', \${mod}, true)
        ON CONFLICT (restaurant_id, module_name) DO NOTHING;
      `;
    }

    // Default Queue State
    await sql`
      INSERT INTO queue_state (restaurant_id, current_queue_number, last_served_number)
      VALUES ('00000000-0000-0000-0000-000000000000', 1, 0)
      ON CONFLICT (restaurant_id) DO NOTHING;
    `;

    // Default Queue Statuses
    const statuses = ['WAITING', 'SEATED', 'CANCELLED', 'NO_SHOW'];
    for (const status of statuses) {
      await sql`
        INSERT INTO queue_status (possible_queue_status, restaurant_id)
        VALUES (\${status}, '00000000-0000-0000-0000-000000000000')
        ON CONFLICT (restaurant_id, possible_queue_status) DO NOTHING;
      `;
    }

    // Channels
    const channels = [
      { type: 'QUEUE', name: 'queue-channel-00000000-0000-0000-0000-000000000000' },
      { type: 'ORDERS', name: 'orders-channel-00000000-0000-0000-0000-000000000000' },
      { type: 'KITCHEN', name: 'kitchen-channel-00000000-0000-0000-0000-000000000000' }
    ];
    for (const ch of channels) {
      await sql`
        INSERT INTO restaurant_channels (restaurant_id, channel_name, channel_type)
        VALUES ('00000000-0000-0000-0000-000000000000', \${ch.name}, \${ch.type})
        ON CONFLICT (restaurant_id, channel_type) DO NOTHING;
      `;
    }

    // Base Super Admin
    await sql`
      INSERT INTO admins (email, password, is_super_admin)
      VALUES ('admin3047@renjzkitchen.com', '$2b$10$tBlZ7y98r9x0UMgG6vUS5.3B1yus2tpNXog3KR3X7IviHy0TGsVhi', true)
      ON CONFLICT (email) DO NOTHING;
    `;

    // Base Admin User
    await sql`
      INSERT INTO users (id, phone, name, role)
      VALUES ('00000000-0000-0000-0000-000000000001', '+919999999999', 'Kitchen Admin', 'ADMIN')
      ON CONFLICT (phone) DO NOTHING;
    `;

    // Products for Demo Restaurant
    await sql`
      INSERT INTO products (id, restaurant_id, name, category, price, stock_quantity, buffer_quantity, image_url, status)
      VALUES 
        (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'Classic Smash Burger', 'Mains', 249.00, 50, 10, 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&h=300&fit=crop', 'AVAILABLE'),
        (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'Spicy Chicken Sandwich', 'Mains', 299.00, 40, 5, 'https://images.unsplash.com/photo-1606755962773-d324e0a13086?w=400&h=300&fit=crop', 'AVAILABLE'),
        (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'Truffle Parmesan Fries', 'Sides', 189.00, 100, 20, 'https://images.unsplash.com/photo-1534080564583-6be75777b70a?w=400&h=300&fit=crop', 'AVAILABLE'),
        (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'Coastal Fish Tacos', 'Mains', 349.00, 15, 5, 'https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?w=400&h=300&fit=crop', 'AVAILABLE'),
        (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'Loaded Nachos', 'Sides', 219.00, 30, 5, 'https://images.unsplash.com/photo-1513456852971-30c0b8199d4d?w=400&h=300&fit=crop', 'LOW_STOCK'),
        (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'Mango Tango Smoothie', 'Beverages', 149.00, 0, 10, 'https://images.unsplash.com/photo-1553530666-ba11a90a2a47?w=400&h=300&fit=crop', 'OUT_OF_STOCK'),
        (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'Cold Brew Iced Coffee', 'Beverages', 129.00, 50, 10, 'https://images.unsplash.com/photo-1517701550927-30cfcb61dba5?w=400&h=300&fit=crop', 'AVAILABLE'),
        (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'Double Chocolate Brownie', 'Desserts', 170.00, 25, 5, 'https://images.unsplash.com/photo-1606890737304-57a1ca8a5b62?w=400&h=300&fit=crop', 'AVAILABLE')
      ON CONFLICT DO NOTHING;
    `;

    return NextResponse.json({ success: true, message: 'Database fully initialized, migrated, and seeded successfully!' });
  } catch (error: any) {
    console.error('Setup DB Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
