import { Pool } from 'pg';

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export default function sql(strings: TemplateStringsArray, ...values: any[]) {
  const text = strings.reduce((prev, curr, i) => prev + '$' + i + curr);
  return pool.query(text, values).then(res => res.rows);
}

// ============================================
// RESTAURANT & MODULE QUERIES
// ============================================

async function runAutoMigration(sqlConnection: any) {
  try {
    await sqlConnection`
      ALTER TABLE restaurants 
      ADD COLUMN IF NOT EXISTS menu_title VARCHAR(200) DEFAULT 'Today''s Specials',
      ADD COLUMN IF NOT EXISTS menu_description TEXT DEFAULT 'Hand-curated coastal delicacies prepared with traditional recipes.',
      ADD COLUMN IF NOT EXISTS billing_period VARCHAR(20) DEFAULT 'MONTHLY',
      ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'Asia/Kolkata',
      ADD COLUMN IF NOT EXISTS opening_time TIME DEFAULT '09:00:00',
      ADD COLUMN IF NOT EXISTS closing_time TIME DEFAULT '22:00:00',
      ADD COLUMN IF NOT EXISTS rollover_time TIME DEFAULT '00:00:00',
      ADD COLUMN IF NOT EXISTS gst_type VARCHAR(20) DEFAULT 'NONE',
      ADD COLUMN IF NOT EXISTS gst_number VARCHAR(20),
      ADD COLUMN IF NOT EXISTS gst_rate NUMERIC(5,2) DEFAULT 5.00,
      ADD COLUMN IF NOT EXISTS custom_subscription_charge DECIMAL(10,2) DEFAULT NULL,
      ADD COLUMN IF NOT EXISTS custom_otp_charge DECIMAL(10,2) DEFAULT NULL,
      ADD COLUMN IF NOT EXISTS country VARCHAR(100) DEFAULT 'India',
      ADD COLUMN IF NOT EXISTS country_code VARCHAR(10) DEFAULT 'IN',
      ADD COLUMN IF NOT EXISTS state VARCHAR(100) DEFAULT 'Kerala',
      ADD COLUMN IF NOT EXISTS state_code VARCHAR(20) DEFAULT 'KL',
      ADD COLUMN IF NOT EXISTS district VARCHAR(100) DEFAULT 'Kannur',
      ADD COLUMN IF NOT EXISTS city VARCHAR(150) DEFAULT 'Thalassery',
      ADD COLUMN IF NOT EXISTS latitude DECIMAL(10,7) DEFAULT 11.7750435,
      ADD COLUMN IF NOT EXISTS longitude DECIMAL(10,7) DEFAULT 75.496864;
    `;
    await sqlConnection`
      ALTER TABLE orders
      ADD COLUMN IF NOT EXISTS subtotal NUMERIC(12,2),
      ADD COLUMN IF NOT EXISTS gst_amount NUMERIC(12,2),
      ADD COLUMN IF NOT EXISTS gst_rate NUMERIC(5,2),
      ADD COLUMN IF NOT EXISTS gst_type VARCHAR(20) DEFAULT 'NONE',
      ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50),
      ADD COLUMN IF NOT EXISTS order_type VARCHAR(50) DEFAULT 'DINE_IN';
    `;
    await sqlConnection`
      INSERT INTO gemini_request_config (request_type, max_output_tokens)
      VALUES ('BUSINESS_ANALYST_CHAT', 10000)
      ON CONFLICT (request_type) DO UPDATE SET max_output_tokens = 10000;
    `;
    await sqlConnection`
      UPDATE gemini_config
      SET model = 'gemini-3.5-flash-lite',
          rpm_limit = 15,
          rpd_limit = 1500,
          updated_at = CURRENT_TIMESTAMP;
    `;
    await sqlConnection`
      CREATE TABLE IF NOT EXISTS ai_chat_sessions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
          title VARCHAR(255) NOT NULL DEFAULT 'Business Analysis Chat',
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `;
    await sqlConnection`
      CREATE TABLE IF NOT EXISTS ai_chat_messages (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          session_id UUID NOT NULL REFERENCES ai_chat_sessions(id) ON DELETE CASCADE,
          restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
          role VARCHAR(20) NOT NULL,
          content TEXT NOT NULL,
          tool_calls JSONB NULL,
          tool_results JSONB NULL,
          tokens_used INTEGER DEFAULT 0,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `;
    await sqlConnection`
      CREATE TABLE IF NOT EXISTS restaurant_tables (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
          table_number VARCHAR(50) NOT NULL,
          capacity INT NOT NULL DEFAULT 4,
          status VARCHAR(20) NOT NULL DEFAULT 'AVAILABLE',
          qr_code_url TEXT NULL,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(restaurant_id, table_number)
      );
    `;
    await sqlConnection`
      CREATE TABLE IF NOT EXISTS table_sessions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
          table_id UUID NOT NULL REFERENCES restaurant_tables(id) ON DELETE CASCADE,
          started_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
          ended_at TIMESTAMPTZ,
          party_size INT,
          status VARCHAR(20) NOT NULL DEFAULT 'OPEN',
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `;
    await sqlConnection`
      CREATE INDEX IF NOT EXISTS idx_table_sessions_restaurant_date ON table_sessions(restaurant_id, started_at);
      CREATE INDEX IF NOT EXISTS idx_table_sessions_table ON table_sessions(table_id, started_at);
    `;
    await sqlConnection`
      ALTER TABLE orders
      ADD COLUMN IF NOT EXISTS table_id UUID REFERENCES restaurant_tables(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS table_session_id UUID REFERENCES table_sessions(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS pending_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      ADD COLUMN IF NOT EXISTS preparing_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS ready_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;
    `;
    await sqlConnection`
      CREATE INDEX IF NOT EXISTS idx_orders_table_session ON orders(table_session_id);
    `;
    console.log("Auto-migrated menu, GST, AI analyst chat, and Table Management/Analytics columns/tables successfully!");
  } catch (err) {
    console.error("Auto-migration failed:", err);
  }
}

export async function getRestaurantBySlug(slug: string) {
  try {
    const rows = await sql`SELECT id, name, slug, logo_url, phone, address, primary_color, secondary_color, menu_layout, menu_title, menu_description, billing_tier, billing_model, billing_status, billing_start_date, billing_end_date, billing_period, timezone, opening_time, closing_time, rollover_time, gst_type, gst_number, gst_rate, custom_subscription_charge, custom_otp_charge, monthly_ai_credits, custom_ai_credits, country, country_code, state, state_code, district, city, latitude, longitude FROM restaurants WHERE slug = ${slug} LIMIT 1`;
    return rows[0] || null;
  } catch (error: any) {
    if (error.message?.includes('column') || error.message?.includes('does not exist')) {
      console.log("Missing menu columns detected in getRestaurantBySlug. Attempting auto-migration...");
      await runAutoMigration(sql);
      try {
        const rows = await sql`SELECT id, name, slug, logo_url, phone, address, primary_color, secondary_color, menu_layout, menu_title, menu_description, billing_tier, billing_model, billing_status, billing_start_date, billing_end_date, billing_period FROM restaurants WHERE slug = ${slug} LIMIT 1`;
        return rows[0] || null;
      } catch (retryError) {
        const rows = await sql`SELECT id, name, slug, logo_url, phone, address, primary_color, secondary_color, menu_layout, billing_tier, billing_model, billing_status, billing_start_date, billing_end_date FROM restaurants WHERE slug = ${slug} LIMIT 1`;
        if (rows[0]) {
          rows[0].menu_title = "Today's Specials";
          rows[0].menu_description = "Hand-curated coastal delicacies prepared with traditional recipes.";
          rows[0].billing_period = "MONTHLY";
        }
        return rows[0] || null;
      }
    }
    throw error;
  }
}


export async function getRestaurantModules(restaurantId: string) {
  const rows = await sql`
    SELECT module_name, is_enabled 
    FROM restaurant_modules 
    WHERE restaurant_id = ${restaurantId}
    ORDER BY module_name ASC
  `;
  return rows;
}

// ============================================
// SUPER ADMIN: RESTAURANT CRUD
// ============================================

export async function getAllRestaurants() {
  try {
    const rows = await sql`
      SELECT 
        r.id, r.name, r.slug, r.phone, r.address, r.logo_url, r.primary_color, r.secondary_color, r.menu_layout, r.menu_title, r.menu_description, r.created_at,
        r.billing_tier, r.billing_model, r.billing_status, r.billing_start_date, r.billing_end_date, r.gst_type, r.gst_number, r.gst_rate, r.custom_subscription_charge, r.custom_otp_charge,
        COUNT(DISTINCT o.id) FILTER (WHERE o.created_at > NOW() - INTERVAL '30 days') as orders_30d,
        COUNT(DISTINCT p.id) FILTER (WHERE p.is_active = true) as active_products
      FROM restaurants r
      LEFT JOIN orders o ON o.restaurant_id = r.id
      LEFT JOIN products p ON p.restaurant_id = r.id
      GROUP BY r.id, r.name, r.slug, r.phone, r.address, r.logo_url, r.primary_color, r.secondary_color, r.menu_layout, r.menu_title, r.menu_description, r.created_at, r.billing_tier, r.billing_model, r.billing_status, r.billing_start_date, r.billing_end_date, r.gst_type, r.gst_number, r.gst_rate, r.custom_subscription_charge, r.custom_otp_charge
      ORDER BY r.created_at DESC
    `;
    return rows;
  } catch (error: any) {
    if (error.message?.includes('column') || error.message?.includes('does not exist')) {
      console.log("Missing menu columns detected in getAllRestaurants. Attempting auto-migration...");
      await runAutoMigration(sql);
      try {
        const rows = await sql`
          SELECT 
            r.id, r.name, r.slug, r.phone, r.address, r.logo_url, r.primary_color, r.secondary_color, r.menu_layout, r.menu_title, r.menu_description, r.created_at,
            r.billing_tier, r.billing_model, r.billing_status, r.billing_start_date, r.billing_end_date,
            COUNT(DISTINCT o.id) FILTER (WHERE o.created_at > NOW() - INTERVAL '30 days') as orders_30d,
            COUNT(DISTINCT p.id) FILTER (WHERE p.is_active = true) as active_products
          FROM restaurants r
          LEFT JOIN orders o ON o.restaurant_id = r.id
          LEFT JOIN products p ON p.restaurant_id = r.id
          GROUP BY r.id, r.name, r.slug, r.phone, r.address, r.logo_url, r.primary_color, r.secondary_color, r.menu_layout, r.menu_title, r.menu_description, r.created_at, r.billing_tier, r.billing_model, r.billing_status, r.billing_start_date, r.billing_end_date
          ORDER BY r.created_at DESC
        `;
        return rows;
      } catch (retryError) {
        const rows = await sql`
          SELECT 
            r.id, r.name, r.slug, r.phone, r.address, r.logo_url, r.primary_color, r.secondary_color, r.menu_layout, r.created_at,
            r.billing_tier, r.billing_model, r.billing_status, r.billing_start_date, r.billing_end_date,
            COUNT(DISTINCT o.id) FILTER (WHERE o.created_at > NOW() - INTERVAL '30 days') as orders_30d,
            COUNT(DISTINCT p.id) FILTER (WHERE p.is_active = true) as active_products
          FROM restaurants r
          LEFT JOIN orders o ON o.restaurant_id = r.id
          LEFT JOIN products p ON p.restaurant_id = r.id
          GROUP BY r.id, r.name, r.slug, r.phone, r.address, r.logo_url, r.primary_color, r.secondary_color, r.menu_layout, r.created_at, r.billing_tier, r.billing_model, r.billing_status, r.billing_start_date, r.billing_end_date
          ORDER BY r.created_at DESC
        `;
        return rows.map((r: any) => ({
          ...r,
          menu_title: "Today's Specials",
          menu_description: "Hand-curated coastal delicacies prepared with traditional recipes."
        }));
      }
    }
    throw error;
  }
}


