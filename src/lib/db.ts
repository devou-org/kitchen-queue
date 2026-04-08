import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

export default sql;

// ============================================
// PRODUCT QUERIES
// ============================================

export async function getProducts(activeOnly = true) {
  const rows = await sql`
    SELECT * FROM products 
    WHERE is_active = ${activeOnly}
    ORDER BY created_at DESC
  `;
  return rows;
}

export async function getProductById(id: string) {
  const rows = await sql`
    SELECT * FROM products WHERE id = ${id} LIMIT 1
  `;
  return rows[0] || null;
}

export async function createProduct(data: {
  name: string;
  description: string;
  price: number;
  image_url: string;
  stock_quantity: number;
  buffer_quantity: number;
  status: string;
  category: string;
}) {
  const rows = await sql`
    INSERT INTO products (name, description, price, image_url, stock_quantity, buffer_quantity, status, category)
    VALUES (${data.name}, ${data.description}, ${data.price}, ${data.image_url}, 
            ${data.stock_quantity}, ${data.buffer_quantity}, ${data.status}, ${data.category})
    RETURNING *
  `;
  return rows[0];
}

export async function updateProduct(id: string, data: Partial<{
  name: string;
  description: string;
  price: number;
  image_url: string;
  stock_quantity: number;
  buffer_quantity: number;
  status: string;
  category: string;
  is_active: boolean;
}>) {
  const rows = await sql`
    UPDATE products SET
      name = COALESCE(${data.name ?? null}, name),
      description = COALESCE(${data.description ?? null}, description),
      price = COALESCE(${data.price ?? null}, price),
      image_url = COALESCE(${data.image_url ?? null}, image_url),
      stock_quantity = COALESCE(${data.stock_quantity ?? null}, stock_quantity),
      buffer_quantity = COALESCE(${data.buffer_quantity ?? null}, buffer_quantity),
      status = COALESCE(${data.status ?? null}, status),
      category = COALESCE(${data.category ?? null}, category),
      is_active = COALESCE(${data.is_active ?? null}, is_active),
      updated_at = NOW()
    WHERE id = ${id}
    RETURNING *
  `;
  return rows[0];
}

export async function softDeleteProduct(id: string) {
  await sql`UPDATE products SET is_active = false, updated_at = NOW() WHERE id = ${id}`;
}

// ============================================
// ORDER QUERIES - OPTIMIZED
// ============================================

/**
 * OPTIMIZED: Consolidated 4 separate queries into 1 unified query with conditional WHERE clause
 * Uses JOIN + GROUP BY instead of correlated subqueries (eliminates N+1 issue)
 * Properly handles NULL values in JSON aggregation
 */
export async function getOrders(filters: {
  status?: string;
  status_in?: string;
  date_from?: string;
  date_to?: string;
  phone?: string;
  search?: string;
  sort?: 'ASC' | 'DESC';
  page?: number;
  per_page?: number;
} = {}) {
  const { page = 1, per_page = 50, sort = 'ASC' } = filters;
  const offset = (page - 1) * per_page;

  const sortDir = sort === 'DESC' ? 'DESC' : 'ASC';

  // Handle status_in (comma-separated values)
  const statuses = filters.status_in ? filters.status_in.split(',').map(s => s.trim()) : [];

  return await sql`
    SELECT 
      o.id, o.customer_name, o.phone, o.total_price, o.status, 
      o.is_paid, o.notes, o.party_size, o.ticket_number, o.created_at, o.updated_at,
      COALESCE(
        json_agg(
          json_build_object(
            'id', oi.id, 
            'product_id', oi.product_id, 
            'quantity', oi.quantity, 
            'price_at_purchase', oi.price_at_purchase, 
            'product_name', p.name
          ) ORDER BY oi.id
        ) FILTER (WHERE oi.id IS NOT NULL), 
        '[]'::json
      ) as items
    FROM orders o
    LEFT JOIN order_items oi ON oi.order_id = o.id
    LEFT JOIN products p ON p.id = oi.product_id
    WHERE 
      (${filters.status || null}::text IS NULL OR o.status = ${filters.status})
      AND (${statuses.length === 0 ? null : statuses}::text[] IS NULL OR o.status = ANY(${statuses}::text[]))
      AND (${filters.date_from || null}::text IS NULL OR o.created_at >= (${filters.date_from || '1970-01-01'}::text || ' 00:00:00')::timestamp)
      AND (${filters.date_to || null}::text IS NULL OR o.created_at <= (${filters.date_to || '2099-12-31'}::text || ' 23:59:59')::timestamp)
    GROUP BY o.id
    ORDER BY 
      CASE WHEN ${sortDir} = 'ASC' THEN o.created_at END ASC,
      CASE WHEN ${sortDir} = 'DESC' THEN o.created_at END DESC
    LIMIT ${per_page} OFFSET ${offset}
  `;
}

