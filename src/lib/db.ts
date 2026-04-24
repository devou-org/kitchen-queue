import { neon, Pool } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export default sql;

// ============================================
// PRODUCT QUERIES
// ============================================

export async function getProducts(activeOnly = true) {
  const rows = await sql`
    SELECT * FROM products 
    WHERE is_active = ${activeOnly}
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
// ORDER QUERIES
// ============================================

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
  const localTimezone = 'Asia/Kolkata';

  if (filters.date_from && filters.date_to) {
    if (filters.status) {
      if (sort === 'DESC') {
        return await sql`
          SELECT o.*, (SELECT json_agg(json_build_object('id', oi.id, 'product_id', oi.product_id, 'quantity', oi.quantity, 'price_at_purchase', oi.price_at_purchase, 'product_name', p.name) ORDER BY oi.id) FROM order_items oi LEFT JOIN products p ON p.id = oi.product_id WHERE oi.order_id = o.id) as items
          FROM orders o
          WHERE o.status = ${filters.status} 
            AND DATE(o.created_at AT TIME ZONE ${localTimezone}) >= ${filters.date_from}::date
            AND DATE(o.created_at AT TIME ZONE ${localTimezone}) <= ${filters.date_to}::date
          ORDER BY DATE(o.created_at AT TIME ZONE ${localTimezone}) DESC,
                   o.created_at DESC,
                   o.ticket_number DESC
          LIMIT ${per_page} OFFSET ${offset}
        `;
      }
      return await sql`
        SELECT o.*, (SELECT json_agg(json_build_object('id', oi.id, 'product_id', oi.product_id, 'quantity', oi.quantity, 'price_at_purchase', oi.price_at_purchase, 'product_name', p.name) ORDER BY oi.id) FROM order_items oi LEFT JOIN products p ON p.id = oi.product_id WHERE oi.order_id = o.id) as items
        FROM orders o
        WHERE o.status = ${filters.status} 
          AND DATE(o.created_at AT TIME ZONE ${localTimezone}) >= ${filters.date_from}::date
          AND DATE(o.created_at AT TIME ZONE ${localTimezone}) <= ${filters.date_to}::date
        ORDER BY DATE(o.created_at AT TIME ZONE ${localTimezone}) ASC,
                 o.created_at ASC,
                 o.ticket_number ASC
        LIMIT ${per_page} OFFSET ${offset}
      `;
    } else if (filters.status_in) {
      const statuses = filters.status_in.split(',');
      if (sort === 'DESC') {
        return await sql`
          SELECT o.*, (SELECT json_agg(json_build_object('id', oi.id, 'product_id', oi.product_id, 'quantity', oi.quantity, 'price_at_purchase', oi.price_at_purchase, 'product_name', p.name) ORDER BY oi.id) FROM order_items oi LEFT JOIN products p ON p.id = oi.product_id WHERE oi.order_id = o.id) as items
          FROM orders o
          WHERE o.status = ANY(${statuses})
            AND DATE(o.created_at AT TIME ZONE ${localTimezone}) >= ${filters.date_from}::date
            AND DATE(o.created_at AT TIME ZONE ${localTimezone}) <= ${filters.date_to}::date
          ORDER BY DATE(o.created_at AT TIME ZONE ${localTimezone}) DESC,
                   o.created_at DESC,
                   o.ticket_number DESC
          LIMIT ${per_page} OFFSET ${offset}
        `;
      }
      return await sql`
        SELECT o.*, (SELECT json_agg(json_build_object('id', oi.id, 'product_id', oi.product_id, 'quantity', oi.quantity, 'price_at_purchase', oi.price_at_purchase, 'product_name', p.name) ORDER BY oi.id) FROM order_items oi LEFT JOIN products p ON p.id = oi.product_id WHERE oi.order_id = o.id) as items
        FROM orders o
        WHERE o.status = ANY(${statuses})
          AND DATE(o.created_at AT TIME ZONE ${localTimezone}) >= ${filters.date_from}::date
          AND DATE(o.created_at AT TIME ZONE ${localTimezone}) <= ${filters.date_to}::date
        ORDER BY DATE(o.created_at AT TIME ZONE ${localTimezone}) ASC,
                 o.created_at ASC,
                 o.ticket_number ASC
        LIMIT ${per_page} OFFSET ${offset}
      `;
    } else {
      if (sort === 'DESC') {
        return await sql`
          SELECT o.*, (SELECT json_agg(json_build_object('id', oi.id, 'product_id', oi.product_id, 'quantity', oi.quantity, 'price_at_purchase', oi.price_at_purchase, 'product_name', p.name) ORDER BY oi.id) FROM order_items oi LEFT JOIN products p ON p.id = oi.product_id WHERE oi.order_id = o.id) as items
          FROM orders o
          WHERE DATE(o.created_at AT TIME ZONE ${localTimezone}) >= ${filters.date_from}::date
            AND DATE(o.created_at AT TIME ZONE ${localTimezone}) <= ${filters.date_to}::date
          ORDER BY DATE(o.created_at AT TIME ZONE ${localTimezone}) DESC,
                   o.created_at DESC,
                   o.ticket_number DESC
          LIMIT ${per_page} OFFSET ${offset}
        `;
      }
      return await sql`
        SELECT o.*, (SELECT json_agg(json_build_object('id', oi.id, 'product_id', oi.product_id, 'quantity', oi.quantity, 'price_at_purchase', oi.price_at_purchase, 'product_name', p.name) ORDER BY oi.id) FROM order_items oi LEFT JOIN products p ON p.id = oi.product_id WHERE oi.order_id = o.id) as items
        FROM orders o
        WHERE DATE(o.created_at AT TIME ZONE ${localTimezone}) >= ${filters.date_from}::date
          AND DATE(o.created_at AT TIME ZONE ${localTimezone}) <= ${filters.date_to}::date
        ORDER BY DATE(o.created_at AT TIME ZONE ${localTimezone}) ASC,
                 o.created_at ASC,
                 o.ticket_number ASC
        LIMIT ${per_page} OFFSET ${offset}
      `;
    }
  }

  if (filters.status) {
    if (sort === 'DESC') {
      return await sql`
        SELECT o.*, (SELECT json_agg(json_build_object('id', oi.id, 'product_id', oi.product_id, 'quantity', oi.quantity, 'price_at_purchase', oi.price_at_purchase, 'product_name', p.name) ORDER BY oi.id) FROM order_items oi LEFT JOIN products p ON p.id = oi.product_id WHERE oi.order_id = o.id) as items
        FROM orders o
        WHERE o.status = ${filters.status}
        ORDER BY o.created_at DESC LIMIT ${per_page} OFFSET ${offset}
      `;
    }
    return await sql`
      SELECT o.*, (SELECT json_agg(json_build_object('id', oi.id, 'product_id', oi.product_id, 'quantity', oi.quantity, 'price_at_purchase', oi.price_at_purchase, 'product_name', p.name) ORDER BY oi.id) FROM order_items oi LEFT JOIN products p ON p.id = oi.product_id WHERE oi.order_id = o.id) as items
      FROM orders o
      WHERE o.status = ${filters.status}
      ORDER BY o.created_at ASC LIMIT ${per_page} OFFSET ${offset}
    `;
  }

  if (filters.status_in) {
    const statuses = filters.status_in.split(',');
    if (sort === 'DESC') {
      return await sql`
          SELECT o.*, (SELECT json_agg(json_build_object('id', oi.id, 'product_id', oi.product_id, 'quantity', oi.quantity, 'price_at_purchase', oi.price_at_purchase, 'product_name', p.name) ORDER BY oi.id) FROM order_items oi LEFT JOIN products p ON p.id = oi.product_id WHERE oi.order_id = o.id) as items
          FROM orders o
          WHERE o.status = ANY(${statuses})
          ORDER BY o.created_at DESC LIMIT ${per_page} OFFSET ${offset}
        `;
    }
    return await sql`
        SELECT o.*, (SELECT json_agg(json_build_object('id', oi.id, 'product_id', oi.product_id, 'quantity', oi.quantity, 'price_at_purchase', oi.price_at_purchase, 'product_name', p.name) ORDER BY oi.id) FROM order_items oi LEFT JOIN products p ON p.id = oi.product_id WHERE oi.order_id = o.id) as items
        FROM orders o
        WHERE o.status = ANY(${statuses})
        ORDER BY o.created_at ASC LIMIT ${per_page} OFFSET ${offset}
      `;
  }

  if (sort === 'DESC') {
    return await sql`
      SELECT o.*, (SELECT json_agg(json_build_object('id', oi.id, 'product_id', oi.product_id, 'quantity', oi.quantity, 'price_at_purchase', oi.price_at_purchase, 'product_name', p.name) ORDER BY oi.id) FROM order_items oi LEFT JOIN products p ON p.id = oi.product_id WHERE oi.order_id = o.id) as items
      FROM orders o
      ORDER BY o.created_at DESC LIMIT ${per_page} OFFSET ${offset}
    `;
  }
  return await sql`
    SELECT o.*, (SELECT json_agg(json_build_object('id', oi.id, 'product_id', oi.product_id, 'quantity', oi.quantity, 'price_at_purchase', oi.price_at_purchase, 'product_name', p.name) ORDER BY oi.id) FROM order_items oi LEFT JOIN products p ON p.id = oi.product_id WHERE oi.order_id = o.id) as items
    FROM orders o
    ORDER BY o.created_at ASC LIMIT ${per_page} OFFSET ${offset}
  `;
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
       SELECT
         id,
         ROW_NUMBER() OVER (
           PARTITION BY DATE(created_at)
           ORDER BY ticket_number ASC
         )::integer as pos
       FROM orders
       WHERE UPPER(status) = 'PENDING'
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
    ORDER BY o.created_at DESC
    LIMIT 1
  `;
  return rows[0] || null;
}