export async function getRestaurantById(id: string) {
  try {
    const rows = await sql`
      SELECT id, name, slug, phone, address, logo_url, primary_color, secondary_color, menu_layout, menu_title, menu_description, created_at, updated_at, billing_tier, billing_model, billing_status, billing_start_date, billing_end_date, billing_period, gst_type, gst_number, gst_rate, custom_subscription_charge, custom_otp_charge, monthly_ai_credits, custom_ai_credits, country, country_code, state, state_code, district, city, latitude, longitude, timezone, opening_time, closing_time, rollover_time
      FROM restaurants WHERE id = ${id} LIMIT 1
    `;
    return rows[0] || null;
  } catch (error: any) {
    if (error.message?.includes('column') || error.message?.includes('does not exist')) {
      console.log("Missing menu columns detected in getRestaurantById. Attempting auto-migration...");
      await runAutoMigration(sql);
      try {
        const rows = await sql`
          SELECT id, name, slug, phone, address, logo_url, primary_color, secondary_color, menu_layout, menu_title, menu_description, created_at, updated_at, billing_tier, billing_model, billing_status, billing_start_date, billing_end_date, billing_period
          FROM restaurants WHERE id = ${id} LIMIT 1
        `;
        return rows[0] || null;
      } catch (retryError) {
        const rows = await sql`
          SELECT id, name, slug, phone, address, logo_url, primary_color, secondary_color, menu_layout, created_at, updated_at, billing_tier, billing_model, billing_status, billing_start_date, billing_end_date
          FROM restaurants WHERE id = ${id} LIMIT 1
        `;
        if (rows[0]) {
          rows[0].menu_title = "Today's Specials";
          rows[0].menu_description = "Hand-curated coastal delicacies prepared with traditional recipes.";
          rows[0].billing_period = "MONTHLY";
        }
        return rows[0] || null;
      }
    }
    throw error;
  }
}


export async function createRestaurant(data: {
  name: string;
  slug: string;
  phone?: string;
  address?: string;
  logo_url?: string;
  primary_color?: string;
  secondary_color?: string;
  menu_layout?: string;
  menu_title?: string;
  menu_description?: string;
  timezone?: string;
  opening_time?: string;
  closing_time?: string;
  rollover_time?: string;
  gst_type?: string;
  gst_number?: string;
  gst_rate?: number;
  modules?: string[];
}) {
  let restaurant: any = null;
  try {
    const rows = await sql`
      INSERT INTO restaurants (name, slug, phone, address, logo_url, primary_color, secondary_color, menu_layout, menu_title, menu_description, timezone, opening_time, closing_time, rollover_time, gst_type, gst_number, gst_rate)
      VALUES (${data.name}, ${data.slug}, ${data.phone || null}, ${data.address || null}, ${data.logo_url || null}, ${data.primary_color || null}, ${data.secondary_color || null}, ${data.menu_layout || 'LIST'}, ${data.menu_title || 'Today\'s Specials'}, ${data.menu_description || 'Hand-curated coastal delicacies prepared with traditional recipes.'}, ${data.timezone || 'Asia/Kolkata'}, ${data.opening_time || '09:00:00'}, ${data.closing_time || '22:00:00'}, ${data.rollover_time || '00:00:00'}, ${data.gst_type || 'NONE'}, ${data.gst_number || null}, ${data.gst_rate || 5.00})
      RETURNING *
    `;
    restaurant = rows[0];
  } catch (error: any) {
    if (error.message?.includes('column') || error.message?.includes('does not exist')) {
      console.log("Missing menu columns detected in createRestaurant. Attempting auto-migration...");
      await runAutoMigration(sql);
      try {
        const rows = await sql`
          INSERT INTO restaurants (name, slug, phone, address, logo_url, primary_color, secondary_color, menu_layout, menu_title, menu_description)
          VALUES (${data.name}, ${data.slug}, ${data.phone || null}, ${data.address || null}, ${data.logo_url || null}, ${data.primary_color || null}, ${data.secondary_color || null}, ${data.menu_layout || 'LIST'}, ${data.menu_title || 'Today\'s Specials'}, ${data.menu_description || 'Hand-curated coastal delicacies prepared with traditional recipes.'})
          RETURNING *
        `;
        restaurant = rows[0];
      } catch (retryError) {
        // Safe fallback without custom columns
        const rows = await sql`
          INSERT INTO restaurants (name, slug, phone, address, logo_url, primary_color, secondary_color, menu_layout)
          VALUES (${data.name}, ${data.slug}, ${data.phone || null}, ${data.address || null}, ${data.logo_url || null}, ${data.primary_color || null}, ${data.secondary_color || null}, ${data.menu_layout || 'LIST'})
          RETURNING *
        `;
        restaurant = rows[0];
        if (restaurant) {
          restaurant.menu_title = "Today's Specials";
          restaurant.menu_description = "Hand-curated coastal delicacies prepared with traditional recipes.";
        }
      }
    } else {
      throw error;
    }
  }

  // Seed default modules for the new restaurant
  const ALL_MODULES = ['DIGITAL_MENU', 'ONLINE_ORDERING', 'QUEUE_MANAGEMENT'];
  const enabledModules = data.modules || ALL_MODULES;

  for (const mod of ALL_MODULES) {
    await sql`
      INSERT INTO restaurant_modules (restaurant_id, module_name, is_enabled)
      VALUES (${restaurant.id}, ${mod}, ${enabledModules.includes(mod)})
      ON CONFLICT (restaurant_id, module_name) DO NOTHING
    `;
  }

  // Create queue state for the new restaurant
  await sql`
    INSERT INTO queue_state (restaurant_id, current_queue_number, last_served_number)
    VALUES (${restaurant.id}, 1, 0)
    ON CONFLICT (restaurant_id) DO NOTHING
  `;

  return restaurant;
}