export async function getOrderById(id: string) {
  const rows = await sql`
    SELECT o.*, 
      COALESCE(
        json_agg(
          json_build_object(
            'id', oi.id, 
            'product_id', oi.product_id, 
            'quantity', oi.quantity, 
            'price_at_purchase', oi.price_at_purchase,
            'product_name', p.name,
            'product_image', p.image_url
          ) ORDER BY oi.id
        ) FILTER (WHERE oi.id IS NOT NULL),
        '[]'::json
      ) as items
    FROM orders o
    LEFT JOIN order_items oi ON oi.order_id = o.id
    LEFT JOIN products p ON p.id = oi.product_id
    WHERE o.id = ${id}
    GROUP BY o.id
    LIMIT 1
  `;
  return rows[0] || null;
}

/**
 * OPTIMIZED: Removed CTE with window functions
 */
export async function getOrderByTicket(ticket_number: number) {
  const rows = await sql`
    SELECT o.*, 
      COALESCE(
        (
          SELECT COUNT(*) + 1 
          FROM orders pending 
          WHERE pending.status = 'PENDING' 
            AND pending.ticket_number < o.ticket_number
        ),
        0
      )::integer as queue_position,
      COALESCE(
        json_agg(
          json_build_object(
            'id', oi.id, 
            'product_id', oi.product_id,
            'quantity', oi.quantity, 
            'price_at_purchase', oi.price_at_purchase,
            'product_name', p.name,
            'product_image', p.image_url
          ) ORDER BY oi.id
        ) FILTER (WHERE oi.id IS NOT NULL),
        '[]'::json
      ) as items
    FROM orders o
    LEFT JOIN order_items oi ON oi.order_id = o.id
    LEFT JOIN products p ON p.id = oi.product_id
    WHERE o.ticket_number = ${ticket_number}
    GROUP BY o.id
    ORDER BY o.created_at DESC
    LIMIT 1
  `;
  return rows[0] || null;
}

/**
 * OPTIMIZED: Removed CTE, simplified queue position calculation
 */
export async function getOrdersByPhone(phone: string) {
  const rows = await sql`
    SELECT o.*, 
      COALESCE(
        (
          SELECT COUNT(*) + 1 
          FROM orders pending 
          WHERE pending.status = 'PENDING' 
            AND pending.ticket_number < o.ticket_number
        ),
        0
      )::integer as queue_position,
      COALESCE(
        json_agg(
          json_build_object(
            'id', oi.id, 
            'product_id', oi.product_id,
            'quantity', oi.quantity, 
            'price_at_purchase', oi.price_at_purchase,
            'product_name', p.name
          ) ORDER BY oi.id
        ) FILTER (WHERE oi.id IS NOT NULL),
        '[]'::json
      ) as items
    FROM orders o
    LEFT JOIN order_items oi ON oi.order_id = o.id
    LEFT JOIN products p ON p.id = oi.product_id
    WHERE o.phone = ${phone}
    GROUP BY o.id
    ORDER BY o.created_at DESC
    LIMIT 20
  `;
  return rows;
}