export async function getOrdersByPhone(phone: string) {
  const rows = await sql`
    WITH active_ranks AS (
       SELECT
         id,
         ROW_NUMBER() OVER (
           PARTITION BY DATE(created_at)
           ORDER BY ticket_number ASC
         )::integer as pos
       FROM orders
       WHERE UPPER(status) = 'PENDING'
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
      throw new Error('Insufficient stock for one or more items.');
    }

    const orderResult = await client.query(
      `
        INSERT INTO orders (customer_name, phone, total_price, status, is_paid, notes, party_size)
        VALUES ($1, $2, $3, 'PENDING', false, $4, $5)
        RETURNING id
      `,
      [data.customer_name, data.phone, computedTotal, data.notes || null, data.party_size || 1]
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
    return await getOrderById(orderId);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function updateOrderStatus(id: string, status: string, tableNumber?: string) {
  const rows = await sql`
    UPDATE orders
    SET status    = ${status},
        table_number = COALESCE(${tableNumber ?? null}, table_number),
        updated_at = NOW()
    WHERE id = ${id}
    RETURNING id, status, table_number, updated_at, customer_name, phone, total_price, is_paid, notes, party_size, ticket_number, created_at
  `;
  if (!rows[0]) throw new Error(`Order ${id} not found.`);
  return rows[0];
}

export async function updateOrderDetails(id: string, data: {
  customer_name?: string;
  phone?: string;
  notes?: string | null;
  party_size?: number;
  table_number?: string | null;
  items?: { product_id: string; quantity: number }[];
}) {
  const existingOrder = await getOrderById(id);
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
      SELECT id, name, price, stock_quantity, buffer_quantity
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
    }>();

    for (const row of productRows) {
      productById.set(row.id, {
        id: row.id,
        name: row.name,
        price: Number(row.price),
        stock_quantity: Number(row.stock_quantity),
        buffer_quantity: Number(row.buffer_quantity),
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
    WHERE id = ${id}
    RETURNING *
  `;

  if (!rows[0]) {
    throw new Error('Order not found');
  }

  return await getOrderById(id);
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

export async function setOrderPaymentStatus(id: string, isPaid: boolean) {
  const rows = await sql`
    UPDATE orders SET is_paid = ${isPaid}, updated_at = NOW() WHERE id = ${id} RETURNING *
  `;
  return rows[0];
}

export async function expireOldOrders() {
  const localTimezone = 'Asia/Kolkata';
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: localTimezone }).format(new Date());

  // 1. Get IDs of orders to expire
  const toExpire = await sql`
    SELECT id FROM orders 
    WHERE status IN ('PENDING', 'PREPARING')
      AND DATE(created_at AT TIME ZONE ${localTimezone}) < ${today}::date
  `;

  if (toExpire.length === 0) return { expiredCount: 0 };

  // 2. Cancel them and restore stock
  let expiredCount = 0;
  for (const row of toExpire) {
    try {
      await updateOrderStatus(row.id, 'EXPIRED');
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
    WHERE o.status IN ('PENDING')
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
      AVG(EXTRACT(EPOCH FROM (updated_at - created_at))) as avg_wait_time,
      MODE() WITHIN GROUP (ORDER BY EXTRACT(HOUR FROM created_at)) as peak_hour
    FROM orders
    WHERE DATE(created_at) BETWEEN ${dateFrom} AND ${dateTo}
      AND is_paid = true AND status = 'PAID'
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
      AND is_paid = true AND status = 'PAID'
    GROUP BY EXTRACT(HOUR FROM created_at)
    ORDER BY hour ASC
  `;
  return rows;
}

export async function getTopProducts(dateFrom: string, dateTo: string, limit = 10) {
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
    WHERE DATE(o.created_at) BETWEEN ${dateFrom} AND ${dateTo}
      AND o.is_paid = true AND o.status = 'PAID'
    GROUP BY p.id, p.name, p.category, p.price, p.image_url
    ORDER BY total_quantity DESC
    LIMIT ${limit}
  `;
  return rows;
}

export async function getDashboardStats() {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
  const statsRows = await sql`
    SELECT 
      COALESCE(SUM(total_price) FILTER (WHERE DATE(created_at) = ${today} AND is_paid = true AND status = 'PAID'), 0) as revenue_today,
      COUNT(*) FILTER (WHERE DATE(created_at) = ${today} AND is_paid = true AND status = 'PAID') as orders_today,
      COALESCE(AVG(total_price) FILTER (WHERE DATE(created_at) = ${today} AND is_paid = true AND status = 'PAID'), 0) as avg_order_value,
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

export async function getKitchenSnapshot() {
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
    WHERE DATE(o.created_at AT TIME ZONE ${localTimezone}) = ${today}::date
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