export async function updateRestaurant(id: string, data: {
  name?: string;
  slug?: string;
  phone?: string | null;
  address?: string | null;
  logo_url?: string | null;
  primary_color?: string | null;
  secondary_color?: string | null;
  menu_layout?: string | null;
  menu_title?: string | null;
  menu_description?: string | null;
  billing_tier?: string;
  billing_model?: string;
  billing_status?: string;
  billing_end_date?: string | null;
  billing_period?: string;
  timezone?: string | null;
  opening_time?: string | null;
  closing_time?: string | null;
  rollover_time?: string | null;
  gst_type?: string | null;
  gst_number?: string | null;
  gst_rate?: number | null;
  custom_subscription_charge?: number | null;
  custom_otp_charge?: number | null;
  monthly_ai_credits?: number | null;
  custom_ai_credits?: number | null;
  country?: string | null;
  country_code?: string | null;
  state?: string | null;
  state_code?: string | null;
  district?: string | null;
  city?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}) {
  try {
    const rows = await sql`
      UPDATE restaurants SET
        name = COALESCE(${data.name ?? null}, name),
        slug = COALESCE(${data.slug ?? null}, slug),
        phone = COALESCE(${data.phone ?? null}, phone),
        address = COALESCE(${data.address ?? null}, address),
        logo_url = COALESCE(${data.logo_url ?? null}, logo_url),
        primary_color = COALESCE(${data.primary_color ?? null}, primary_color),
        secondary_color = COALESCE(${data.secondary_color ?? null}, secondary_color),
        menu_layout = COALESCE(${data.menu_layout ?? null}, menu_layout),
        menu_title = COALESCE(${data.menu_title ?? null}, menu_title),
        menu_description = COALESCE(${data.menu_description ?? null}, menu_description),
        billing_tier = COALESCE(${data.billing_tier ?? null}, billing_tier),
        billing_model = COALESCE(${data.billing_model ?? null}, billing_model),
        billing_status = COALESCE(${data.billing_status ?? null}, billing_status),
        billing_end_date = COALESCE(${data.billing_end_date ?? null}, billing_end_date),
        billing_period = COALESCE(${data.billing_period ?? null}, billing_period),
        timezone = COALESCE(${data.timezone ?? null}, timezone),
        opening_time = COALESCE(${data.opening_time ?? null}, opening_time),
        closing_time = COALESCE(${data.closing_time ?? null}, closing_time),
        rollover_time = COALESCE(${data.rollover_time ?? null}, rollover_time),
        gst_type = COALESCE(${data.gst_type ?? null}, gst_type),
        gst_number = COALESCE(${data.gst_number ?? null}, gst_number),
        gst_rate = COALESCE(${data.gst_rate ?? null}, gst_rate),
        custom_subscription_charge = CASE WHEN ${data.custom_subscription_charge !== undefined} THEN ${data.custom_subscription_charge ?? null} ELSE custom_subscription_charge END,
        custom_otp_charge = CASE WHEN ${data.custom_otp_charge !== undefined} THEN ${data.custom_otp_charge ?? null} ELSE custom_otp_charge END,
        monthly_ai_credits = CASE WHEN ${data.monthly_ai_credits !== undefined} THEN ${data.monthly_ai_credits ?? 10} ELSE monthly_ai_credits END,
        custom_ai_credits = CASE WHEN ${data.custom_ai_credits !== undefined} THEN ${data.custom_ai_credits ?? null} ELSE custom_ai_credits END,
        country = COALESCE(${data.country ?? null}, country),
        country_code = COALESCE(${data.country_code ?? null}, country_code),
        state = COALESCE(${data.state ?? null}, state),
        state_code = COALESCE(${data.state_code ?? null}, state_code),
        district = COALESCE(${data.district ?? null}, district),
        city = COALESCE(${data.city ?? null}, city),
        latitude = CASE WHEN ${data.latitude !== undefined} THEN ${data.latitude ?? null} ELSE latitude END,
        longitude = CASE WHEN ${data.longitude !== undefined} THEN ${data.longitude ?? null} ELSE longitude END,
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;
    return rows[0] || null;
  } catch (error: any) {
    if (error.message?.includes('column') || error.message?.includes('does not exist')) {
      console.log("Missing menu columns detected in updateRestaurant. Attempting auto-migration...");
      await runAutoMigration(sql);
      try {
        const rows = await sql`
          UPDATE restaurants SET
            name = COALESCE(${data.name ?? null}, name),
            slug = COALESCE(${data.slug ?? null}, slug),
            phone = COALESCE(${data.phone ?? null}, phone),
            address = COALESCE(${data.address ?? null}, address),
            logo_url = COALESCE(${data.logo_url ?? null}, logo_url),
            primary_color = COALESCE(${data.primary_color ?? null}, primary_color),
            secondary_color = COALESCE(${data.secondary_color ?? null}, secondary_color),
            menu_layout = COALESCE(${data.menu_layout ?? null}, menu_layout),
            menu_title = COALESCE(${data.menu_title ?? null}, menu_title),
            menu_description = COALESCE(${data.menu_description ?? null}, menu_description),
            updated_at = NOW()
          WHERE id = ${id}
          RETURNING *
        `;
        return rows[0] || null;
      } catch (retryError) {
        // Fallback update without custom columns
        const rows = await sql`
          UPDATE restaurants SET
            name = COALESCE(${data.name ?? null}, name),
            slug = COALESCE(${data.slug ?? null}, slug),
            phone = COALESCE(${data.phone ?? null}, phone),
            address = COALESCE(${data.address ?? null}, address),
            logo_url = COALESCE(${data.logo_url ?? null}, logo_url),
            primary_color = COALESCE(${data.primary_color ?? null}, primary_color),
            secondary_color = COALESCE(${data.secondary_color ?? null}, secondary_color),
            menu_layout = COALESCE(${data.menu_layout ?? null}, menu_layout),
            updated_at = NOW()
          WHERE id = ${id}
          RETURNING *
        `;
        const res = rows[0] || null;
        if (res) {
          res.menu_title = "Today's Specials";
          res.menu_description = "Hand-curated coastal delicacies prepared with traditional recipes.";
        }
        return res;
      }
    }
    throw error;
  }
}

export async function deleteRestaurant(id: string) {
  await sql`DELETE FROM restaurants WHERE id = ${id}`;
}

// ============================================
// SUPER ADMIN: MODULE MANAGEMENT
// ============================================

export async function getRestaurantWithModules(id: string) {
  const restaurant = await getRestaurantById(id);
  if (!restaurant) return null;
  const modules = await getRestaurantModules(id);
  return { ...restaurant, modules };
}

export async function setRestaurantModule(restaurantId: string, moduleName: string, isEnabled: boolean) {
  await sql`
    INSERT INTO restaurant_modules (restaurant_id, module_name, is_enabled)
    VALUES (${restaurantId}, ${moduleName}, ${isEnabled})
    ON CONFLICT (restaurant_id, module_name)
    DO UPDATE SET is_enabled = ${isEnabled}, updated_at = NOW()
  `;
}

export async function setAllRestaurantModules(restaurantId: string, modules: { module_name: string; is_enabled: boolean }[]) {
  for (const mod of modules) {
    await setRestaurantModule(restaurantId, mod.module_name, mod.is_enabled);
  }
}

// ============================================
// PRODUCT QUERIES
// ============================================

export async function getProducts(restaurantId: string, activeOnly = true) {
  const rows = await sql`
    SELECT * FROM products 
    WHERE restaurant_id = ${restaurantId} AND is_active = ${activeOnly}
    ORDER BY
      CASE status
        WHEN 'AVAILABLE' THEN 1
        WHEN 'LOW_STOCK' THEN 2
        WHEN 'OUT_OF_STOCK' THEN 3
        ELSE 4
      END ASC,
      created_at DESC
  `;
  return rows;
}

export async function getProductById(restaurantId: string, id: string) {
  const rows = await sql`
    SELECT * FROM products WHERE restaurant_id = ${restaurantId} AND id = ${id} LIMIT 1
  `;
  return rows[0] || null;
}

export async function createProduct(data: {
  restaurant_id: string;
  name: string;
  description: string;
  price: number;
  image_url: string;
  stock_quantity: number;
  buffer_quantity: number;
  status: string;
  category: string;
  dietary_preference?: string;
}) {
  const rows = await sql`
    INSERT INTO products (restaurant_id, name, description, price, image_url, stock_quantity, buffer_quantity, status, category, dietary_preference)
    VALUES (${data.restaurant_id}, ${data.name}, ${data.description}, ${data.price}, ${data.image_url}, 
            ${data.stock_quantity}, ${data.buffer_quantity}, ${data.status}, ${data.category}, ${data.dietary_preference || 'NON_VEG'})
    RETURNING *
  `;
  return rows[0];
}

export async function updateProduct(restaurantId: string, id: string, data: Partial<{
  name: string;
  description: string;
  price: number;
  image_url: string;
  stock_quantity: number;
  buffer_quantity: number;
  status: string;
  category: string;
  is_active: boolean;
  dietary_preference: string;
}>) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Acquire an explicit row-level lock
    await client.query(
      `SELECT id FROM products WHERE restaurant_id = $1 AND id = $2 FOR UPDATE`,
      [restaurantId, id]
    );

    // 2. Perform the update
    const result = await client.query(
      `
      UPDATE products SET
        name = COALESCE($1, name),
        description = COALESCE($2, description),
        price = COALESCE($3, price),
        image_url = COALESCE($4, image_url),
        stock_quantity = COALESCE($5, stock_quantity),
        buffer_quantity = COALESCE($6, buffer_quantity),
        status = COALESCE($7, status),
        category = COALESCE($8, category),
        is_active = COALESCE($9, is_active),
        dietary_preference = COALESCE($10, dietary_preference),
        updated_at = NOW()
      WHERE restaurant_id = $11 AND id = $12
      RETURNING *
      `,
      [
        data.name ?? null, data.description ?? null, data.price ?? null, data.image_url ?? null,
        data.stock_quantity ?? null, data.buffer_quantity ?? null, data.status ?? null,
        data.category ?? null, data.is_active ?? null, data.dietary_preference ?? null,
        restaurantId, id
      ]
    );

    await client.query('COMMIT');
    return result.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function softDeleteProduct(restaurantId: string, id: string) {
  await sql`UPDATE products SET is_active = false, updated_at = NOW() WHERE restaurant_id = ${restaurantId} AND id = ${id}`;
}

// ============================================
// ORDER QUERIES
// ============================================

export async function getOrders(restaurantId: string, filters: {
  status?: string;
  status_in?: string;
  date_from?: string;
  date_to?: string;
  phone?: string;
  payment_method?: string;
  order_type?: string;
  search?: string;
  sort?: 'ASC' | 'DESC';
  page?: number;
  per_page?: number;
} = {}) {
  const { page = 1, per_page = 50, sort = 'ASC' } = filters;
  const offset = (page - 1) * per_page;
  const localTimezone = 'Asia/Kolkata';

  if (filters.date_from && filters.date_to) {
    if (filters.status) {
      if (sort === 'DESC') {
        return await sql`
          SELECT o.*, s.name as staff_name, (SELECT json_agg(json_build_object('id', oi.id, 'product_id', oi.product_id, 'quantity', oi.quantity, 'price_at_purchase', oi.price_at_purchase, 'product_name', p.name) ORDER BY oi.id) FROM order_items oi LEFT JOIN products p ON p.id = oi.product_id WHERE oi.order_id = o.id) as items
          FROM orders o LEFT JOIN staffs s ON s.id = o.staff_id JOIN restaurants r ON r.id = o.restaurant_id WHERE o.restaurant_id = ${restaurantId} AND (${filters.payment_method || null}::varchar IS NULL OR o.payment_method = ${filters.payment_method || null}::varchar) AND (${filters.order_type || null}::varchar IS NULL OR o.order_type = ${filters.order_type || null}::varchar) AND o.status = ${filters.status} 
            AND o.business_date >= ${filters.date_from}::date
            AND o.business_date <= ${filters.date_to}::date
          ORDER BY o.business_date DESC,
                   o.created_at DESC,
                   o.ticket_number DESC
          LIMIT ${per_page} OFFSET ${offset}
        `;
      }
      return await sql`
        SELECT o.*, s.name as staff_name, (SELECT json_agg(json_build_object('id', oi.id, 'product_id', oi.product_id, 'quantity', oi.quantity, 'price_at_purchase', oi.price_at_purchase, 'product_name', p.name) ORDER BY oi.id) FROM order_items oi LEFT JOIN products p ON p.id = oi.product_id WHERE oi.order_id = o.id) as items
        FROM orders o LEFT JOIN staffs s ON s.id = o.staff_id JOIN restaurants r ON r.id = o.restaurant_id WHERE o.restaurant_id = ${restaurantId} AND (${filters.payment_method || null}::varchar IS NULL OR o.payment_method = ${filters.payment_method || null}::varchar) AND (${filters.order_type || null}::varchar IS NULL OR o.order_type = ${filters.order_type || null}::varchar) AND o.status = ${filters.status} 
          AND o.business_date >= ${filters.date_from}::date
          AND o.business_date <= ${filters.date_to}::date
        ORDER BY o.business_date ASC,
                 o.created_at ASC,
                 o.ticket_number ASC
        LIMIT ${per_page} OFFSET ${offset}
      `;
    } else if (filters.status_in) {
      const statuses = filters.status_in.split(',');
      if (sort === 'DESC') {
        return await sql`
          SELECT o.*, s.name as staff_name, (SELECT json_agg(json_build_object('id', oi.id, 'product_id', oi.product_id, 'quantity', oi.quantity, 'price_at_purchase', oi.price_at_purchase, 'product_name', p.name) ORDER BY oi.id) FROM order_items oi LEFT JOIN products p ON p.id = oi.product_id WHERE oi.order_id = o.id) as items
          FROM orders o LEFT JOIN staffs s ON s.id = o.staff_id JOIN restaurants r ON r.id = o.restaurant_id WHERE o.restaurant_id = ${restaurantId} AND (${filters.payment_method || null}::varchar IS NULL OR o.payment_method = ${filters.payment_method || null}::varchar) AND (${filters.order_type || null}::varchar IS NULL OR o.order_type = ${filters.order_type || null}::varchar) AND o.status = ANY(${statuses})
            AND o.business_date >= ${filters.date_from}::date
            AND o.business_date <= ${filters.date_to}::date
          ORDER BY o.business_date DESC,
                   o.created_at DESC,
                   o.ticket_number DESC
          LIMIT ${per_page} OFFSET ${offset}
        `;
      }
      return await sql`
        SELECT o.*, s.name as staff_name, (SELECT json_agg(json_build_object('id', oi.id, 'product_id', oi.product_id, 'quantity', oi.quantity, 'price_at_purchase', oi.price_at_purchase, 'product_name', p.name) ORDER BY oi.id) FROM order_items oi LEFT JOIN products p ON p.id = oi.product_id WHERE oi.order_id = o.id) as items
        FROM orders o LEFT JOIN staffs s ON s.id = o.staff_id JOIN restaurants r ON r.id = o.restaurant_id WHERE o.restaurant_id = ${restaurantId} AND (${filters.payment_method || null}::varchar IS NULL OR o.payment_method = ${filters.payment_method || null}::varchar) AND (${filters.order_type || null}::varchar IS NULL OR o.order_type = ${filters.order_type || null}::varchar) AND o.status = ANY(${statuses})
          AND o.business_date >= ${filters.date_from}::date
          AND o.business_date <= ${filters.date_to}::date
        ORDER BY o.business_date ASC,
                 o.created_at ASC,
                 o.ticket_number ASC
        LIMIT ${per_page} OFFSET ${offset}
      `;
    } else {
      if (sort === 'DESC') {
        return await sql`
          SELECT o.*, s.name as staff_name, (SELECT json_agg(json_build_object('id', oi.id, 'product_id', oi.product_id, 'quantity', oi.quantity, 'price_at_purchase', oi.price_at_purchase, 'product_name', p.name) ORDER BY oi.id) FROM order_items oi LEFT JOIN products p ON p.id = oi.product_id WHERE oi.order_id = o.id) as items
          FROM orders o LEFT JOIN staffs s ON s.id = o.staff_id JOIN restaurants r ON r.id = o.restaurant_id WHERE o.restaurant_id = ${restaurantId} AND (${filters.payment_method || null}::varchar IS NULL OR o.payment_method = ${filters.payment_method || null}::varchar) AND (${filters.order_type || null}::varchar IS NULL OR o.order_type = ${filters.order_type || null}::varchar) AND o.business_date >= ${filters.date_from}::date
            AND o.business_date <= ${filters.date_to}::date
          ORDER BY o.business_date DESC,
                   o.created_at DESC,
                   o.ticket_number DESC
          LIMIT ${per_page} OFFSET ${offset}
        `;
      }
      return await sql`
        SELECT o.*, s.name as staff_name, (SELECT json_agg(json_build_object('id', oi.id, 'product_id', oi.product_id, 'quantity', oi.quantity, 'price_at_purchase', oi.price_at_purchase, 'product_name', p.name) ORDER BY oi.id) FROM order_items oi LEFT JOIN products p ON p.id = oi.product_id WHERE oi.order_id = o.id) as items
        FROM orders o LEFT JOIN staffs s ON s.id = o.staff_id JOIN restaurants r ON r.id = o.restaurant_id WHERE o.restaurant_id = ${restaurantId} AND (${filters.payment_method || null}::varchar IS NULL OR o.payment_method = ${filters.payment_method || null}::varchar) AND (${filters.order_type || null}::varchar IS NULL OR o.order_type = ${filters.order_type || null}::varchar) AND o.business_date >= ${filters.date_from}::date
          AND o.business_date <= ${filters.date_to}::date
        ORDER BY o.business_date ASC,
                 o.created_at ASC,
                 o.ticket_number ASC
        LIMIT ${per_page} OFFSET ${offset}
      `;
    }
  }

  if (filters.status) {
    if (sort === 'DESC') {
      return await sql`
        SELECT o.*, s.name as staff_name, (SELECT json_agg(json_build_object('id', oi.id, 'product_id', oi.product_id, 'quantity', oi.quantity, 'price_at_purchase', oi.price_at_purchase, 'product_name', p.name) ORDER BY oi.id) FROM order_items oi LEFT JOIN products p ON p.id = oi.product_id WHERE oi.order_id = o.id) as items
        FROM orders o LEFT JOIN staffs s ON s.id = o.staff_id JOIN restaurants r ON r.id = o.restaurant_id WHERE o.restaurant_id = ${restaurantId} AND (${filters.payment_method || null}::varchar IS NULL OR o.payment_method = ${filters.payment_method || null}::varchar) AND (${filters.order_type || null}::varchar IS NULL OR o.order_type = ${filters.order_type || null}::varchar) AND o.status = ${filters.status}
        ORDER BY o.created_at DESC LIMIT ${per_page} OFFSET ${offset}
      `;
    }
    return await sql`
      SELECT o.*, s.name as staff_name, (SELECT json_agg(json_build_object('id', oi.id, 'product_id', oi.product_id, 'quantity', oi.quantity, 'price_at_purchase', oi.price_at_purchase, 'product_name', p.name) ORDER BY oi.id) FROM order_items oi LEFT JOIN products p ON p.id = oi.product_id WHERE oi.order_id = o.id) as items
      FROM orders o LEFT JOIN staffs s ON s.id = o.staff_id JOIN restaurants r ON r.id = o.restaurant_id WHERE o.restaurant_id = ${restaurantId} AND (${filters.payment_method || null}::varchar IS NULL OR o.payment_method = ${filters.payment_method || null}::varchar) AND (${filters.order_type || null}::varchar IS NULL OR o.order_type = ${filters.order_type || null}::varchar) AND o.status = ${filters.status}
      ORDER BY o.created_at ASC LIMIT ${per_page} OFFSET ${offset}
    `;
  }

  if (filters.status_in) {
    const statuses = filters.status_in.split(',');
    if (sort === 'DESC') {
      return await sql`
          SELECT o.*, s.name as staff_name, (SELECT json_agg(json_build_object('id', oi.id, 'product_id', oi.product_id, 'quantity', oi.quantity, 'price_at_purchase', oi.price_at_purchase, 'product_name', p.name) ORDER BY oi.id) FROM order_items oi LEFT JOIN products p ON p.id = oi.product_id WHERE oi.order_id = o.id) as items
          FROM orders o LEFT JOIN staffs s ON s.id = o.staff_id JOIN restaurants r ON r.id = o.restaurant_id WHERE o.restaurant_id = ${restaurantId} AND (${filters.payment_method || null}::varchar IS NULL OR o.payment_method = ${filters.payment_method || null}::varchar) AND (${filters.order_type || null}::varchar IS NULL OR o.order_type = ${filters.order_type || null}::varchar) AND o.status = ANY(${statuses})
          ORDER BY o.created_at DESC LIMIT ${per_page} OFFSET ${offset}
        `;
    }
    return await sql`
        SELECT o.*, s.name as staff_name, (SELECT json_agg(json_build_object('id', oi.id, 'product_id', oi.product_id, 'quantity', oi.quantity, 'price_at_purchase', oi.price_at_purchase, 'product_name', p.name) ORDER BY oi.id) FROM order_items oi LEFT JOIN products p ON p.id = oi.product_id WHERE oi.order_id = o.id) as items
        FROM orders o LEFT JOIN staffs s ON s.id = o.staff_id JOIN restaurants r ON r.id = o.restaurant_id WHERE o.restaurant_id = ${restaurantId} AND (${filters.payment_method || null}::varchar IS NULL OR o.payment_method = ${filters.payment_method || null}::varchar) AND (${filters.order_type || null}::varchar IS NULL OR o.order_type = ${filters.order_type || null}::varchar) AND o.status = ANY(${statuses})
        ORDER BY o.created_at ASC LIMIT ${per_page} OFFSET ${offset}
      `;
  }

  if (sort === 'DESC') {
    return await sql`
      SELECT o.*, s.name as staff_name, (SELECT json_agg(json_build_object('id', oi.id, 'product_id', oi.product_id, 'quantity', oi.quantity, 'price_at_purchase', oi.price_at_purchase, 'product_name', p.name) ORDER BY oi.id) FROM order_items oi LEFT JOIN products p ON p.id = oi.product_id WHERE oi.order_id = o.id) as items
      FROM orders o LEFT JOIN staffs s ON s.id = o.staff_id JOIN restaurants r ON r.id = o.restaurant_id WHERE o.restaurant_id = ${restaurantId} AND (${filters.payment_method || null}::varchar IS NULL OR o.payment_method = ${filters.payment_method || null}::varchar) AND (${filters.order_type || null}::varchar IS NULL OR o.order_type = ${filters.order_type || null}::varchar)
      ORDER BY o.created_at DESC LIMIT ${per_page} OFFSET ${offset}
    `;
  }
  return await sql`
    SELECT o.*, s.name as staff_name, (SELECT json_agg(json_build_object('id', oi.id, 'product_id', oi.product_id, 'quantity', oi.quantity, 'price_at_purchase', oi.price_at_purchase, 'product_name', p.name) ORDER BY oi.id) FROM order_items oi LEFT JOIN products p ON p.id = oi.product_id WHERE oi.order_id = o.id) as items
    FROM orders o LEFT JOIN staffs s ON s.id = o.staff_id JOIN restaurants r ON r.id = o.restaurant_id WHERE o.restaurant_id = ${restaurantId} AND (${filters.payment_method || null}::varchar IS NULL OR o.payment_method = ${filters.payment_method || null}::varchar) AND (${filters.order_type || null}::varchar IS NULL OR o.order_type = ${filters.order_type || null}::varchar)
    ORDER BY o.created_at ASC LIMIT ${per_page} OFFSET ${offset}
  `;
}

export async function getOrderStats(restaurantId: string, filters: {
  status?: string;
  status_in?: string;
  date_from?: string;
  date_to?: string;
  phone?: string;
  payment_method?: string;
  order_type?: string;
  search?: string;
} = {}) {
  const localTimezone = 'Asia/Kolkata';

  if (filters.date_from && filters.date_to) {
    if (filters.status) {
      return await sql`
        SELECT 
          COUNT(*)::int as total_orders,
          COUNT(*) FILTER (WHERE status = 'PAID')::int as paid_orders,
          COALESCE(SUM(total_price) FILTER (WHERE status != 'CANCELLED'), 0) as total_revenue,
          COALESCE(SUM(total_price) FILTER (WHERE status = 'PAID'), 0) as total_paid_revenue,
          COALESCE(SUM(subtotal) FILTER (WHERE status != 'CANCELLED' AND COALESCE(NULLIF(orders.gst_type, 'NONE'), r.gst_type, 'NONE') = 'REGULAR'), 0) as total_regular_subtotal,
          COALESCE(SUM(gst_amount) FILTER (WHERE status != 'CANCELLED' AND COALESCE(NULLIF(orders.gst_type, 'NONE'), r.gst_type, 'NONE') = 'REGULAR'), 0) as total_regular_gst,
          COALESCE(SUM(total_price) FILTER (WHERE status != 'CANCELLED' AND COALESCE(NULLIF(orders.gst_type, 'NONE'), r.gst_type, 'NONE') = 'COMPOSITION'), 0) as total_composition_revenue,
          COALESCE(SUM(total_price * COALESCE(NULLIF(orders.gst_rate, 0), NULLIF(r.gst_rate, 0), 5) / 100) FILTER (WHERE status != 'CANCELLED' AND COALESCE(NULLIF(orders.gst_type, 'NONE'), r.gst_type, 'NONE') = 'COMPOSITION'), 0) as total_composition_gst,
          COALESCE(SUM(total_price) FILTER (WHERE status != 'CANCELLED' AND COALESCE(NULLIF(orders.gst_type, 'NONE'), r.gst_type, 'NONE') = 'NONE'), 0) as total_none_revenue
        FROM orders JOIN restaurants r ON r.id = orders.restaurant_id WHERE orders.restaurant_id = ${restaurantId} AND (${filters.payment_method || null}::varchar IS NULL OR orders.payment_method = ${filters.payment_method || null}::varchar) AND (${filters.order_type || null}::varchar IS NULL OR orders.order_type = ${filters.order_type || null}::varchar) AND status = ${filters.status}
          AND orders.business_date >= ${filters.date_from}::date
          AND orders.business_date <= ${filters.date_to}::date
      `;
    } else if (filters.status_in) {
      const statuses = filters.status_in.split(',');
      return await sql`
        SELECT 
          COUNT(*)::int as total_orders,
          COUNT(*) FILTER (WHERE status = 'PAID')::int as paid_orders,
          COALESCE(SUM(total_price) FILTER (WHERE status != 'CANCELLED'), 0) as total_revenue,
          COALESCE(SUM(total_price) FILTER (WHERE status = 'PAID'), 0) as total_paid_revenue,
          COALESCE(SUM(subtotal) FILTER (WHERE status != 'CANCELLED' AND COALESCE(NULLIF(orders.gst_type, 'NONE'), r.gst_type, 'NONE') = 'REGULAR'), 0) as total_regular_subtotal,
          COALESCE(SUM(gst_amount) FILTER (WHERE status != 'CANCELLED' AND COALESCE(NULLIF(orders.gst_type, 'NONE'), r.gst_type, 'NONE') = 'REGULAR'), 0) as total_regular_gst,
          COALESCE(SUM(total_price) FILTER (WHERE status != 'CANCELLED' AND COALESCE(NULLIF(orders.gst_type, 'NONE'), r.gst_type, 'NONE') = 'COMPOSITION'), 0) as total_composition_revenue,
          COALESCE(SUM(total_price * COALESCE(NULLIF(orders.gst_rate, 0), NULLIF(r.gst_rate, 0), 5) / 100) FILTER (WHERE status != 'CANCELLED' AND COALESCE(NULLIF(orders.gst_type, 'NONE'), r.gst_type, 'NONE') = 'COMPOSITION'), 0) as total_composition_gst,
          COALESCE(SUM(total_price) FILTER (WHERE status != 'CANCELLED' AND COALESCE(NULLIF(orders.gst_type, 'NONE'), r.gst_type, 'NONE') = 'NONE'), 0) as total_none_revenue
        FROM orders JOIN restaurants r ON r.id = orders.restaurant_id WHERE orders.restaurant_id = ${restaurantId} AND (${filters.payment_method || null}::varchar IS NULL OR orders.payment_method = ${filters.payment_method || null}::varchar) AND (${filters.order_type || null}::varchar IS NULL OR orders.order_type = ${filters.order_type || null}::varchar) AND status = ANY(${statuses})
          AND orders.business_date >= ${filters.date_from}::date
          AND orders.business_date <= ${filters.date_to}::date
      `;
    } else {
      return await sql`
        SELECT 
          COUNT(*)::int as total_orders,
          COUNT(*) FILTER (WHERE status = 'PAID')::int as paid_orders,
          COALESCE(SUM(total_price) FILTER (WHERE status != 'CANCELLED'), 0) as total_revenue,
          COALESCE(SUM(total_price) FILTER (WHERE status = 'PAID'), 0) as total_paid_revenue,
          COALESCE(SUM(subtotal) FILTER (WHERE status != 'CANCELLED' AND COALESCE(NULLIF(orders.gst_type, 'NONE'), r.gst_type, 'NONE') = 'REGULAR'), 0) as total_regular_subtotal,
          COALESCE(SUM(gst_amount) FILTER (WHERE status != 'CANCELLED' AND COALESCE(NULLIF(orders.gst_type, 'NONE'), r.gst_type, 'NONE') = 'REGULAR'), 0) as total_regular_gst,
          COALESCE(SUM(total_price) FILTER (WHERE status != 'CANCELLED' AND COALESCE(NULLIF(orders.gst_type, 'NONE'), r.gst_type, 'NONE') = 'COMPOSITION'), 0) as total_composition_revenue,
          COALESCE(SUM(total_price * COALESCE(NULLIF(orders.gst_rate, 0), NULLIF(r.gst_rate, 0), 5) / 100) FILTER (WHERE status != 'CANCELLED' AND COALESCE(NULLIF(orders.gst_type, 'NONE'), r.gst_type, 'NONE') = 'COMPOSITION'), 0) as total_composition_gst,
          COALESCE(SUM(total_price) FILTER (WHERE status != 'CANCELLED' AND COALESCE(NULLIF(orders.gst_type, 'NONE'), r.gst_type, 'NONE') = 'NONE'), 0) as total_none_revenue
        FROM orders JOIN restaurants r ON r.id = orders.restaurant_id WHERE orders.restaurant_id = ${restaurantId} AND (${filters.payment_method || null}::varchar IS NULL OR orders.payment_method = ${filters.payment_method || null}::varchar) AND (${filters.order_type || null}::varchar IS NULL OR orders.order_type = ${filters.order_type || null}::varchar) AND orders.business_date >= ${filters.date_from}::date
          AND orders.business_date <= ${filters.date_to}::date
      `;
    }
  }

  if (filters.status) {
    return await sql`
      SELECT 
          COUNT(*)::int as total_orders,
          COUNT(*) FILTER (WHERE status = 'PAID')::int as paid_orders,
          COALESCE(SUM(total_price) FILTER (WHERE status != 'CANCELLED'), 0) as total_revenue,
          COALESCE(SUM(total_price) FILTER (WHERE status = 'PAID'), 0) as total_paid_revenue,
          COALESCE(SUM(subtotal) FILTER (WHERE status != 'CANCELLED' AND COALESCE(NULLIF(orders.gst_type, 'NONE'), r.gst_type, 'NONE') = 'REGULAR'), 0) as total_regular_subtotal,
          COALESCE(SUM(gst_amount) FILTER (WHERE status != 'CANCELLED' AND COALESCE(NULLIF(orders.gst_type, 'NONE'), r.gst_type, 'NONE') = 'REGULAR'), 0) as total_regular_gst,
          COALESCE(SUM(total_price) FILTER (WHERE status != 'CANCELLED' AND COALESCE(NULLIF(orders.gst_type, 'NONE'), r.gst_type, 'NONE') = 'COMPOSITION'), 0) as total_composition_revenue,
          COALESCE(SUM(total_price * COALESCE(NULLIF(orders.gst_rate, 0), NULLIF(r.gst_rate, 0), 5) / 100) FILTER (WHERE status != 'CANCELLED' AND COALESCE(NULLIF(orders.gst_type, 'NONE'), r.gst_type, 'NONE') = 'COMPOSITION'), 0) as total_composition_gst,
          COALESCE(SUM(total_price) FILTER (WHERE status != 'CANCELLED' AND COALESCE(NULLIF(orders.gst_type, 'NONE'), r.gst_type, 'NONE') = 'NONE'), 0) as total_none_revenue
        FROM orders JOIN restaurants r ON r.id = orders.restaurant_id WHERE orders.restaurant_id = ${restaurantId} AND (${filters.payment_method || null}::varchar IS NULL OR orders.payment_method = ${filters.payment_method || null}::varchar) AND (${filters.order_type || null}::varchar IS NULL OR orders.order_type = ${filters.order_type || null}::varchar) AND status = ${filters.status}
    `;
  }

  if (filters.status_in) {
    const statuses = filters.status_in.split(',');
    return await sql`
      SELECT 
          COUNT(*)::int as total_orders,
          COUNT(*) FILTER (WHERE status = 'PAID')::int as paid_orders,
          COALESCE(SUM(total_price) FILTER (WHERE status != 'CANCELLED'), 0) as total_revenue,
          COALESCE(SUM(total_price) FILTER (WHERE status = 'PAID'), 0) as total_paid_revenue,
          COALESCE(SUM(subtotal) FILTER (WHERE status != 'CANCELLED' AND COALESCE(NULLIF(orders.gst_type, 'NONE'), r.gst_type, 'NONE') = 'REGULAR'), 0) as total_regular_subtotal,
          COALESCE(SUM(gst_amount) FILTER (WHERE status != 'CANCELLED' AND COALESCE(NULLIF(orders.gst_type, 'NONE'), r.gst_type, 'NONE') = 'REGULAR'), 0) as total_regular_gst,
          COALESCE(SUM(total_price) FILTER (WHERE status != 'CANCELLED' AND COALESCE(NULLIF(orders.gst_type, 'NONE'), r.gst_type, 'NONE') = 'COMPOSITION'), 0) as total_composition_revenue,
          COALESCE(SUM(total_price * COALESCE(NULLIF(orders.gst_rate, 0), NULLIF(r.gst_rate, 0), 5) / 100) FILTER (WHERE status != 'CANCELLED' AND COALESCE(NULLIF(orders.gst_type, 'NONE'), r.gst_type, 'NONE') = 'COMPOSITION'), 0) as total_composition_gst,
          COALESCE(SUM(total_price) FILTER (WHERE status != 'CANCELLED' AND COALESCE(NULLIF(orders.gst_type, 'NONE'), r.gst_type, 'NONE') = 'NONE'), 0) as total_none_revenue
        FROM orders JOIN restaurants r ON r.id = orders.restaurant_id WHERE orders.restaurant_id = ${restaurantId} AND (${filters.payment_method || null}::varchar IS NULL OR orders.payment_method = ${filters.payment_method || null}::varchar) AND (${filters.order_type || null}::varchar IS NULL OR orders.order_type = ${filters.order_type || null}::varchar) AND status = ANY(${statuses})
    `;
  }

  return await sql`
    SELECT 
          COUNT(*)::int as total_orders,
          COUNT(*) FILTER (WHERE status = 'PAID')::int as paid_orders,
          COALESCE(SUM(total_price) FILTER (WHERE status != 'CANCELLED'), 0) as total_revenue,
          COALESCE(SUM(total_price) FILTER (WHERE status = 'PAID'), 0) as total_paid_revenue,
          COALESCE(SUM(subtotal) FILTER (WHERE status != 'CANCELLED' AND COALESCE(NULLIF(orders.gst_type, 'NONE'), r.gst_type, 'NONE') = 'REGULAR'), 0) as total_regular_subtotal,
          COALESCE(SUM(gst_amount) FILTER (WHERE status != 'CANCELLED' AND COALESCE(NULLIF(orders.gst_type, 'NONE'), r.gst_type, 'NONE') = 'REGULAR'), 0) as total_regular_gst,
          COALESCE(SUM(total_price) FILTER (WHERE status != 'CANCELLED' AND COALESCE(NULLIF(orders.gst_type, 'NONE'), r.gst_type, 'NONE') = 'COMPOSITION'), 0) as total_composition_revenue,
          COALESCE(SUM(total_price * COALESCE(NULLIF(orders.gst_rate, 0), NULLIF(r.gst_rate, 0), 5) / 100) FILTER (WHERE status != 'CANCELLED' AND COALESCE(NULLIF(orders.gst_type, 'NONE'), r.gst_type, 'NONE') = 'COMPOSITION'), 0) as total_composition_gst,
          COALESCE(SUM(total_price) FILTER (WHERE status != 'CANCELLED' AND COALESCE(NULLIF(orders.gst_type, 'NONE'), r.gst_type, 'NONE') = 'NONE'), 0) as total_none_revenue
        FROM orders JOIN restaurants r ON r.id = orders.restaurant_id WHERE orders.restaurant_id = ${restaurantId} AND (${filters.payment_method || null}::varchar IS NULL OR orders.payment_method = ${filters.payment_method || null}::varchar) AND (${filters.order_type || null}::varchar IS NULL OR orders.order_type = ${filters.order_type || null}::varchar)
  `;
}

export async function getOrderById(restaurantId: string, id: string) {
  const rows = await sql`
    WITH active_ranks AS (
       SELECT
         o.id as order_id,
         ROW_NUMBER() OVER (
           ORDER BY o.created_at ASC, o.ticket_number ASC
         )::integer as pos
       FROM orders o
       WHERE o.restaurant_id = ${restaurantId} 
         AND o.status = 'PENDING'
         AND o.business_date = (SELECT DATE((CURRENT_TIMESTAMP AT TIME ZONE timezone) - rollover_time::interval) FROM restaurants WHERE id = o.restaurant_id)
    )
    SELECT o.*, s.name as staff_name, 
      COALESCE(ar.pos, 0) as queue_position,
      json_agg(json_build_object(
        'id', oi.id, 
        'product_id', oi.product_id, 
        'quantity', oi.quantity, 
        'price_at_purchase', oi.price_at_purchase,
        'product_name', p.name,
        'product_image', p.image_url
      ) ORDER BY oi.id) as items
    FROM orders o 
    LEFT JOIN staffs s ON s.id = o.staff_id
    LEFT JOIN active_ranks ar ON ar.order_id = o.id
    LEFT JOIN order_items oi ON oi.order_id = o.id
    LEFT JOIN products p ON p.id = oi.product_id
    WHERE o.restaurant_id = ${restaurantId} AND o.id = ${id}
    GROUP BY o.id, ar.pos, s.name
    LIMIT 1
  `;
  return rows[0] || null;
}

export async function getOrderByTicket(restaurantId: string, ticket_number: number) {
  const rows = await sql`
    WITH active_ranks AS (
       SELECT
         o.id as order_id,
         ROW_NUMBER() OVER (
           ORDER BY o.created_at ASC, o.ticket_number ASC
         )::integer as pos
       FROM orders o
       WHERE o.restaurant_id = ${restaurantId} 
         AND o.status = 'PENDING'
         AND o.business_date = (SELECT DATE((CURRENT_TIMESTAMP AT TIME ZONE timezone) - rollover_time::interval) FROM restaurants WHERE id = o.restaurant_id)
    )
    SELECT o.*, s.name as staff_name, 
      COALESCE(ar.pos, 0) as queue_position,
      json_agg(json_build_object(
        'id', oi.id, 
        'product_id', oi.product_id,
        'quantity', oi.quantity, 
        'price_at_purchase', oi.price_at_purchase,
        'product_name', p.name,
        'product_image', p.image_url
      ) ORDER BY oi.id) as items
    FROM orders o LEFT JOIN staffs s ON s.id = o.staff_id
    LEFT JOIN active_ranks ar ON ar.order_id = o.id
    LEFT JOIN order_items oi ON oi.order_id = o.id
    LEFT JOIN products p ON p.id = oi.product_id
    WHERE o.restaurant_id = ${restaurantId} AND o.ticket_number = ${ticket_number}
    GROUP BY o.id, ar.pos, s.name
    ORDER BY o.created_at DESC
    LIMIT 1
  `;
  return rows[0] || null;
}

export async function getOrdersByPhone(restaurantId: string, phone: string) {
  const rows = await sql`
    WITH active_ranks AS (
       SELECT
         o.id as order_id,
         ROW_NUMBER() OVER (
           ORDER BY o.created_at ASC, o.ticket_number ASC
         )::integer as pos
       FROM orders o
       WHERE o.restaurant_id = ${restaurantId} 
         AND o.status = 'PENDING'
         AND o.business_date = (SELECT DATE((CURRENT_TIMESTAMP AT TIME ZONE timezone) - rollover_time::interval) FROM restaurants WHERE id = o.restaurant_id)
    )
    SELECT q.id, q.token_number as ticket_number, q.created_at, q.queue_type,
      o.id as order_id, o.is_paid, o.total_price,
      COALESCE(o.status, qs.possible_queue_status) as status,
      qs.color as status_color,
      u.name as customer_name,
      COALESCE(ar.pos, 0) as queue_position,
      (
        SELECT json_agg(json_build_object(
          'id', oi.id, 
          'product_id', oi.product_id,
          'quantity', oi.quantity, 
          'price_at_purchase', oi.price_at_purchase,
          'product_name', p.name
        ) ORDER BY oi.id) 
        FROM order_items oi 
        LEFT JOIN products p ON p.id = oi.product_id 
        WHERE oi.order_id = o.id
      ) as items
    FROM queues q
    JOIN users u ON u.id = q.user_id
    JOIN queue_status qs ON qs.id = q.queue_status_id
    LEFT JOIN orders o ON o.queue_id = q.id
    LEFT JOIN active_ranks ar ON ar.order_id = o.id
    WHERE q.restaurant_id = ${restaurantId} AND u.phone = ${phone} AND q.queue_type = 'ORDER'
    ORDER BY q.created_at DESC
    LIMIT 20
  `;
  return rows;
}

export async function getOrdersByPhonePaginated(restaurantId: string, phone: string, page: number = 1, limit: number = 20) {
  const offset = (page - 1) * limit;

  const countRows = await sql`
    SELECT COUNT(*)::integer as total
    FROM queues q
    JOIN users u ON u.id = q.user_id
    WHERE q.restaurant_id = ${restaurantId} AND u.phone = ${phone} AND q.queue_type = 'ORDER'
  `;
  const total = countRows[0]?.total || 0;

  const rows = await sql`
    SELECT 
      COALESCE(o.id, q.id) as id,
      q.id as queue_id,
      q.token_number as ticket_number, 
      q.created_at, 
      o.total_price,
      COALESCE(o.status, qs.possible_queue_status) as status,
      (
        SELECT COUNT(oi.id)
        FROM order_items oi 
        WHERE oi.order_id = o.id
      )::integer as item_count
    FROM queues q
    JOIN users u ON u.id = q.user_id
    JOIN queue_status qs ON qs.id = q.queue_status_id
    LEFT JOIN orders o ON o.queue_id = q.id
    WHERE q.restaurant_id = ${restaurantId} AND u.phone = ${phone} AND q.queue_type = 'ORDER'
    ORDER BY q.created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;
  return { data: rows, total, page, totalPages: Math.ceil(total / limit) };
}


export async function createOrder(data: {
  restaurant_id: string;
  customer_name: string;
  phone: string;
  total_price: number;
  subtotal?: number;
  gst_amount?: number;
  gst_rate?: number;
  gst_type?: string;
  notes?: string;
  party_size?: number;
  table_number?: string;
  order_type?: string;
  is_pos?: boolean;
  staff_id?: string;
  business_date?: string;
  items: { product_id: string; quantity: number; price_at_purchase: number }[];
}) {
  const normalized = new Map<string, { quantity: number; price_at_purchase: number }>();

  for (const item of data.items) {
    const qty = Number(item.quantity);
    const price = Number(item.price_at_purchase);

    if (!item.product_id || !Number.isInteger(qty) || qty <= 0) {
      throw new Error('Each order item must include a valid product and quantity');
    }
    if (!Number.isFinite(price) || price < 0) {
      throw new Error('Each order item must include a valid price');
    }

    const existing = normalized.get(item.product_id);
    if (existing) {
      existing.quantity += qty;
    } else {
      normalized.set(item.product_id, { quantity: qty, price_at_purchase: price });
    }
  }

  const normalizedItems = Array.from(normalized.entries()).map(([product_id, v]) => ({
    product_id,
    quantity: v.quantity,
    price_at_purchase: v.price_at_purchase,
  }));

  if (normalizedItems.length === 0) {
    throw new Error('At least one valid item is required.');
  }

  const productIds = normalizedItems.map((i) => i.product_id);
  const quantities = normalizedItems.map((i) => i.quantity);
  const prices = normalizedItems.map((i) => i.price_at_purchase);

  const computedTotal = Math.round(
    normalizedItems.reduce((sum, item) => sum + item.quantity * item.price_at_purchase, 0) * 100
  ) / 100;
  
  // Use passed subtotal or computed total
  const finalSubtotal = data.subtotal ?? computedTotal;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const reserveResult = await client.query(
      `
        WITH req AS (
          SELECT pid::uuid AS product_id, qty::int AS qty
          FROM unnest($1::uuid[], $2::int[]) AS t(pid, qty)
        ),
        updated AS (
          UPDATE products p
          SET
            stock_quantity = p.stock_quantity - r.qty,
            status = CASE
              WHEN p.stock_quantity - r.qty <= 0 THEN 'OUT_OF_STOCK'
              WHEN p.stock_quantity - r.qty <= p.buffer_quantity THEN 'LOW_STOCK'
              ELSE 'AVAILABLE'
            END,
            updated_at = NOW()
          FROM req r
          WHERE p.id = r.product_id
            AND p.stock_quantity >= r.qty
            AND p.is_active = true
          RETURNING p.id
        )
        SELECT
          (SELECT COUNT(*)::int FROM req) AS requested_count,
          (SELECT COUNT(*)::int FROM updated) AS updated_count
      `,
      [productIds, quantities]
    );

    const requestedCount = Number(reserveResult.rows[0]?.requested_count || 0);
    const updatedCount = Number(reserveResult.rows[0]?.updated_count || 0);

    if (updatedCount !== requestedCount) {
      throw new Error('One or more items are out of stock or no longer available.');
    }

    // 1. Ensure user exists
    const userRes = await client.query(`
      INSERT INTO users (name, phone, role)
      VALUES ($1, $2, 'USER')
      ON CONFLICT (phone) DO UPDATE SET name = EXCLUDED.name
      RETURNING id
    `, [data.customer_name || 'Guest', data.phone || '0000000000']);
    const userId = userRes.rows[0].id;

    // 2. Check if order is placed via table QR (table_number exists) or POS -> Set PREPARING, else PENDING
    const isTableOrder = Boolean(data.table_number && data.table_number.trim() !== '');
    const targetStatus = (data.is_pos || isTableOrder) ? 'PREPARING' : 'PENDING';
    
    let statusRes = await client.query(`SELECT id FROM queue_status WHERE restaurant_id = $1 AND possible_queue_status = $2 LIMIT 1`, [data.restaurant_id, targetStatus]);
    
    if (statusRes.rows.length === 0) {
      // Fallback to any valid queue status id just to satisfy foreign key (if required), but force the string name
      statusRes = await client.query(`SELECT id FROM queue_status WHERE restaurant_id = $1 ORDER BY priority ASC, id ASC LIMIT 1`, [data.restaurant_id]);
    }

    const statusId = statusRes.rows[0]?.id;
    const defaultStatus = targetStatus; // Strictly PENDING or PREPARING

    // 3. Lock the restaurant to prevent token number race conditions
    await client.query(`SELECT id FROM restaurants WHERE id = $1 FOR UPDATE`, [data.restaurant_id]);

    // 4. Get next token number (continuing from all time)
    const tokenRes = await client.query(`
      SELECT COALESCE(MAX(token_number), 0) + 1 AS next_token 
      FROM queues 
      WHERE restaurant_id = $1
    `, [data.restaurant_id]);
    const nextToken = tokenRes.rows[0].next_token;

    // 4. Create Queue Entry
    const queueRes = await client.query(`
      INSERT INTO queues (
        restaurant_id, user_id, queue_status_id, token_number, 
        queue_type, party_size, notes, business_date
      ) VALUES ($1, $2, $3, $4, 'ORDER', $5, $6, COALESCE($7, CURRENT_DATE))
      RETURNING id
    `, [data.restaurant_id, userId, statusId, nextToken, data.party_size || 1, data.notes || '', data.business_date || null]);
    const queueId = queueRes.rows[0].id;

    // Determine status timestamp
    const pendingAt = targetStatus === 'PENDING' ? new Date().toISOString() : new Date().toISOString();
    const preparingAt = targetStatus === 'PREPARING' ? new Date().toISOString() : null;

    // Handle table_id and table_session_id if order has table_number
    let tableId: string | null = null;
    let tableSessionId: string | null = null;

    if (data.table_number && data.table_number.trim() !== '') {
      const sessionInfo = await findOrCreateTableSession(client, data.restaurant_id, data.table_number, data.party_size || 1);
      tableId = sessionInfo.tableId;
      tableSessionId = sessionInfo.tableSessionId;
    }

    const orderResult = await client.query(
      `
        INSERT INTO orders (
          restaurant_id, queue_id, user_id, customer_name, phone, total_price, status, is_paid, 
          notes, party_size, ticket_number, table_number, table_id, table_session_id, staff_id, business_date, subtotal, 
          gst_amount, gst_rate, gst_type, pending_at, preparing_at, order_type
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, false, $8, $9, $10, $11, $12, $13, $14, COALESCE($15, CURRENT_DATE), $16, $17, $18, $19, $20, $21, $22)
        RETURNING id
      `,
      [
        data.restaurant_id, queueId, userId, data.customer_name, data.phone, data.total_price, defaultStatus, 
        data.notes || null, data.party_size || 1, nextToken, data.table_number || null, tableId, tableSessionId, data.staff_id || null, 
        data.business_date || null, finalSubtotal, data.gst_amount || 0, data.gst_rate || 0, data.gst_type || 'NONE',
        pendingAt, preparingAt, data.order_type || 'DINE_IN'
      ]
    );

    const orderId = orderResult.rows[0]?.id;
    if (!orderId) {
      throw new Error('Failed to create order.');
    }

    await client.query(
      `
        INSERT INTO order_items (order_id, product_id, quantity, price_at_purchase)
        SELECT $1::uuid, pid, qty, price
        FROM unnest($2::uuid[], $3::int[], $4::numeric[]) AS t(pid, qty, price)
      `,
      [orderId, productIds, quantities, prices]
    );

    await client.query('COMMIT');
    return await getOrderById(data.restaurant_id, orderId);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function findOrCreateTableSession(
  clientOrPool: any,
  restaurantId: string,
  tableNumber: string,
  partySize: number = 1
): Promise<{ tableId: string; tableSessionId: string }> {
  const cleanTableNum = tableNumber.trim();

  let tableRes = await clientOrPool.query(
    `SELECT id FROM restaurant_tables WHERE restaurant_id = $1 AND table_number = $2 LIMIT 1`,
    [restaurantId, cleanTableNum]
  );

  let tableId: string;
  if (tableRes.rows.length === 0) {
    const newTable = await clientOrPool.query(
      `INSERT INTO restaurant_tables (restaurant_id, table_number, capacity, status)
       VALUES ($1, $2, $3, 'OCCUPIED')
       ON CONFLICT (restaurant_id, table_number) DO UPDATE SET status = 'OCCUPIED'
       RETURNING id`,
      [restaurantId, cleanTableNum, partySize || 4]
    );
    tableId = newTable.rows[0].id;
  } else {
    tableId = tableRes.rows[0].id;
  }

  await clientOrPool.query(
    `UPDATE restaurant_tables SET status = 'OCCUPIED', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
    [tableId]
  );

  let sessionRes = await clientOrPool.query(
    `SELECT id FROM table_sessions
     WHERE restaurant_id = $1 AND table_id = $2 AND status = 'OPEN'
     ORDER BY started_at DESC LIMIT 1`,
    [restaurantId, tableId]
  );

  let tableSessionId: string;
  if (sessionRes.rows.length > 0) {
    tableSessionId = sessionRes.rows[0].id;
    if (partySize > 1) {
      await clientOrPool.query(
        `UPDATE table_sessions SET party_size = GREATEST(COALESCE(party_size, 1), $1), updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
        [partySize, tableSessionId]
      );
    }
  } else {
    const newSession = await clientOrPool.query(
      `INSERT INTO table_sessions (restaurant_id, table_id, party_size, status, started_at)
       VALUES ($1, $2, $3, 'OPEN', CURRENT_TIMESTAMP)
       RETURNING id`,
      [restaurantId, tableId, partySize || 1]
    );
    tableSessionId = newSession.rows[0].id;
  }

  return { tableId, tableSessionId };
}