/**
 * OPTIMIZED: Batch operations instead of loops
 */
export async function createOrder(data: {
  customer_name: string;
  phone: string;
  total_price: number;
  notes?: string;
  party_size?: number;
  items: { product_id: string; quantity: number; price_at_purchase: number }[];
}) {
  // Validate on app layer (no DB call)
  if (data.items.length === 0) {
    throw new Error('Order must have at least one item');
  }

  // SINGLE TRANSACTION: Everything happens in ONE database call
  const rows = await sql`
    WITH product_validation AS (
      -- Validate products exist and have stock
      SELECT 
        p.id,
        items.qty as order_qty,
        CASE 
          WHEN p.stock_quantity < items.qty THEN 'INSUFFICIENT_STOCK'
          ELSE 'OK'
        END as validation_status
      FROM products p
      INNER JOIN (
        SELECT 
          unnest(${data.items.map(i => i.product_id)}::uuid[]) as product_id,
          unnest(${data.items.map(i => i.quantity)}::int[]) as qty
      ) items ON p.id = items.product_id
    ),
    validation_check AS (
      SELECT 
        CASE 
          WHEN (SELECT COUNT(*) FROM product_validation) != ${data.items.length} THEN 'MISSING_PRODUCTS'
          WHEN EXISTS (SELECT 1 FROM product_validation WHERE validation_status = 'INSUFFICIENT_STOCK') THEN 'INSUFFICIENT_STOCK'
          ELSE 'OK'
        END as status
    ),
    ensure_user AS (
      INSERT INTO users (phone, name)
      VALUES (${data.phone}, ${data.customer_name})
      ON CONFLICT (phone) DO UPDATE SET name = EXCLUDED.name
      RETURNING phone
    ),
    create_order AS (
      INSERT INTO orders (customer_name, phone, total_price, status, is_paid, notes, party_size)
      SELECT ${data.customer_name}, ${data.phone}, ${data.total_price}, 'PENDING', false, ${data.notes || null}, ${data.party_size || 1}
      FROM validation_check
      WHERE validation_check.status = 'OK'
      RETURNING id, customer_name, phone, total_price, status, is_paid, notes, party_size, ticket_number, created_at, updated_at
    ),
    insert_items AS (
      INSERT INTO order_items (order_id, product_id, quantity, price_at_purchase)
      SELECT 
        (SELECT id FROM create_order),
        item.product_id,
        item.quantity,
        item.price_at_purchase
      FROM UNNEST(
        ${data.items.map(i => i.product_id)}::uuid[],
        ${data.items.map(i => i.quantity)}::int[],
        ${data.items.map(i => i.price_at_purchase)}::numeric[]
      ) AS item(product_id, quantity, price_at_purchase)
      WHERE EXISTS (SELECT 1 FROM create_order)
      RETURNING *
    ),
    update_stock AS (
      UPDATE products
      SET stock_quantity = stock_quantity - item_sums.qty,
          updated_at = NOW()
      FROM (
        SELECT 
          product_id,
          SUM(quantity) as qty
        FROM insert_items
        GROUP BY product_id
      ) AS item_sums
      WHERE products.id = item_sums.product_id
      RETURNING *
    )
    SELECT 
      o.*,
      COALESCE(
        (
          SELECT json_agg(
            json_build_object(
              'id', items_agg.id, 
              'product_id', items_agg.product_id, 
              'quantity', items_agg.quantity, 
              'price_at_purchase', items_agg.price_at_purchase, 
              'product_name', p.name
            ) ORDER BY items_agg.id
          )
          FROM insert_items items_agg
          LEFT JOIN products p ON p.id = items_agg.product_id
          WHERE items_agg.order_id = o.id
        ),
        '[]'::json
      ) as items
    FROM create_order o
  `;

  if (!rows[0]) throw new Error('Order creation failed (possibly insufficient stock)');
  return rows[0];
}

