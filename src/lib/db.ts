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
// ORDER QUERIES
// ============================================

export async function getOrders(filters: {
  status?: string;
  date_from?: string;
  date_to?: string;
  phone?: string;
  search?: string;
  page?: number;
  per_page?: number;
} = {}) {
  const { page = 1, per_page = 50 } = filters;
  const offset = (page - 1) * per_page;

  let rows;
  if (filters.status && filters.phone) {
    rows = await sql`
      SELECT o.*, json_agg(json_build_object('id', oi.id, 'product_id', oi.product_id, 'quantity', oi.quantity, 'price_at_purchase', oi.price_at_purchase, 'product_name', p.name) ORDER BY oi.id) as items
      FROM orders o
      LEFT JOIN order_items oi ON oi.order_id = o.id
      LEFT JOIN products p ON p.id = oi.product_id
      WHERE o.status = ${filters.status} AND o.phone ILIKE ${'%' + filters.phone + '%'}
      GROUP BY o.id ORDER BY o.created_at DESC LIMIT ${per_page} OFFSET ${offset}
    `;
  } else if (filters.status) {
    rows = await sql`
      SELECT o.*, json_agg(json_build_object('id', oi.id, 'product_id', oi.product_id, 'quantity', oi.quantity, 'price_at_purchase', oi.price_at_purchase, 'product_name', p.name) ORDER BY oi.id) as items
      FROM orders o
      LEFT JOIN order_items oi ON oi.order_id = o.id
      LEFT JOIN products p ON p.id = oi.product_id
      WHERE o.status = ${filters.status}
      GROUP BY o.id ORDER BY o.created_at DESC LIMIT ${per_page} OFFSET ${offset}
    `;
  } else {
    rows = await sql`
      SELECT o.*, json_agg(json_build_object('id', oi.id, 'product_id', oi.product_id, 'quantity', oi.quantity, 'price_at_purchase', oi.price_at_purchase, 'product_name', p.name) ORDER BY oi.id) as items
      FROM orders o
      LEFT JOIN order_items oi ON oi.order_id = o.id
      LEFT JOIN products p ON p.id = oi.product_id
      GROUP BY o.id ORDER BY o.created_at DESC LIMIT ${per_page} OFFSET ${offset}
    `;
  }
  return rows;
}

export async function getOrderById(id: string) {
  const rows = await sql`
    SELECT o.*, 
      json_agg(json_build_object(
        'id', oi.id, 
        'product_id', oi.product_id, 
        'quantity', oi.quantity, 
        'price_at_purchase', oi.price_at_purchase,
        'product_name', p.name,
        'product_image', p.image_url
      ) ORDER BY oi.id) as items
    FROM orders o
    LEFT JOIN order_items oi ON oi.order_id = o.id
    LEFT JOIN products p ON p.id = oi.product_id
    WHERE o.id = ${id}
    GROUP BY o.id
    LIMIT 1
  `;
  return rows[0] || null;
}

export async function getOrderByTicket(ticket_number: number) {
  const rows = await sql`
    WITH active_ranks AS (
      SELECT id, RANK() OVER (ORDER BY ticket_number ASC) as pos
      FROM orders 
      WHERE status IN ('PENDING', 'PREPARING')
    )
    SELECT o.*, 
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
    LEFT JOIN active_ranks ar ON ar.id = o.id
    LEFT JOIN order_items oi ON oi.order_id = o.id
    LEFT JOIN products p ON p.id = oi.product_id
    WHERE o.ticket_number = ${ticket_number}
    GROUP BY o.id, ar.pos
    LIMIT 1
  `;
  return rows[0] || null;
}

export async function getOrdersByPhone(phone: string) {
  const rows = await sql`
    WITH active_ranks AS (
      SELECT id, RANK() OVER (ORDER BY ticket_number ASC) as pos
      FROM orders 
      WHERE status IN ('PENDING', 'PREPARING')
    )
    SELECT o.*, 
      COALESCE(ar.pos, 0) as queue_position,
      json_agg(json_build_object(
        'id', oi.id, 
        'product_id', oi.product_id,
        'quantity', oi.quantity, 
        'price_at_purchase', oi.price_at_purchase,
        'product_name', p.name
      ) ORDER BY oi.id) as items
    FROM orders o
    LEFT JOIN active_ranks ar ON ar.id = o.id
    LEFT JOIN order_items oi ON oi.order_id = o.id
    LEFT JOIN products p ON p.id = oi.product_id
    WHERE o.phone = ${phone}
    GROUP BY o.id, ar.pos
    ORDER BY o.created_at DESC
    LIMIT 20
  `;
  return rows;
}