export async function checkAndCloseTableSession(
  clientOrPool: any,
  restaurantId: string,
  tableNumber: string
) {
  if (!tableNumber || tableNumber.trim() === '') return;
  const cleanTableNum = tableNumber.trim();

  const tblRes = await clientOrPool.query(
    `SELECT id FROM restaurant_tables WHERE restaurant_id = $1 AND table_number = $2 LIMIT 1`,
    [restaurantId, cleanTableNum]
  );

  if (tblRes.rows.length === 0) return;
  const tableId = tblRes.rows[0].id;

  const activeCheck = await clientOrPool.query(
    `SELECT COUNT(*)::int as active_count
     FROM orders
     WHERE restaurant_id = $1
       AND (table_id = $2 OR table_number = $3)
       AND status NOT IN ('PAID', 'CANCELLED', 'EXPIRED')`,
    [restaurantId, tableId, cleanTableNum]
  );

  const activeCount = Number(activeCheck.rows[0]?.active_count || 0);

  if (activeCount === 0) {
    await clientOrPool.query(
      `UPDATE table_sessions
       SET status = 'CLOSED', ended_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE restaurant_id = $1 AND table_id = $2 AND status = 'OPEN'`,
      [restaurantId, tableId]
    );

    await clientOrPool.query(
      `UPDATE restaurant_tables
       SET status = 'AVAILABLE', updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [tableId]
    );
  }
}

export async function updateOrderStatus(restaurantId: string, id: string, status: string, tableNumber?: string) {
  let timestampSet = '';
  if (status === 'PENDING') timestampSet = ', pending_at = COALESCE(pending_at, CURRENT_TIMESTAMP)';
  else if (status === 'PREPARING') timestampSet = ', preparing_at = COALESCE(preparing_at, CURRENT_TIMESTAMP)';
  else if (status === 'READY') timestampSet = ', ready_at = COALESCE(ready_at, CURRENT_TIMESTAMP)';
  else if (status === 'PAID') timestampSet = ', paid_at = COALESCE(paid_at, CURRENT_TIMESTAMP), is_paid = true';

  // Check if tableNumber is assigned or updated
  let tableId: string | undefined = undefined;
  let tableSessionId: string | undefined = undefined;

  if (tableNumber && tableNumber.trim() !== '') {
    const sessionInfo = await findOrCreateTableSession(pool, restaurantId, tableNumber, 1);
    tableId = sessionInfo.tableId;
    tableSessionId = sessionInfo.tableSessionId;
  }

  const setTableFields = tableNumber && tableNumber.trim() !== ''
    ? `, table_number = $2, table_id = '${tableId}', table_session_id = '${tableSessionId}'`
    : `, table_number = COALESCE($2, table_number)`;

  const queryText = `
    UPDATE orders
    SET status = $1,
        updated_at = CURRENT_TIMESTAMP
        ${setTableFields}
        ${timestampSet}
    WHERE restaurant_id = $3 AND id = $4
    RETURNING *
  `;

  const res = await pool.query(queryText, [status, tableNumber ?? null, restaurantId, id]);
  const updatedOrder = res.rows[0] || null;

  // Re-evaluate table occupancy and close session if order is PAID, CANCELLED, or EXPIRED
  const activeTableNum = tableNumber || updatedOrder?.table_number;
  if (activeTableNum && (status === 'PAID' || status === 'CANCELLED' || status === 'EXPIRED')) {
    try {
      await checkAndCloseTableSession(pool, restaurantId, activeTableNum);
    } catch (tblErr) {
      console.error('Error re-evaluating table occupancy & session:', tblErr);
    }
  }

  return updatedOrder;
}

export async function completeOrderAndBill(restaurantId: string, id: string, status: string | undefined, isPaid: boolean | undefined, tableNumber?: string, paymentMethod?: string) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Fetch existing order to verify values
    const orderRes = await client.query(`
      SELECT is_paid, status, total_price, ticket_number FROM orders WHERE restaurant_id = $1 AND id = $2 FOR UPDATE
    `, [restaurantId, id]);
    
    if (orderRes.rows.length === 0) {
      throw new Error('Order not found');
    }
    
    const existing = orderRes.rows[0];
    const nextStatus = status || existing.status;
    const nextIsPaid = (typeof isPaid === 'boolean') ? isPaid : (nextStatus === 'PAID' ? true : existing.is_paid);
    
    // Update order
    const updateRes = await client.query(`
      UPDATE orders
      SET status = $1,
          is_paid = $2,
          table_number = COALESCE($3, table_number),
          payment_method = COALESCE($6, payment_method),
          updated_at = NOW()
      WHERE restaurant_id = $4 AND id = $5
      RETURNING id, status, table_number, updated_at, customer_name, phone, total_price, is_paid, notes, party_size, ticket_number, created_at, payment_method
    `, [nextStatus, nextIsPaid, tableNumber || null, restaurantId, id, paymentMethod || null]);
    
    const updatedOrder = updateRes.rows[0];
    
    // Process billing if order is now paid/completed (and wasn't paid before)
    if (nextIsPaid && !existing.is_paid) {
      const { BillingService } = await import('@/modules/billing/billing.service');
      await BillingService.processOrderBilling(client, restaurantId, id, Number(existing.total_price));
    }
    
    await client.query('COMMIT');

    // Re-evaluate table occupancy and close session if order is PAID, CANCELLED, or EXPIRED
    const activeTableNum = tableNumber || updatedOrder?.table_number;
    if (activeTableNum && (nextStatus === 'PAID' || nextStatus === 'CANCELLED' || nextStatus === 'EXPIRED')) {
      try {
        await checkAndCloseTableSession(pool, restaurantId, activeTableNum);
      } catch (tblErr) {
        console.error('Error re-evaluating table occupancy & session:', tblErr);
      }
    }

    return updatedOrder;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}


export async function updateOrderDetails(restaurantId: string, id: string, data: {
  customer_name?: string;
  phone?: string;
  notes?: string | null;
  party_size?: number;
  table_number?: string | null;
  items?: { product_id: string; quantity: number }[];
}) {
  const existingOrder = await getOrderById(restaurantId, id);
  if (!existingOrder) {
    throw new Error('Order not found');
  }

  let nextTotalPrice = Number(existingOrder.total_price || 0);

  if (Array.isArray(data.items)) {
    if (data.items.length === 0) {
      throw new Error('At least one item is required');
    }

    const normalizedMap = new Map<string, number>();
    for (const item of data.items) {
      const quantity = Number(item.quantity);
      if (!item.product_id || !Number.isInteger(quantity) || quantity <= 0) {
        throw new Error('Each order item must include a valid product and quantity');
      }
      normalizedMap.set(item.product_id, (normalizedMap.get(item.product_id) || 0) + quantity);
    }

    const nextItems = Array.from(normalizedMap.entries()).map(([product_id, quantity]) => ({ product_id, quantity }));

    const existingItemRows = await sql`
      SELECT product_id, quantity
      FROM order_items
      WHERE order_id = ${id}
    `;

    const currentQtyByProduct = new Map<string, number>();
    for (const row of existingItemRows) {
      currentQtyByProduct.set(row.product_id, (currentQtyByProduct.get(row.product_id) || 0) + Number(row.quantity));
    }

    const targetProductIds = nextItems.map((item) => item.product_id);
    const productRows = await sql`
      SELECT id, name, price, stock_quantity, buffer_quantity, is_active
      FROM products
      WHERE id = ANY(${targetProductIds})
    `;

    if (productRows.length !== targetProductIds.length) {
      throw new Error('One or more selected products do not exist');
    }

    const productById = new Map<string, {
      id: string;
      name: string;
      price: number;
      stock_quantity: number;
      buffer_quantity: number;
      is_active: boolean;
    }>();

    for (const row of productRows) {
      productById.set(row.id, {
        id: row.id,
        name: row.name,
        price: Number(row.price),
        stock_quantity: Number(row.stock_quantity),
        buffer_quantity: Number(row.buffer_quantity),
        is_active: Boolean(row.is_active),
      });
    }

    const unionProductIds = new Set<string>([
      ...Array.from(currentQtyByProduct.keys()),
      ...targetProductIds,
    ]);

    for (const productId of unionProductIds) {
      const previousQty = currentQtyByProduct.get(productId) || 0;
      const nextQty = normalizedMap.get(productId) || 0;
      const delta = nextQty - previousQty;
      if (delta <= 0) continue;

      const product = productById.get(productId);
      if (!product) {
        throw new Error('A selected product is invalid');
      }
      if (!product.is_active) {
        throw new Error(`${product.name} is no longer available.`);
      }
      if (product.stock_quantity < delta) {
        throw new Error(`Insufficient stock for ${product.name}. Need ${delta}, available ${product.stock_quantity}.`);
      }
    }

    for (const productId of unionProductIds) {
      const previousQty = currentQtyByProduct.get(productId) || 0;
      const nextQty = normalizedMap.get(productId) || 0;
      const delta = nextQty - previousQty;
      if (delta === 0) continue;

      const product = productById.get(productId);
      if (!product) continue;

      const newStock = product.stock_quantity - delta;
      let status = 'AVAILABLE';
      if (newStock <= 0) status = 'OUT_OF_STOCK';
      else if (newStock <= product.buffer_quantity) status = 'LOW_STOCK';

      await sql`
        UPDATE products
        SET stock_quantity = ${newStock},
            status = ${status},
            updated_at = NOW()
        WHERE id = ${productId}
      `;
    }

    await sql`DELETE FROM order_items WHERE order_id = ${id}`;

    const insertItems = nextItems.map((item) => {
      const product = productById.get(item.product_id);
      if (!product) {
        throw new Error('A selected product is invalid');
      }
      return {
        product_id: item.product_id,
        quantity: item.quantity,
        price_at_purchase: product.price,
      };
    });

    const productIds = insertItems.map((i) => i.product_id);
    const quantities = insertItems.map((i) => i.quantity);
    const prices = insertItems.map((i) => i.price_at_purchase);

    await sql`
      INSERT INTO order_items (order_id, product_id, quantity, price_at_purchase)
      SELECT ${id}, pid, qty, price
      FROM unnest(
        ${productIds}::uuid[],
        ${quantities}::int[],
        ${prices}::numeric[]
      ) AS t(pid, qty, price)
    `;

    nextTotalPrice = insertItems.reduce((acc, item) => acc + (item.price_at_purchase * item.quantity), 0);
    nextTotalPrice = Math.round(nextTotalPrice * 100) / 100;
  }

  const rows = await sql`
    UPDATE orders
    SET customer_name = COALESCE(${data.customer_name ?? null}, customer_name),
        phone = COALESCE(${data.phone ?? null}, phone),
        notes = COALESCE(${data.notes ?? null}, notes),
        party_size = COALESCE(${data.party_size ?? null}, party_size),
        table_number = COALESCE(${data.table_number ?? null}, table_number),
        total_price = ${nextTotalPrice},
        updated_at = NOW()
    WHERE restaurant_id = ${restaurantId} AND id = ${id}
    RETURNING *
  `;

  if (!rows[0]) {
    throw new Error('Order not found');
  }

  return await getOrderById(restaurantId, id);
}

export async function restoreOrderStock(orderId: string) {
  // 1. Get items of the order
  const items = await sql`
    SELECT product_id, quantity FROM order_items WHERE order_id = ${orderId}
  `;

  if (items.length === 0) return;

  // 2. Add quantities back and recompute status from the new stock value.
  const qtyByProduct = new Map<string, number>();
  for (const item of items) {
    const productId = String(item.product_id);
    const qty = Number(item.quantity);
    qtyByProduct.set(productId, (qtyByProduct.get(productId) || 0) + qty);
  }

  const productIds = Array.from(qtyByProduct.keys());
  const quantities = productIds.map((id) => qtyByProduct.get(id) || 0);

  await sql`
    UPDATE products p
    SET
      stock_quantity = p.stock_quantity + v.qty,
      status = CASE
        WHEN p.stock_quantity + v.qty <= 0 THEN 'OUT_OF_STOCK'
        WHEN p.stock_quantity + v.qty <= p.buffer_quantity THEN 'LOW_STOCK'
        ELSE 'AVAILABLE'
      END,
      updated_at = NOW()
    FROM (
      SELECT pid, SUM(qty)::int AS qty
      FROM unnest(
        ${productIds}::uuid[],
        ${quantities}::int[]
      ) AS t(pid, qty)
      GROUP BY pid
    ) AS v
    WHERE p.id = v.pid
  `;
}

export async function setOrderPaymentStatus(restaurantId: string, id: string, isPaid: boolean) {
  const rows = await sql`
    UPDATE orders SET is_paid = ${isPaid}, updated_at = NOW() WHERE restaurant_id = ${restaurantId} AND id = ${id} RETURNING *
  `;
  return rows[0];
}

export async function expireOldOrders() {
  // 1. Get IDs of orders to expire based on restaurant-specific business date
  const toExpire = await sql`
    SELECT o.id, o.restaurant_id 
    FROM orders o
    JOIN restaurants r ON r.id = o.restaurant_id
    WHERE o.status IN ('PENDING', 'PREPARING', 'READY')
      AND o.business_date < DATE((CURRENT_TIMESTAMP AT TIME ZONE COALESCE(r.timezone, 'Asia/Kolkata')) - COALESCE(r.rollover_time, '00:00:00')::interval)
  `;

  if (toExpire.length === 0) return { expiredCount: 0 };

  // 2. Cancel them and restore stock
  let expiredCount = 0;
  for (const row of toExpire) {
    try {
      await updateOrderStatus(row.restaurant_id, row.id, 'EXPIRED');
      await restoreOrderStock(row.id);
      expiredCount++;
    } catch (err) {
      console.error(`Failed to expire order ${row.id}:`, err);
    }
  }

  return { expiredCount };
}

// ============================================
// QUEUE QUERIES
// ============================================

export async function getQueueState(restaurantId: string) {
  const rows = await sql`SELECT * FROM queue_state WHERE restaurant_id = ${restaurantId}`;
  if (rows.length === 0) {
    const created = await sql`
      INSERT INTO queue_state (restaurant_id, current_queue_number, last_served_number)
      VALUES (${restaurantId}, 1, 0) RETURNING *
    `;
    return created[0];
  }
  return rows[0];
}

export async function advanceQueue(restaurantId: string) {
  const maxOrderRows = await sql`SELECT MAX(ticket_number) as max_ticket FROM orders JOIN restaurants r ON r.id = orders.restaurant_id WHERE orders.restaurant_id = `;
  const maxTicket = maxOrderRows[0]?.max_ticket || 0;

  const currentState = await sql`SELECT current_queue_number FROM queue_state WHERE restaurant_id = ${restaurantId}`;
  const currentNum = currentState[0]?.current_queue_number || 1;

  if (maxTicket >= 0 && currentNum > maxTicket) {
    throw new Error(`Queue is clear! Highest ticket in the system is #${maxTicket || 0}.`);
  }

  const rows = await sql`
    UPDATE queue_state 
    SET last_served_number = current_queue_number,
        current_queue_number = current_queue_number + 1,
        updated_at = NOW()
    WHERE restaurant_id = ${restaurantId}
    RETURNING *
  `;

  // Note: queue_history also needs restaurant_id if we want multi-tenant tracking. Assuming it has it or doesn't matter for now.
  try {
    await sql`
      INSERT INTO queue_history (restaurant_id, action, queue_number, details_json)
      VALUES (${restaurantId}, 'ADVANCE', ${rows[0].current_queue_number}, '{"source": "admin"}')
    `;
  } catch (e) {
    // fallback if queue_history doesn't have restaurant_id yet
  }
  return rows[0];
}

export async function setQueueNumber(restaurantId: string, number: number) {
  const rows = await sql`
    UPDATE queue_state 
    SET current_queue_number = ${number},
        updated_at = NOW()
    WHERE restaurant_id = ${restaurantId}
    RETURNING *
  `;
  await sql`
    INSERT INTO queue_history (action, queue_number, details_json)
    VALUES ('MANUAL_SET', ${number}, '{"source": "admin"}')
  `;
  return rows[0];
}

export async function getPendingQueueOrders() {
  const rows = await sql`
    SELECT o.*, s.name as staff_name, 
      json_agg(json_build_object('product_name', p.name, 'quantity', oi.quantity) ORDER BY oi.id) as items
    FROM orders o LEFT JOIN staffs s ON s.id = o.staff_id
    LEFT JOIN order_items oi ON oi.order_id = o.id
    LEFT JOIN products p ON p.id = oi.product_id
    WHERE o.status IN ('PENDING')
    GROUP BY o.id, s.name
    ORDER BY o.ticket_number ASC
  `;
  return rows;
}

// ============================================
// ANALYTICS QUERIES
// ============================================

export async function getDailyAnalytics(restaurantId: string, dateFrom: string, dateTo: string) {
  const rows = await sql`
    SELECT 
      business_date as date,
      COUNT(*) as total_orders,
      SUM(total_price) as revenue,
      AVG(EXTRACT(EPOCH FROM (updated_at - created_at))) as avg_wait_time,
      MODE() WITHIN GROUP (ORDER BY EXTRACT(HOUR FROM created_at)) as peak_hour
    FROM orders WHERE restaurant_id = ${restaurantId}
      AND business_date BETWEEN ${dateFrom} AND ${dateTo}
      AND is_paid = true AND status = 'PAID'
    GROUP BY business_date
    ORDER BY business_date ASC
  `;
  return rows;
}

export async function getPeakHours(restaurantId: string, dateFrom: string, dateTo: string) {
  const rows = await sql`
    SELECT 
      EXTRACT(HOUR FROM created_at) as hour,
      COUNT(*) as order_count,
      SUM(total_price) as revenue
    FROM orders WHERE restaurant_id = ${restaurantId}
      AND business_date BETWEEN ${dateFrom} AND ${dateTo}
      AND is_paid = true AND status = 'PAID'
    GROUP BY EXTRACT(HOUR FROM created_at)
    ORDER BY hour ASC
  `;
  return rows;
}

export async function getTopProducts(restaurantId: string, dateFrom: string, dateTo: string, limit = 10) {
  const rows = await sql`
    SELECT 
      p.id as product_id,
      p.name as product_name,
      p.category,
      p.price,
      p.image_url,
      SUM(oi.quantity) as total_quantity,
      SUM(oi.quantity * oi.price_at_purchase) as total_revenue
    FROM order_items oi
    JOIN products p ON p.id = oi.product_id
    JOIN orders o ON o.id = oi.order_id
    WHERE o.restaurant_id = ${restaurantId}
      AND o.business_date BETWEEN ${dateFrom} AND ${dateTo}
      AND o.is_paid = true AND o.status = 'PAID'
    GROUP BY p.id, p.name, p.category, p.price, p.image_url
    ORDER BY total_quantity DESC
    LIMIT ${limit}
  `;
  return rows;
}

export async function getDashboardStats(restaurantId: string) {
  const statsRows = await sql`
    SELECT 
      COALESCE(SUM(total_price) FILTER (WHERE business_date = (SELECT DATE((CURRENT_TIMESTAMP AT TIME ZONE timezone) - rollover_time::interval) FROM restaurants WHERE id = ${restaurantId}) AND is_paid = true AND status = 'PAID'), 0) as revenue_today,
      COUNT(*) FILTER (WHERE business_date = (SELECT DATE((CURRENT_TIMESTAMP AT TIME ZONE timezone) - rollover_time::interval) FROM restaurants WHERE id = ${restaurantId}) AND is_paid = true AND status = 'PAID') as orders_today,
      COALESCE(AVG(total_price) FILTER (WHERE business_date = (SELECT DATE((CURRENT_TIMESTAMP AT TIME ZONE timezone) - rollover_time::interval) FROM restaurants WHERE id = ${restaurantId}) AND is_paid = true AND status = 'PAID'), 0) as avg_order_value,
      COUNT(*) FILTER (WHERE status = 'PENDING') as pending_orders
    FROM orders WHERE restaurant_id = ${restaurantId}
  `;
  const stockRows = await sql`SELECT COUNT(*) as low_stock_items FROM products WHERE restaurant_id = ${restaurantId} AND status IN ('LOW_STOCK', 'OUT_OF_STOCK') AND is_active = true`;
  const queueRows = await sql`SELECT current_queue_number FROM queue_state WHERE restaurant_id = ${restaurantId}`;

  return {
    revenue_today: parseFloat(statsRows[0].revenue_today || '0'),
    orders_today: parseInt(statsRows[0].orders_today || '0'),
    avg_order_value: parseFloat(statsRows[0].avg_order_value || '0'),
    pending_orders: parseInt(statsRows[0].pending_orders || '0'),
    low_stock_items: parseInt(stockRows[0].low_stock_items || '0'),
    current_queue_number: queueRows[0]?.current_queue_number || 1,
    peak_hour: '1-2 PM',
  };
}

export async function getKitchenSnapshot(restaurantId: string) {
  const localTimezone = 'Asia/Kolkata';
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: localTimezone }).format(new Date());

  const rows = await sql`
    SELECT
      p.id as product_id,
      p.name as product_name,
      p.category,
      p.image_url,
      p.stock_quantity as current_stock,
      COALESCE(SUM(oi.quantity) FILTER (WHERE UPPER(o.status) = 'PENDING'), 0) as pending_qty,
      COALESCE(SUM(oi.quantity) FILTER (WHERE UPPER(o.status) = 'PREPARING'), 0) as preparing_qty
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    JOIN products p ON oi.product_id = p.id
    WHERE o.restaurant_id = ${restaurantId}
      AND o.business_date = ${today}::date
      AND UPPER(o.status) IN ('PENDING', 'PREPARING')
    GROUP BY p.id, p.name, p.category, p.image_url, p.stock_quantity
    ORDER BY p.name ASC
  `;
  return rows;
}