export async function updateOrderStatus(id: string, status: string) {
  const rows = await sql`
    UPDATE orders 
    SET status = ${status}, 
        updated_at = NOW()
    WHERE id = ${id} 
    RETURNING *
  `;
  return rows[0];
}

export async function setOrderPaymentStatus(id: string, isPaid: boolean) {
  const rows = await sql`
    UPDATE orders SET is_paid = ${isPaid}, updated_at = NOW() WHERE id = ${id} RETURNING *
  `;
  return rows[0];
}

// ============================================
// QUEUE QUERIES
// ============================================

export async function getQueueState() {
  const rows = await sql`SELECT * FROM queue_state WHERE id = 1`;
  if (rows.length === 0) {
    const created = await sql`
      INSERT INTO queue_state (id, current_queue_number, last_served_number)
      VALUES (1, 1, 0) RETURNING *
    `;
    return created[0];
  }
  return rows[0];
}

export async function advanceQueue() {
  const maxOrderRows = await sql`SELECT MAX(ticket_number) as max_ticket FROM orders`;
  const maxTicket = maxOrderRows[0]?.max_ticket || 0;

  const currentState = await sql`SELECT current_queue_number FROM queue_state WHERE id = 1`;
  const currentNum = currentState[0]?.current_queue_number || 1;

  if (maxTicket >= 0 && currentNum > maxTicket) {
    throw new Error(`Queue is clear! Highest ticket in the system is #${maxTicket || 0}.`);
  }

  const rows = await sql`
    UPDATE queue_state 
    SET last_served_number = current_queue_number,
        current_queue_number = current_queue_number + 1,
        updated_at = NOW()
    WHERE id = 1
    RETURNING *
  `;

  await sql`
    INSERT INTO queue_history (action, queue_number, details_json)
    VALUES ('ADVANCE', ${rows[0].current_queue_number}, '{"source": "admin"}')
  `;
  return rows[0];
}

export async function setQueueNumber(number: number) {
  const rows = await sql`
    UPDATE queue_state 
    SET current_queue_number = ${number},
        updated_at = NOW()
    WHERE id = 1
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
    SELECT o.*, 
      COALESCE(
        json_agg(
          json_build_object('product_name', p.name, 'quantity', oi.quantity) 
          ORDER BY oi.id
        ) FILTER (WHERE oi.id IS NOT NULL),
        '[]'::json
      ) as items
    FROM orders o
    LEFT JOIN order_items oi ON oi.order_id = o.id
    LEFT JOIN products p ON p.id = oi.product_id
    WHERE o.status IN ('PENDING')
    GROUP BY o.id
    ORDER BY o.ticket_number ASC
  `;
  return rows;
}

// ============================================
// ANALYTICS QUERIES - OPTIMIZED
// ============================================

export async function getDailyAnalytics(dateFrom: string, dateTo: string) {
  const fromDate = new Date(dateFrom).toISOString().split('T')[0];
  const toDate = new Date(dateTo).toISOString().split('T')[0];

  const rows = await sql`
    SELECT 
      DATE(o.created_at) as date,
      COUNT(*) FILTER (WHERE o.status != 'CANCELLED') as total_orders,
      COALESCE(
        SUM(o.total_price) FILTER (WHERE o.status != 'CANCELLED'), 
        0
      )::numeric as revenue,
      COALESCE(
        AVG(
          EXTRACT(EPOCH FROM (COALESCE(o.completed_at, o.updated_at) - o.created_at))
        ) FILTER (WHERE o.status != 'CANCELLED'), 
        0
      )::numeric as avg_wait_time,
      (
        SELECT EXTRACT(HOUR FROM created_at)::integer
        FROM orders sub
        WHERE DATE(sub.created_at) = DATE(o.created_at)
          AND sub.status != 'CANCELLED'
        GROUP BY EXTRACT(HOUR FROM created_at)
        ORDER BY COUNT(*) DESC
        LIMIT 1
      ) as peak_hour
    FROM orders o
    WHERE DATE(o.created_at) >= ${fromDate}::date
      AND DATE(o.created_at) <= ${toDate}::date
    GROUP BY DATE(o.created_at)
    ORDER BY date ASC
  `;
  return rows;
}