export async function createOrder(data: {
  customer_name: string;
  phone: string;
  total_price: number;
  notes?: string;
  party_size?: number;
  items: { product_id: string; quantity: number; price_at_purchase: number }[];
}) {
  const orderRows = await sql`
    INSERT INTO orders (customer_name, phone, total_price, status, is_paid, notes, party_size)
    VALUES (${data.customer_name}, ${data.phone}, ${data.total_price}, 'PENDING', false, ${data.notes || null}, ${data.party_size || 1})
    RETURNING *
  `;
  const order = orderRows[0];

  for (const item of data.items) {
    await sql`
      INSERT INTO order_items (order_id, product_id, quantity, price_at_purchase)
      VALUES (${order.id}, ${item.product_id}, ${item.quantity}, ${item.price_at_purchase})
    `;
    // Reduce stock
    await sql`
      UPDATE products 
      SET stock_quantity = stock_quantity - ${item.quantity},
          updated_at = NOW()
      WHERE id = ${item.product_id}
    `;
    // Auto-update status
    await sql`
      UPDATE products 
      SET status = CASE 
        WHEN stock_quantity - ${item.quantity} <= 0 THEN 'OUT_OF_STOCK'
        WHEN stock_quantity - ${item.quantity} <= buffer_quantity THEN 'LOW_STOCK'
        ELSE 'AVAILABLE'
      END,
      updated_at = NOW()
      WHERE id = ${item.product_id}
    `;
  }

  return await getOrderById(order.id);
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
      json_agg(json_build_object('product_name', p.name, 'quantity', oi.quantity) ORDER BY oi.id) as items
    FROM orders o
    LEFT JOIN order_items oi ON oi.order_id = o.id
    LEFT JOIN products p ON p.id = oi.product_id
    WHERE o.status IN ('PENDING', 'PREPARING')
    GROUP BY o.id
    ORDER BY o.ticket_number ASC
  `;
  return rows;
}

// ============================================
// ANALYTICS QUERIES
// ============================================

export async function getDailyAnalytics(dateFrom: string, dateTo: string) {
  const rows = await sql`
    SELECT 
      DATE(created_at) as date,
      COUNT(*) as total_orders,
      SUM(total_price) as revenue,
      AVG(EXTRACT(EPOCH FROM (COALESCE(completed_at, updated_at) - created_at))) as avg_wait_time,
      MODE() WITHIN GROUP (ORDER BY EXTRACT(HOUR FROM created_at)) as peak_hour
    FROM orders
    WHERE DATE(created_at) BETWEEN ${dateFrom} AND ${dateTo}
      AND status != 'CANCELLED'
    GROUP BY DATE(created_at)
    ORDER BY date ASC
  `;
  return rows;
}

export async function getPeakHours(dateFrom: string, dateTo: string) {
  const rows = await sql`
    SELECT 
      EXTRACT(HOUR FROM created_at) as hour,
      COUNT(*) as order_count,
      SUM(total_price) as revenue
    FROM orders
    WHERE DATE(created_at) BETWEEN ${dateFrom} AND ${dateTo}
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
      SUM(oi.quantity * oi.price_at_purchase) as revenue
    FROM order_items oi
    JOIN products p ON p.id = oi.product_id
    JOIN orders o ON o.id = oi.order_id
    WHERE DATE(o.created_at) BETWEEN ${dateFrom} AND ${dateTo}
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
      COALESCE(SUM(total_price) FILTER (WHERE DATE(created_at) = ${today} AND status != 'CANCELLED' AND is_paid = true), 0) as revenue_today,
      COUNT(*) FILTER (WHERE DATE(created_at) = ${today} AND status != 'CANCELLED') as orders_today,
      COALESCE(AVG(total_price) FILTER (WHERE DATE(created_at) = ${today} AND status != 'CANCELLED' AND is_paid = true), 0) as avg_order_value,
      COUNT(*) FILTER (WHERE status = 'PENDING') as pending_orders
    FROM orders
  `;
  const stockRows = await sql`SELECT COUNT(*) as low_stock_items FROM products WHERE status IN ('LOW_STOCK', 'OUT_OF_STOCK') AND is_active = true`;
  const queueRows = await sql`SELECT current_queue_number FROM queue_state WHERE id = 1`;

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