// ============================================
// CATEGORY QUERIES
// ============================================

export async function getCategories() {
  try {
    const rows = await sql`SELECT * FROM categories ORDER BY name ASC`;
    return rows;
  } catch (err) {
    console.warn('⚠️ categories table fetch failed, falling back to products table categories:', err);
    // Fallback: Get unique categories from products table to satisfy the UI
    const fallbackRows = await sql`
      SELECT DISTINCT TRIM(category) as name, MIN(id::text) as id 
      FROM products 
      WHERE category IS NOT NULL AND category != ''
      GROUP BY TRIM(category)
      ORDER BY name ASC
    `;
    return fallbackRows;
  }
}

export async function createCategory(name: string) {
  const rows = await sql`
    INSERT INTO categories (name) VALUES (${name})
    ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
    RETURNING *
  `;
  return rows[0];
}

// ============================================
// USER QUERIES
// ============================================

export async function getUserByPhone(phone: string) {
  const rows = await sql`SELECT * FROM users WHERE phone = ${phone} LIMIT 1`;
  return rows[0] || null;
}

export async function createUser(phone: string, name?: string) {
  const rows = await sql`
    INSERT INTO users (phone, name) VALUES (${phone}, ${name || null})
    ON CONFLICT (phone) DO UPDATE SET name = COALESCE(EXCLUDED.name, users.name)
    RETURNING *
  `;
  return rows[0];
}