export async function getPeakHours(dateFrom: string, dateTo: string) {
  const rows = await sql`
    SELECT 
      EXTRACT(HOUR FROM created_at)::integer as hour,
      COUNT(*) as order_count,
      SUM(total_price)::numeric as revenue
    FROM orders
    WHERE created_at >= ${dateFrom}::date
      AND created_at < (${dateTo}::date + interval '1 day')
      AND status != 'CANCELLED'
    GROUP BY EXTRACT(HOUR FROM created_at)
    ORDER BY hour ASC
  `;
  return rows;
}

export async function getTopProducts(dateFrom: string, dateTo: string, limit = 10) {
  const rows = await sql`
    SELECT 
      p.id as product_id,
      p.name,
      SUM(oi.quantity) as total_units,
      SUM(oi.quantity * oi.price_at_purchase)::numeric as revenue
    FROM order_items oi
    JOIN products p ON p.id = oi.product_id
    JOIN orders o ON o.id = oi.order_id
    WHERE DATE(o.created_at) >= ${dateFrom}::date
      AND DATE(o.created_at) <= ${dateTo}::date
      AND o.status != 'CANCELLED'
    GROUP BY p.id, p.name
    ORDER BY total_units DESC
    LIMIT ${limit}
  `;
  return rows;
}

export async function getDashboardStats() {
  const today = new Date().toISOString().split('T')[0];

  const statsRows = await sql`
    SELECT 
      COALESCE(
        SUM(total_price) FILTER (
          WHERE DATE(created_at) = ${today}::date 
            AND status != 'CANCELLED' 
            AND is_paid = true
        ), 
        0
      )::numeric as revenue_today,
      COUNT(*) FILTER (
        WHERE DATE(created_at) = ${today}::date 
          AND status != 'CANCELLED'
      ) as orders_today,
      COALESCE(
        AVG(total_price) FILTER (
          WHERE DATE(created_at) = ${today}::date 
            AND status != 'CANCELLED' 
            AND is_paid = true
        ), 
        0
      )::numeric as avg_order_value,
      COUNT(*) FILTER (WHERE status = 'PENDING') as pending_orders
    FROM orders
  `;

  const stockRows = await sql`
    SELECT COUNT(*) as low_stock_items 
    FROM products 
    WHERE status IN ('LOW_STOCK', 'OUT_OF_STOCK') 
      AND is_active = true
  `;

  const queueRows = await sql`
    SELECT current_queue_number FROM queue_state WHERE id = 1
  `;

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

// ============================================
// CATEGORY QUERIES
// ============================================

export async function getCategories() {
  const rows = await sql`
    SELECT * FROM categories 
    ORDER BY name ASC
  `;
  return rows;
}

export async function createCategory(name: string) {
  const rows = await sql`
    INSERT INTO categories (name)
    VALUES (${name})
    ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
    RETURNING *
  `;
  return rows[0];
}

export async function deleteCategory(id: string) {
  await sql`DELETE FROM categories WHERE id = ${id}`;
}

// ============================================
// USER QUERIES
// ============================================

export async function getUserByPhone(phone: string) {
  const rows = await sql`SELECT * FROM users WHERE phone = ${phone} LIMIT 1`;
  return rows[0] || null;
}

export async function getUserByName(name: string) {
  const rows = await sql`SELECT * FROM users WHERE name = ${name} ORDER BY created_at DESC LIMIT 1`;
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