export async function getUserByEmail(email: string) {
  const rows = await sql`SELECT * FROM users WHERE email = ${email} LIMIT 1`;
  return rows[0] || null;
}

// ============================================
// ADMIN QUERIES
// ============================================

export async function getAdminByEmail(email: string) {
  const rows = await sql`SELECT * FROM admins WHERE email = ${email} LIMIT 1`;
  return rows[0] || null;
}

// ============================================
// STAFF QUERIES
// ============================================

export async function getStaffs(restaurantId: string) {
  return await sql`SELECT id, name, email, phone, role, is_active, created_at, updated_at FROM staffs WHERE restaurant_id = ${restaurantId} ORDER BY created_at DESC`;
}

export async function getStaffByEmail(email: string) {
  const rows = await sql`SELECT * FROM staffs WHERE email = ${email} LIMIT 1`;
  return rows[0] || null;
}

export async function getStaffById(restaurantId: string, id: string) {
  const rows = await sql`SELECT * FROM staffs WHERE restaurant_id = ${restaurantId} AND id = ${id} LIMIT 1`;
  return rows[0] || null;
}

export async function createStaff(restaurantId: string, data: { name: string; email: string; phone?: string; password?: string; role?: string; is_active?: boolean }) {
  // Limit staff creation per restaurant
  const limit = 10;
  const countRows = await sql`SELECT COUNT(*)::integer as count FROM staffs WHERE restaurant_id = ${restaurantId}`;
  if (countRows[0].count >= limit) {
    throw new Error(`Staff limit reached (max ${limit} staff members per restaurant)`);
  }

  const rows = await sql`
    INSERT INTO staffs (restaurant_id, name, email, phone, password, role, is_active) 
    VALUES (${restaurantId}, ${data.name}, ${data.email}, ${data.phone || null}, ${data.password || null}, ${data.role || 'STAFF'}, ${data.is_active !== false}) 
    RETURNING id, name, email, phone, role, is_active
  `;
  return rows[0];
}

export async function updateStaff(restaurantId: string, id: string, data: Partial<{ name: string; email: string; phone: string; password?: string; role: string; is_active: boolean }>) {
  const rows = await sql`
    UPDATE staffs SET
      name = COALESCE(${data.name ?? null}, name),
      email = COALESCE(${data.email ?? null}, email),
      phone = COALESCE(${data.phone ?? null}, phone),
      password = COALESCE(${data.password ?? null}, password),
      role = COALESCE(${data.role ?? null}, role),
      is_active = COALESCE(${data.is_active ?? null}, is_active),
      updated_at = NOW()
    WHERE restaurant_id = ${restaurantId} AND id = ${id}
    RETURNING id, name, email, phone, role, is_active
  `;
  return rows[0];
}

export async function deleteStaff(restaurantId: string, id: string) {
  await sql`DELETE FROM staffs WHERE restaurant_id = ${restaurantId} AND id = ${id}`;
}

// ============================================
// OTP BILLING QUERIES
// ============================================

export async function incrementOtpCount(phone: string, restaurantId?: string) {
  const localTimezone = 'Asia/Kolkata';
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: localTimezone }).format(new Date());

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Ensure tables exist and are properly migrated before inserting (safety net for un-migrated databases)
    await client.query(`
      CREATE TABLE IF NOT EXISTS otp_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
        phone TEXT NOT NULL,
        sent_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        status TEXT DEFAULT 'SENT',
        business_date DATE DEFAULT CURRENT_DATE
      )
    `);

    await client.query(`ALTER TABLE otp_logs ADD COLUMN IF NOT EXISTS business_date DATE DEFAULT CURRENT_DATE`);
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS daily_otp_stats (
        date DATE PRIMARY KEY,
        count INTEGER DEFAULT 0,
        cost NUMERIC(10, 2) DEFAULT 0.00,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Migration logic: Ensure correct constraints for multi-tenant daily_otp_stats
    await client.query(`ALTER TABLE daily_otp_stats DROP CONSTRAINT IF EXISTS daily_otp_stats_pkey CASCADE`);
    await client.query(`ALTER TABLE daily_otp_stats ADD COLUMN IF NOT EXISTS id SERIAL PRIMARY KEY`);
    await client.query(`ALTER TABLE daily_otp_stats ADD COLUMN IF NOT EXISTS restaurant_id UUID`);
    
    // Add unique constraint if it doesn't exist
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'unique_date_restaurant'
        ) THEN
          ALTER TABLE daily_otp_stats ADD CONSTRAINT unique_date_restaurant UNIQUE (date, restaurant_id);
        END IF;
      END $$;
    `);

    let businessDateQuery = 'CURRENT_DATE';
    if (restaurantId) {
      businessDateQuery = '(SELECT DATE((CURRENT_TIMESTAMP AT TIME ZONE timezone) - rollover_time::interval) FROM restaurants WHERE id = $3)';
    }

    // 1. Log the specific OTP request
    const logRes = await client.query(`
      INSERT INTO otp_logs (phone, sent_at, restaurant_id, business_date)
      VALUES ($1, NOW() AT TIME ZONE $2, $3, ${businessDateQuery})
      RETURNING id, business_date
    `, [phone, localTimezone, restaurantId || null]);

    const logId = logRes.rows[0].id;
    const businessDate = logRes.rows[0].business_date;

    // 2. Increment daily aggregation (Concurrency Safe via ON CONFLICT)
    if (restaurantId) {
      // Use the named constraint 'unique_date_restaurant' or fallback to implicit if created manually elsewhere
      // Actually, standard PG ON CONFLICT (date, restaurant_id) works as long as the unique constraint exists.
      await client.query(`
        INSERT INTO daily_otp_stats (date, count, cost, restaurant_id)
        VALUES ($1::date, 1, 0.50, $2)
        ON CONFLICT (date, restaurant_id) DO UPDATE 
        SET count = daily_otp_stats.count + 1,
            cost = (daily_otp_stats.count + 1) * 0.50,
            updated_at = NOW()
      `, [businessDate, restaurantId]);

      // 3. Trigger billing transaction inside the same DB transaction
      try {
        const { BillingService } = await import('@/modules/billing/billing.service');
        await BillingService.processOTPBilling(client, restaurantId, logId);
      } catch (billingErr) {
        console.error("❌ Billing processing failed for OTP:", billingErr);
      }
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}


export async function getOtpStats(dateFrom: string, dateTo: string, restaurantId?: string) {
  if (restaurantId) {
    return await sql`
      SELECT * FROM daily_otp_stats 
      WHERE date BETWEEN ${dateFrom}::date AND ${dateTo}::date
        AND restaurant_id = ${restaurantId}
      ORDER BY date ASC
    `;
  }
  return await sql`
    SELECT * FROM daily_otp_stats 
    WHERE date BETWEEN ${dateFrom}::date AND ${dateTo}::date
      AND restaurant_id IS NULL
    ORDER BY date ASC
  `;
}

export async function autoCloseRestaurants() {
  const client = await pool.connect();
  try {
    await client.query(`ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS last_auto_closed_date DATE`);
    
    const result = await client.query(`
      UPDATE restaurants 
      SET is_service_active = false,
          last_auto_closed_date = DATE((CURRENT_TIMESTAMP AT TIME ZONE COALESCE(timezone, 'Asia/Kolkata')) - COALESCE(rollover_time, '00:00:00')::interval)
      WHERE 
        is_service_active = true 
        AND (
          last_auto_closed_date IS NULL OR 
          last_auto_closed_date < DATE((CURRENT_TIMESTAMP AT TIME ZONE COALESCE(timezone, 'Asia/Kolkata')) - COALESCE(rollover_time, '00:00:00')::interval)
        )
      RETURNING id
    `);
    
    return { closedCount: result.rowCount };
  } catch (err) {
    console.error('Failed to auto-close restaurants:', err);
    return { closedCount: 0 };
  } finally {
    client.release();
  }
}

