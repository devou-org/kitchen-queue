/**
 * QDine Restaurant Inventory Management Engine
 * ============================================================
 * ACID Database Transactions, Immutable Stock Movements Ledger,
 * BOM Recipe Auto-Deductions, and Hardware-Ready Purchasing & Stock Takes.
 * ============================================================
 */

import { pool } from './db';
import {
  InventoryItem,
  InventoryCategory,
  InventoryUnit,
  Supplier,
  InventoryBatch,
  StockMovement,
  PurchaseOrder,
  WastageRecord,
  StockAdjustment,
  Recipe,
  InventoryDashboardSummary,
} from '@/types/inventory';

// ============================================================
// 1. SEED & INITIALIZATION HELPERS
// ============================================================

let inventorySchemaEnsured: Promise<void> | null = null;

export async function ensureInventorySchema(): Promise<void> {
  if (!inventorySchemaEnsured) {
    inventorySchemaEnsured = (async () => {
      try {
        await pool.query(`
          CREATE TABLE IF NOT EXISTS inventory_categories (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
              name VARCHAR(100) NOT NULL,
              description TEXT,
              created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
              UNIQUE(restaurant_id, name)
          );
          CREATE TABLE IF NOT EXISTS inventory_units (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
              name VARCHAR(50) NOT NULL,
              short_code VARCHAR(20) NOT NULL,
              created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
              UNIQUE(restaurant_id, short_code)
          );
          CREATE TABLE IF NOT EXISTS suppliers (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
              name VARCHAR(150) NOT NULL,
              contact_person VARCHAR(100),
              phone VARCHAR(30),
              email VARCHAR(150),
              address TEXT,
              gst_number VARCHAR(30),
              outstanding_balance NUMERIC(12,2) DEFAULT 0.00,
              is_active BOOLEAN DEFAULT true,
              created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
          );
          CREATE TABLE IF NOT EXISTS inventory_items (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
              name VARCHAR(150) NOT NULL,
              category_id UUID REFERENCES inventory_categories(id) ON DELETE SET NULL,
              unit VARCHAR(20) NOT NULL DEFAULT 'kg',
              current_stock NUMERIC(12,3) NOT NULL DEFAULT 0.000,
              min_stock NUMERIC(12,3) NOT NULL DEFAULT 0.000,
              max_stock NUMERIC(12,3) NULL,
              cost_per_unit NUMERIC(12,2) NOT NULL DEFAULT 0.00,
              supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
              storage_location VARCHAR(100),
              track_batches BOOLEAN DEFAULT false,
              track_expiry BOOLEAN DEFAULT false,
              is_active BOOLEAN DEFAULT true,
              created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
          );
          CREATE INDEX IF NOT EXISTS idx_inventory_items_rest ON inventory_items(restaurant_id);
          CREATE INDEX IF NOT EXISTS idx_inventory_items_stock ON inventory_items(restaurant_id, current_stock, min_stock);

          CREATE TABLE IF NOT EXISTS inventory_batches (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
              item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
              batch_number VARCHAR(100) NOT NULL,
              initial_quantity NUMERIC(12,3) NOT NULL,
              current_quantity NUMERIC(12,3) NOT NULL,
              cost_per_unit NUMERIC(12,2) NOT NULL DEFAULT 0.00,
              expiry_date DATE NULL,
              received_date DATE NOT NULL DEFAULT CURRENT_DATE,
              supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
              status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
              created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
          );
          CREATE INDEX IF NOT EXISTS idx_inventory_batches_item ON inventory_batches(item_id, status);

          CREATE TABLE IF NOT EXISTS stock_movements (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
              item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
              batch_id UUID REFERENCES inventory_batches(id) ON DELETE SET NULL,
              movement_type VARCHAR(30) NOT NULL,
              quantity NUMERIC(12,3) NOT NULL,
              balance_after NUMERIC(12,3) NOT NULL,
              unit_cost NUMERIC(12,2) NOT NULL DEFAULT 0.00,
              total_cost NUMERIC(12,2) NOT NULL DEFAULT 0.00,
              reference_type VARCHAR(50),
              reference_id VARCHAR(100),
              reason TEXT,
              notes TEXT,
              created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
          );
          CREATE INDEX IF NOT EXISTS idx_stock_movements_item ON stock_movements(item_id, created_at DESC);

          CREATE TABLE IF NOT EXISTS purchase_orders (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
              supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
              po_number VARCHAR(100) NOT NULL,
              invoice_number VARCHAR(100),
              received_date DATE NOT NULL DEFAULT CURRENT_DATE,
              status VARCHAR(30) NOT NULL DEFAULT 'RECEIVED',
              subtotal NUMERIC(12,2) NOT NULL DEFAULT 0.00,
              tax_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
              total_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
              payment_status VARCHAR(30) NOT NULL DEFAULT 'UNPAID',
              notes TEXT,
              created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
          );
          CREATE TABLE IF NOT EXISTS purchase_order_items (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
              item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
              quantity NUMERIC(12,3) NOT NULL,
              unit VARCHAR(20) NOT NULL,
              unit_price NUMERIC(12,2) NOT NULL,
              tax_rate NUMERIC(5,2) DEFAULT 0.00,
              total_price NUMERIC(12,2) NOT NULL,
              batch_number VARCHAR(100),
              expiry_date DATE
          );

          CREATE TABLE IF NOT EXISTS wastages (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
              item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
              batch_id UUID REFERENCES inventory_batches(id) ON DELETE SET NULL,
              quantity NUMERIC(12,3) NOT NULL,
              unit VARCHAR(20) NOT NULL,
              unit_cost NUMERIC(12,2) NOT NULL DEFAULT 0.00,
              total_cost NUMERIC(12,2) NOT NULL DEFAULT 0.00,
              reason VARCHAR(50) NOT NULL,
              notes TEXT,
              logged_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
              created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
          );
          CREATE INDEX IF NOT EXISTS idx_wastages_rest ON wastages(restaurant_id, logged_at DESC);

          CREATE TABLE IF NOT EXISTS stock_adjustments (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
              item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
              system_stock NUMERIC(12,3) NOT NULL,
              physical_stock NUMERIC(12,3) NOT NULL,
              adjusted_quantity NUMERIC(12,3) NOT NULL,
              reason TEXT NOT NULL,
              adjusted_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
              created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
          );

          CREATE TABLE IF NOT EXISTS recipes (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
              product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
              instructions TEXT,
              yield_servings INT NOT NULL DEFAULT 1,
              created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
              UNIQUE(restaurant_id, product_id)
          );
          CREATE TABLE IF NOT EXISTS recipe_items (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
              item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
              quantity NUMERIC(12,3) NOT NULL,
              unit VARCHAR(20) NOT NULL,
              notes TEXT,
              created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
          );
          CREATE INDEX IF NOT EXISTS idx_recipe_items_recipe ON recipe_items(recipe_id);
        `);
      } catch (err) {
        console.error('Error ensuring inventory schema:', err);
        inventorySchemaEnsured = null;
      }
    })();
  }
  return inventorySchemaEnsured;
}

export async function ensureDefaultCategoriesAndUnits(restaurantId: string) {
  await ensureInventorySchema();

  const defaultUnits = [
    { name: 'Kilogram', short_code: 'kg' },
    { name: 'Gram', short_code: 'g' },
    { name: 'Litre', short_code: 'L' },
    { name: 'Millilitre', short_code: 'ml' },
    { name: 'Pieces', short_code: 'pcs' },
    { name: 'Box', short_code: 'box' },
    { name: 'Can', short_code: 'can' },
    { name: 'Packet', short_code: 'pkt' },
    { name: 'Slice', short_code: 'slice' },
    { name: 'Portion', short_code: 'portion' },
  ];

  const defaultCategories = [
    'Meat & Poultry',
    'Vegetables & Greens',
    'Dairy & Cheese',
    'Bakery & Breads',
    'Sauces & Condiments',
    'Dry Goods & Grains',
    'Beverages & Syrups',
    'Spices & Seasoning',
    'Packaging & Disposables',
    'Miscellaneous',
  ];

  try {
    for (const u of defaultUnits) {
      await pool.query(
        `INSERT INTO inventory_units (restaurant_id, name, short_code)
         VALUES ($1, $2, $3)
         ON CONFLICT (restaurant_id, short_code) DO NOTHING`,
        [restaurantId, u.name, u.short_code]
      );
    }

    for (const c of defaultCategories) {
      await pool.query(
        `INSERT INTO inventory_categories (restaurant_id, name)
         VALUES ($1, $2)
         ON CONFLICT (restaurant_id, name) DO NOTHING`,
        [restaurantId, c]
      );
    }
  } catch (err) {
    console.error('Error seeding default units/categories:', err);
  }
}

// ============================================================
// 2. DASHBOARD & OVERVIEW METRICS
// ============================================================

export async function getInventoryDashboardSummary(restaurantId: string): Promise<InventoryDashboardSummary> {
  await ensureDefaultCategoriesAndUnits(restaurantId);

  // 1. Basic aggregates
  const aggQuery = `
    SELECT
      COALESCE(SUM(current_stock * cost_per_unit), 0) AS stock_value,
      COUNT(*)::int AS total_items,
      COUNT(*) FILTER (WHERE current_stock > 0 AND current_stock <= min_stock)::int AS low_stock_count,
      COUNT(*) FILTER (WHERE current_stock <= 0)::int AS out_of_stock_count
    FROM inventory_items
    WHERE restaurant_id = $1 AND is_active = true
  `;
  const aggRes = await pool.query(aggQuery, [restaurantId]);
  const agg = aggRes.rows[0] || {};

  // 2. Today's consumption and wastage (based on stock movements today)
  const todayMovementQuery = `
    SELECT
      COALESCE(SUM(ABS(total_cost)) FILTER (WHERE movement_type = 'CONSUMPTION'), 0) AS today_consumption,
      COALESCE(SUM(total_cost) FILTER (WHERE movement_type = 'WASTAGE'), 0) AS today_wastage
    FROM stock_movements
    WHERE restaurant_id = $1
      AND created_at >= CURRENT_DATE
  `;
  const todayMovements = await pool.query(todayMovementQuery, [restaurantId]);
  const todayData = todayMovements.rows[0] || {};

  // 3. Low stock items (top 8)
  const lowStockQuery = `
    SELECT id, name, current_stock::float, min_stock::float, unit
    FROM inventory_items
    WHERE restaurant_id = $1 AND is_active = true AND current_stock <= min_stock
    ORDER BY (current_stock / NULLIF(min_stock, 0)) ASC NULLS FIRST
    LIMIT 8
  `;
  const lowStockRes = await pool.query(lowStockQuery, [restaurantId]);

  // 4. Expiring soon batches (within 7 days)
  const expiringQuery = `
    SELECT
      b.id, b.item_id, i.name AS item_name, b.batch_number,
      b.current_quantity::float, i.unit, b.expiry_date,
      (b.expiry_date - CURRENT_DATE)::int AS days_left
    FROM inventory_batches b
    JOIN inventory_items i ON i.id = b.item_id
    WHERE b.restaurant_id = $1
      AND b.status = 'ACTIVE'
      AND b.current_quantity > 0
      AND b.expiry_date IS NOT NULL
      AND b.expiry_date <= (CURRENT_DATE + INTERVAL '7 days')
    ORDER BY b.expiry_date ASC
    LIMIT 8
  `;
  const expiringRes = await pool.query(expiringQuery, [restaurantId]);

  // 5. Recent stock movements
  const recentMovementsQuery = `
    SELECT
      sm.*,
      i.name AS item_name,
      i.unit,
      b.batch_number
    FROM stock_movements sm
    JOIN inventory_items i ON i.id = sm.item_id
    LEFT JOIN inventory_batches b ON b.id = sm.batch_id
    WHERE sm.restaurant_id = $1
    ORDER BY sm.created_at DESC
    LIMIT 10
  `;
  const recentMovementsRes = await pool.query(recentMovementsQuery, [restaurantId]);

  return {
    stock_value: Number(agg.stock_value || 0),
    total_items: Number(agg.total_items || 0),
    low_stock_count: Number(agg.low_stock_count || 0),
    out_of_stock_count: Number(agg.out_of_stock_count || 0),
    expiring_soon_count: expiringRes.rows.length,
    today_consumption: Number(todayData.today_consumption || 0),
    today_wastage: Number(todayData.today_wastage || 0),
    low_stock_items: lowStockRes.rows,
    expiring_soon: expiringRes.rows.map(r => ({
      ...r,
      expiry_date: r.expiry_date ? r.expiry_date.toISOString().split('T')[0] : '',
    })),
    recent_movements: recentMovementsRes.rows,
  };
}

// ============================================================
// 3. INGREDIENTS MASTER (INVENTORY_ITEMS) CRUD
// ============================================================

export async function getInventoryItems(
  restaurantId: string,
  filters: {
    category_id?: string;
    search?: string;
    status?: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';
    is_active?: boolean;
  } = {}
): Promise<InventoryItem[]> {
  await ensureDefaultCategoriesAndUnits(restaurantId);

  const values: any[] = [restaurantId];
  let conditions = [`i.restaurant_id = $1`];

  if (filters.is_active !== undefined) {
    values.push(filters.is_active);
    conditions.push(`i.is_active = $${values.length}`);
  }

  if (filters.category_id) {
    values.push(filters.category_id);
    conditions.push(`i.category_id = $${values.length}`);
  }

  if (filters.search) {
    values.push(`%${filters.search.trim()}%`);
    conditions.push(`(i.name ILIKE $${values.length} OR i.storage_location ILIKE $${values.length})`);
  }

  if (filters.status === 'OUT_OF_STOCK') {
    conditions.push(`i.current_stock <= 0`);
  } else if (filters.status === 'LOW_STOCK') {
    conditions.push(`i.current_stock > 0 AND i.current_stock <= i.min_stock`);
  } else if (filters.status === 'IN_STOCK') {
    conditions.push(`i.current_stock > i.min_stock`);
  }

  const query = `
    SELECT
      i.*,
      c.name AS category_name,
      s.name AS supplier_name,
      (i.current_stock * i.cost_per_unit)::float AS total_value,
      CASE
        WHEN i.current_stock <= 0 THEN 'OUT_OF_STOCK'
        WHEN i.current_stock <= i.min_stock THEN 'LOW_STOCK'
        ELSE 'IN_STOCK'
      END AS stock_status
    FROM inventory_items i
    LEFT JOIN inventory_categories c ON c.id = i.category_id
    LEFT JOIN suppliers s ON s.id = i.supplier_id
    WHERE ${conditions.join(' AND ')}
    ORDER BY i.name ASC
  `;

  const res = await pool.query(query, values);
  return res.rows.map(r => ({
    ...r,
    current_stock: Number(r.current_stock),
    min_stock: Number(r.min_stock),
    max_stock: r.max_stock !== null ? Number(r.max_stock) : undefined,
    cost_per_unit: Number(r.cost_per_unit),
    total_value: Number(r.total_value || 0),
  }));
}

export async function getInventoryItemById(restaurantId: string, id: string): Promise<any | null> {
  await ensureInventorySchema();
  const query = `
    SELECT
      i.*,
      c.name AS category_name,
      s.name AS supplier_name,
      (i.current_stock * i.cost_per_unit)::float AS total_value,
      CASE
        WHEN i.current_stock <= 0 THEN 'OUT_OF_STOCK'
        WHEN i.current_stock <= i.min_stock THEN 'LOW_STOCK'
        ELSE 'IN_STOCK'
      END AS stock_status
    FROM inventory_items i
    LEFT JOIN inventory_categories c ON c.id = i.category_id
    LEFT JOIN suppliers s ON s.id = i.supplier_id
    WHERE i.restaurant_id = $1 AND i.id = $2
    LIMIT 1
  `;
  const res = await pool.query(query, [restaurantId, id]);
  if (res.rows.length === 0) return null;

  const item = res.rows[0];

  // Fetch batches
  const batchesRes = await pool.query(
    `SELECT b.*, (b.expiry_date - CURRENT_DATE)::int AS days_until_expiry
     FROM inventory_batches b
     WHERE b.restaurant_id = $1 AND b.item_id = $2 AND b.status = 'ACTIVE'
     ORDER BY b.expiry_date ASC NULLS LAST, b.received_date DESC`,
    [restaurantId, id]
  );

  // Fetch recent stock movements
  const movementsRes = await pool.query(
    `SELECT sm.*, b.batch_number
     FROM stock_movements sm
     LEFT JOIN inventory_batches b ON b.id = sm.batch_id
     WHERE sm.restaurant_id = $1 AND sm.item_id = $2
     ORDER BY sm.created_at DESC
     LIMIT 50`,
    [restaurantId, id]
  );

  return {
    ...item,
    current_stock: Number(item.current_stock),
    min_stock: Number(item.min_stock),
    max_stock: item.max_stock !== null ? Number(item.max_stock) : undefined,
    cost_per_unit: Number(item.cost_per_unit),
    total_value: Number(item.total_value || 0),
    batches: batchesRes.rows.map(b => ({
      ...b,
      initial_quantity: Number(b.initial_quantity),
      current_quantity: Number(b.current_quantity),
      cost_per_unit: Number(b.cost_per_unit),
      expiry_date: b.expiry_date ? b.expiry_date.toISOString().split('T')[0] : null,
      received_date: b.received_date ? b.received_date.toISOString().split('T')[0] : '',
    })),
    movements: movementsRes.rows.map(m => ({
      ...m,
      quantity: Number(m.quantity),
      balance_after: Number(m.balance_after),
      unit_cost: Number(m.unit_cost),
      total_cost: Number(m.total_cost),
    })),
  };
}

export async function createInventoryItem(
  restaurantId: string,
  data: {
    name: string;
    category_id?: string;
    unit: string;
    current_stock?: number;
    min_stock?: number;
    max_stock?: number;
    cost_per_unit: number;
    supplier_id?: string;
    storage_location?: string;
    track_batches?: boolean;
    track_expiry?: boolean;
  }
): Promise<InventoryItem> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const initialStock = Number(data.current_stock || 0);
    const unitCost = Number(data.cost_per_unit || 0);

    const insertQuery = `
      INSERT INTO inventory_items (
        restaurant_id, name, category_id, unit, current_stock,
        min_stock, max_stock, cost_per_unit, supplier_id,
        storage_location, track_batches, track_expiry
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `;
    const res = await client.query(insertQuery, [
      restaurantId,
      data.name.trim(),
      data.category_id || null,
      data.unit || 'kg',
      initialStock,
      Number(data.min_stock || 0),
      data.max_stock ? Number(data.max_stock) : null,
      unitCost,
      data.supplier_id || null,
      data.storage_location?.trim() || null,
      Boolean(data.track_batches),
      Boolean(data.track_expiry),
    ]);

    const createdItem = res.rows[0];

    // If starting with initial stock > 0, log an initial stock movement
    if (initialStock > 0) {
      await client.query(
        `INSERT INTO stock_movements (
          restaurant_id, item_id, movement_type, quantity, balance_after,
          unit_cost, total_cost, reference_type, reason
        ) VALUES ($1, $2, 'INITIAL', $3, $4, $5, $6, 'MANUAL', 'Initial stock setup')`,
        [
          restaurantId,
          createdItem.id,
          initialStock,
          initialStock,
          unitCost,
          initialStock * unitCost,
        ]
      );
    }

    await client.query('COMMIT');
    return createdItem;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function updateInventoryItem(
  restaurantId: string,
  id: string,
  data: Partial<{
    name: string;
    category_id: string | null;
    unit: string;
    min_stock: number;
    max_stock: number | null;
    cost_per_unit: number;
    supplier_id: string | null;
    storage_location: string | null;
    track_batches: boolean;
    track_expiry: boolean;
    is_active: boolean;
  }>
): Promise<InventoryItem> {
  const query = `
    UPDATE inventory_items SET
      name = COALESCE($1, name),
      category_id = CASE WHEN $2::text IS NOT NULL THEN $2::uuid ELSE category_id END,
      unit = COALESCE($3, unit),
      min_stock = COALESCE($4, min_stock),
      max_stock = CASE WHEN $5::text IS NOT NULL THEN $5::numeric ELSE max_stock END,
      cost_per_unit = COALESCE($6, cost_per_unit),
      supplier_id = CASE WHEN $7::text IS NOT NULL THEN $7::uuid ELSE supplier_id END,
      storage_location = CASE WHEN $8::text IS NOT NULL THEN $8 ELSE storage_location END,
      track_batches = COALESCE($9, track_batches),
      track_expiry = COALESCE($10, track_expiry),
      is_active = COALESCE($11, is_active),
      updated_at = NOW()
    WHERE restaurant_id = $12 AND id = $13
    RETURNING *
  `;

  const res = await pool.query(query, [
    data.name !== undefined ? data.name.trim() : null,
    data.category_id !== undefined ? data.category_id : null,
    data.unit || null,
    data.min_stock !== undefined ? Number(data.min_stock) : null,
    data.max_stock !== undefined ? data.max_stock : null,
    data.cost_per_unit !== undefined ? Number(data.cost_per_unit) : null,
    data.supplier_id !== undefined ? data.supplier_id : null,
    data.storage_location !== undefined ? data.storage_location : null,
    data.track_batches,
    data.track_expiry,
    data.is_active,
    restaurantId,
    id,
  ]);

  return res.rows[0];
}

// ============================================================
// 4. PURCHASES & STOCK RECEIVING (GOODS RECEIVED)
// ============================================================

export async function receivePurchaseStock(
  restaurantId: string,
  data: {
    supplier_id?: string;
    invoice_number?: string;
    po_number?: string;
    received_date?: string;
    payment_status?: 'PAID' | 'PARTIAL' | 'UNPAID';
    notes?: string;
    items: {
      item_id: string;
      quantity: number;
      unit: string;
      unit_price: number;
      tax_rate?: number;
      batch_number?: string;
      expiry_date?: string;
    }[];
  }
): Promise<PurchaseOrder> {
  if (!data.items || data.items.length === 0) {
    throw new Error('At least one item is required to receive stock.');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const poNumber =
      data.po_number || `PO-${Date.now().toString().slice(-6)}`;
    const receivedDate = data.received_date || new Date().toISOString().split('T')[0];

    // Calculate subtotal, tax, and total
    let subtotal = 0;
    let taxAmount = 0;

    for (const item of data.items) {
      const lineTotal = Number(item.quantity) * Number(item.unit_price);
      subtotal += lineTotal;
      const taxRate = Number(item.tax_rate || 0);
      taxAmount += lineTotal * (taxRate / 100);
    }
    const totalAmount = Math.round((subtotal + taxAmount) * 100) / 100;

    // 1. Create Purchase Order header
    const poRes = await client.query(
      `INSERT INTO purchase_orders (
        restaurant_id, supplier_id, po_number, invoice_number,
        received_date, status, subtotal, tax_amount, total_amount,
        payment_status, notes
      ) VALUES ($1, $2, $3, $4, $5, 'RECEIVED', $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        restaurantId,
        data.supplier_id || null,
        poNumber,
        data.invoice_number?.trim() || null,
        receivedDate,
        subtotal,
        taxAmount,
        totalAmount,
        data.payment_status || 'UNPAID',
        data.notes?.trim() || null,
      ]
    );
    const po = poRes.rows[0];

    // 2. Process each item: Row-level lock, update stock, create batch, write stock_movements
    for (const item of data.items) {
      const qty = Number(item.quantity);
      const unitPrice = Number(item.unit_price);
      const lineTotal = qty * unitPrice;

      // Lock ingredient row
      const itemRes = await client.query(
        `SELECT id, name, current_stock, cost_per_unit, track_batches, track_expiry
         FROM inventory_items
         WHERE restaurant_id = $1 AND id = $2
         FOR UPDATE`,
        [restaurantId, item.item_id]
      );
      if (itemRes.rows.length === 0) {
        throw new Error(`Inventory ingredient with ID ${item.item_id} not found.`);
      }

      const currentItem = itemRes.rows[0];
      const previousStock = Number(currentItem.current_stock);
      const newStock = previousStock + qty;

      // Update current stock and cost per unit (weighted average cost or latest cost)
      await client.query(
        `UPDATE inventory_items
         SET current_stock = $1,
             cost_per_unit = $2,
             updated_at = NOW()
         WHERE id = $3`,
        [newStock, unitPrice, item.item_id]
      );

      // Create batch if batch tracking or batch number provided
      let batchId: string | null = null;
      const batchNumber = item.batch_number?.trim() || `B-${Date.now().toString().slice(-6)}`;
      if (item.batch_number || currentItem.track_batches || item.expiry_date) {
        const batchRes = await client.query(
          `INSERT INTO inventory_batches (
            restaurant_id, item_id, batch_number, initial_quantity,
            current_quantity, cost_per_unit, expiry_date, received_date,
            supplier_id, status
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'ACTIVE')
          RETURNING id`,
          [
            restaurantId,
            item.item_id,
            batchNumber,
            qty,
            qty,
            unitPrice,
            item.expiry_date || null,
            receivedDate,
            data.supplier_id || null,
          ]
        );
        batchId = batchRes.rows[0]?.id;
      }

      // Record PO line item
      await client.query(
        `INSERT INTO purchase_order_items (
          purchase_order_id, item_id, quantity, unit,
          unit_price, tax_rate, total_price, batch_number, expiry_date
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          po.id,
          item.item_id,
          qty,
          item.unit,
          unitPrice,
          Number(item.tax_rate || 0),
          lineTotal,
          batchNumber,
          item.expiry_date || null,
        ]
      );

      // Log immutable stock movement
      await client.query(
        `INSERT INTO stock_movements (
          restaurant_id, item_id, batch_id, movement_type, quantity,
          balance_after, unit_cost, total_cost, reference_type,
          reference_id, reason, notes
        ) VALUES ($1, $2, $3, 'PURCHASE', $4, $5, $6, $7, 'PURCHASE_ORDER', $8, $9, $10)`,
        [
          restaurantId,
          item.item_id,
          batchId,
          qty,
          newStock,
          unitPrice,
          lineTotal,
          po.id,
          `Received via PO ${poNumber}`,
          data.invoice_number ? `Invoice: ${data.invoice_number}` : null,
        ]
      );
    }

    // 3. Update supplier balance if unpaid
    if (data.supplier_id && data.payment_status === 'UNPAID') {
      await client.query(
        `UPDATE suppliers
         SET outstanding_balance = outstanding_balance + $1,
             updated_at = NOW()
         WHERE id = $2 AND restaurant_id = $3`,
        [totalAmount, data.supplier_id, restaurantId]
      );
    }

    await client.query('COMMIT');
    return po;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function getPurchaseOrders(restaurantId: string): Promise<PurchaseOrder[]> {
  const query = `
    SELECT
      po.*,
      s.name AS supplier_name,
      json_agg(json_build_object(
        'id', poi.id,
        'item_id', poi.item_id,
        'item_name', i.name,
        'quantity', poi.quantity::float,
        'unit', poi.unit,
        'unit_price', poi.unit_price::float,
        'tax_rate', poi.tax_rate::float,
        'total_price', poi.total_price::float,
        'batch_number', poi.batch_number,
        'expiry_date', poi.expiry_date
      ) ORDER BY poi.id) AS items
    FROM purchase_orders po
    LEFT JOIN suppliers s ON s.id = po.supplier_id
    LEFT JOIN purchase_order_items poi ON poi.purchase_order_id = po.id
    LEFT JOIN inventory_items i ON i.id = poi.item_id
    WHERE po.restaurant_id = $1
    GROUP BY po.id, s.name
    ORDER BY po.received_date DESC, po.created_at DESC
  `;
  const res = await pool.query(query, [restaurantId]);
  return res.rows.map(r => ({
    ...r,
    subtotal: Number(r.subtotal),
    tax_amount: Number(r.tax_amount),
    total_amount: Number(r.total_amount),
    received_date: r.received_date ? r.received_date.toISOString().split('T')[0] : '',
    items: r.items || [],
  }));
}

// ============================================================
// 5. WASTAGE & STOCK ADJUSTMENTS
// ============================================================

export async function recordWastage(
  restaurantId: string,
  data: {
    item_id: string;
    batch_id?: string;
    quantity: number;
    reason: string;
    notes?: string;
  }
): Promise<WastageRecord> {
  const qty = Number(data.quantity);
  if (!qty || qty <= 0) {
    throw new Error('Wastage quantity must be greater than zero.');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Lock item
    const itemRes = await client.query(
      `SELECT id, name, unit, current_stock, cost_per_unit
       FROM inventory_items
       WHERE restaurant_id = $1 AND id = $2
       FOR UPDATE`,
      [restaurantId, data.item_id]
    );
    if (itemRes.rows.length === 0) {
      throw new Error('Inventory ingredient not found.');
    }

    const item = itemRes.rows[0];
    const prevStock = Number(item.current_stock);
    const newStock = Math.max(0, prevStock - qty);
    const unitCost = Number(item.cost_per_unit);
    const totalCost = Math.round(qty * unitCost * 100) / 100;

    // 2. Update stock
    await client.query(
      `UPDATE inventory_items
       SET current_stock = $1, updated_at = NOW()
       WHERE id = $2`,
      [newStock, data.item_id]
    );

    // 3. Deduct batch if specified
    if (data.batch_id) {
      await client.query(
        `UPDATE inventory_batches
         SET current_quantity = GREATEST(0, current_quantity - $1),
             status = CASE WHEN current_quantity - $1 <= 0 THEN 'DEPLETED' ELSE 'ACTIVE' END
         WHERE id = $2 AND restaurant_id = $3`,
        [qty, data.batch_id, restaurantId]
      );
    }

    // 4. Create wastage record
    const wasteRes = await client.query(
      `INSERT INTO wastages (
        restaurant_id, item_id, batch_id, quantity, unit,
        unit_cost, total_cost, reason, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        restaurantId,
        data.item_id,
        data.batch_id || null,
        qty,
        item.unit,
        unitCost,
        totalCost,
        data.reason,
        data.notes?.trim() || null,
      ]
    );
    const wastage = wasteRes.rows[0];

    // 5. Record stock movement
    await client.query(
      `INSERT INTO stock_movements (
        restaurant_id, item_id, batch_id, movement_type, quantity,
        balance_after, unit_cost, total_cost, reference_type,
        reference_id, reason, notes
      ) VALUES ($1, $2, $3, 'WASTAGE', $4, $5, $6, $7, 'WASTAGE_RECORD', $8, $9, $10)`,
      [
        restaurantId,
        data.item_id,
        data.batch_id || null,
        -qty,
        newStock,
        unitCost,
        totalCost,
        wastage.id,
        `Wastage: ${data.reason}`,
        data.notes?.trim() || null,
      ]
    );

    await client.query('COMMIT');
    return wastage;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function getWastageRecords(restaurantId: string): Promise<WastageRecord[]> {
  const query = `
    SELECT
      w.*,
      i.name AS item_name,
      c.name AS category_name,
      b.batch_number
    FROM wastages w
    JOIN inventory_items i ON i.id = w.item_id
    LEFT JOIN inventory_categories c ON c.id = i.category_id
    LEFT JOIN inventory_batches b ON b.id = w.batch_id
    WHERE w.restaurant_id = $1
    ORDER BY w.logged_at DESC
  `;
  const res = await pool.query(query, [restaurantId]);
  return res.rows.map(r => ({
    ...r,
    quantity: Number(r.quantity),
    unit_cost: Number(r.unit_cost),
    total_cost: Number(r.total_cost),
    logged_at: r.logged_at ? r.logged_at.toISOString() : '',
  }));
}

export async function recordStockAdjustment(
  restaurantId: string,
  data: {
    item_id: string;
    physical_stock: number;
    reason: string;
  }
): Promise<StockAdjustment> {
  const physical = Number(data.physical_stock);
  if (physical < 0) {
    throw new Error('Physical stock cannot be negative.');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const itemRes = await client.query(
      `SELECT id, name, unit, current_stock, cost_per_unit
       FROM inventory_items
       WHERE restaurant_id = $1 AND id = $2
       FOR UPDATE`,
      [restaurantId, data.item_id]
    );
    if (itemRes.rows.length === 0) {
      throw new Error('Inventory ingredient not found.');
    }

    const item = itemRes.rows[0];
    const systemStock = Number(item.current_stock);
    const delta = physical - systemStock; // positive if found extra, negative if short
    const unitCost = Number(item.cost_per_unit);
    const totalCost = Math.round(Math.abs(delta) * unitCost * 100) / 100;

    // 1. Update stock
    await client.query(
      `UPDATE inventory_items
       SET current_stock = $1, updated_at = NOW()
       WHERE id = $2`,
      [physical, data.item_id]
    );

    // 2. Insert stock_adjustments record
    const adjRes = await client.query(
      `INSERT INTO stock_adjustments (
        restaurant_id, item_id, system_stock, physical_stock,
        adjusted_quantity, reason
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *`,
      [
        restaurantId,
        data.item_id,
        systemStock,
        physical,
        delta,
        data.reason.trim(),
      ]
    );
    const adjustment = adjRes.rows[0];

    // 3. Log stock movement
    await client.query(
      `INSERT INTO stock_movements (
        restaurant_id, item_id, movement_type, quantity, balance_after,
        unit_cost, total_cost, reference_type, reference_id, reason
      ) VALUES ($1, $2, 'ADJUSTMENT', $3, $4, $5, $6, 'STOCK_TAKE', $7, $8)`,
      [
        restaurantId,
        data.item_id,
        delta,
        physical,
        unitCost,
        totalCost,
        adjustment.id,
        `Stock Take Adjustment: ${data.reason}`,
      ]
    );

    await client.query('COMMIT');
    return adjustment;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function getStockAdjustments(restaurantId: string): Promise<StockAdjustment[]> {
  const query = `
    SELECT
      sa.*,
      i.name AS item_name,
      i.unit
    FROM stock_adjustments sa
    JOIN inventory_items i ON i.id = sa.item_id
    WHERE sa.restaurant_id = $1
    ORDER BY sa.adjusted_at DESC
  `;
  const res = await pool.query(query, [restaurantId]);
  return res.rows.map(r => ({
    ...r,
    system_stock: Number(r.system_stock),
    physical_stock: Number(r.physical_stock),
    adjusted_quantity: Number(r.adjusted_quantity),
    adjusted_at: r.adjusted_at ? r.adjusted_at.toISOString() : '',
  }));
}

// ============================================================
// 6. SUPPLIERS CRUD
// ============================================================

export async function getSuppliers(restaurantId: string): Promise<Supplier[]> {
  const query = `
    SELECT
      s.*,
      COALESCE(SUM(po.total_amount) FILTER (WHERE po.status = 'RECEIVED'), 0)::float AS total_purchases,
      COUNT(DISTINCT i.id)::int AS products_count,
      MAX(po.received_date) AS last_purchase_date
    FROM suppliers s
    LEFT JOIN purchase_orders po ON po.supplier_id = s.id
    LEFT JOIN inventory_items i ON i.supplier_id = s.id
    WHERE s.restaurant_id = $1
    GROUP BY s.id
    ORDER BY s.name ASC
  `;
  const res = await pool.query(query, [restaurantId]);
  return res.rows.map(r => ({
    ...r,
    outstanding_balance: Number(r.outstanding_balance),
    total_purchases: Number(r.total_purchases),
    last_purchase_date: r.last_purchase_date ? r.last_purchase_date.toISOString().split('T')[0] : undefined,
  }));
}

export async function createSupplier(
  restaurantId: string,
  data: {
    name: string;
    contact_person?: string;
    phone?: string;
    email?: string;
    address?: string;
    gst_number?: string;
    outstanding_balance?: number;
  }
): Promise<Supplier> {
  const query = `
    INSERT INTO suppliers (
      restaurant_id, name, contact_person, phone, email,
      address, gst_number, outstanding_balance
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *
  `;
  const res = await pool.query(query, [
    restaurantId,
    data.name.trim(),
    data.contact_person?.trim() || null,
    data.phone?.trim() || null,
    data.email?.trim() || null,
    data.address?.trim() || null,
    data.gst_number?.trim() || null,
    Number(data.outstanding_balance || 0),
  ]);
  return res.rows[0];
}

export async function updateSupplier(
  restaurantId: string,
  id: string,
  data: Partial<Supplier>
): Promise<Supplier> {
  const query = `
    UPDATE suppliers SET
      name = COALESCE($1, name),
      contact_person = CASE WHEN $2::text IS NOT NULL THEN $2 ELSE contact_person END,
      phone = CASE WHEN $3::text IS NOT NULL THEN $3 ELSE phone END,
      email = CASE WHEN $4::text IS NOT NULL THEN $4 ELSE email END,
      address = CASE WHEN $5::text IS NOT NULL THEN $5 ELSE address END,
      gst_number = CASE WHEN $6::text IS NOT NULL THEN $6 ELSE gst_number END,
      outstanding_balance = COALESCE($7, outstanding_balance),
      is_active = COALESCE($8, is_active),
      updated_at = NOW()
    WHERE restaurant_id = $9 AND id = $10
    RETURNING *
  `;
  const res = await pool.query(query, [
    data.name?.trim() || null,
    data.contact_person !== undefined ? data.contact_person : null,
    data.phone !== undefined ? data.phone : null,
    data.email !== undefined ? data.email : null,
    data.address !== undefined ? data.address : null,
    data.gst_number !== undefined ? data.gst_number : null,
    data.outstanding_balance !== undefined ? Number(data.outstanding_balance) : null,
    data.is_active,
    restaurantId,
    id,
  ]);
  return res.rows[0];
}

// ============================================================
// 7. RECIPES / BOM (BILL OF MATERIALS)
// ============================================================

export async function getRecipes(restaurantId: string): Promise<Recipe[]> {
  const query = `
    SELECT
      r.*,
      p.name AS product_name,
      p.price AS product_price,
      COALESCE(
        json_agg(json_build_object(
          'id', ri.id,
          'item_id', ri.item_id,
          'item_name', i.name,
          'unit', ri.unit,
          'cost_per_unit', i.cost_per_unit::float,
          'quantity', ri.quantity::float,
          'notes', ri.notes
        ) ORDER BY ri.id) FILTER (WHERE ri.id IS NOT NULL),
        '[]'::json
      ) AS items,
      COALESCE(SUM(ri.quantity * i.cost_per_unit), 0)::float AS total_cost
    FROM recipes r
    JOIN products p ON p.id = r.product_id
    LEFT JOIN recipe_items ri ON ri.recipe_id = r.id
    LEFT JOIN inventory_items i ON i.id = ri.item_id
    WHERE r.restaurant_id = $1
    GROUP BY r.id, p.name, p.price
    ORDER BY p.name ASC
  `;
  const res = await pool.query(query, [restaurantId]);
  return res.rows.map(r => ({
    ...r,
    yield_servings: Number(r.yield_servings),
    total_cost: Number(r.total_cost || 0),
    items: r.items || [],
  }));
}

export async function getRecipeByProductId(restaurantId: string, productId: string): Promise<Recipe | null> {
  const query = `
    SELECT
      r.*,
      p.name AS product_name,
      p.price AS product_price,
      COALESCE(
        json_agg(json_build_object(
          'id', ri.id,
          'item_id', ri.item_id,
          'item_name', i.name,
          'unit', ri.unit,
          'cost_per_unit', i.cost_per_unit::float,
          'quantity', ri.quantity::float,
          'notes', ri.notes
        ) ORDER BY ri.id) FILTER (WHERE ri.id IS NOT NULL),
        '[]'::json
      ) AS items,
      COALESCE(SUM(ri.quantity * i.cost_per_unit), 0)::float AS total_cost
    FROM recipes r
    JOIN products p ON p.id = r.product_id
    LEFT JOIN recipe_items ri ON ri.recipe_id = r.id
    LEFT JOIN inventory_items i ON i.id = ri.item_id
    WHERE r.restaurant_id = $1 AND r.product_id = $2
    GROUP BY r.id, p.name, p.price
    LIMIT 1
  `;
  const res = await pool.query(query, [restaurantId, productId]);
  if (res.rows.length === 0) return null;
  const r = res.rows[0];
  return {
    ...r,
    yield_servings: Number(r.yield_servings),
    total_cost: Number(r.total_cost || 0),
    items: r.items || [],
  };
}

export async function upsertRecipe(
  restaurantId: string,
  data: {
    product_id: string;
    instructions?: string;
    yield_servings?: number;
    items: {
      item_id: string;
      quantity: number;
      unit: string;
      notes?: string;
    }[];
  }
): Promise<Recipe> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Create or update recipes parent
    const recRes = await client.query(
      `INSERT INTO recipes (restaurant_id, product_id, instructions, yield_servings)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (restaurant_id, product_id) DO UPDATE
       SET instructions = EXCLUDED.instructions,
           yield_servings = EXCLUDED.yield_servings,
           updated_at = NOW()
       RETURNING id`,
      [
        restaurantId,
        data.product_id,
        data.instructions?.trim() || null,
        Number(data.yield_servings || 1),
      ]
    );
    const recipeId = recRes.rows[0].id;

    // 2. Replace recipe_items
    await client.query(`DELETE FROM recipe_items WHERE recipe_id = $1`, [recipeId]);

    for (const item of data.items) {
      if (item.item_id && Number(item.quantity) > 0) {
        await client.query(
          `INSERT INTO recipe_items (recipe_id, item_id, quantity, unit, notes)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            recipeId,
            item.item_id,
            Number(item.quantity),
            item.unit || 'kg',
            item.notes?.trim() || null,
          ]
        );
      }
    }

    await client.query('COMMIT');
    return (await getRecipeByProductId(restaurantId, data.product_id))!;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ============================================================
// 8. ORDER-BASED INVENTORY AUTO-DEDUCTION (BOM CONSUMPTION)
// ============================================================

export async function deductInventoryForOrder(
  clientOrPool: any,
  restaurantId: string,
  orderId: string,
  orderItems: { product_id: string; quantity: number }[]
) {
  try {
    // 1. Group quantities by product_id
    const prodMap = new Map<string, number>();
    for (const oi of orderItems) {
      const q = Number(oi.quantity);
      if (oi.product_id && q > 0) {
        prodMap.set(oi.product_id, (prodMap.get(oi.product_id) || 0) + q);
      }
    }

    const productIds = Array.from(prodMap.keys());
    if (productIds.length === 0) return;

    // 2. Fetch recipes for these products
    const recipesRes = await clientOrPool.query(
      `SELECT r.id AS recipe_id, r.product_id, r.yield_servings,
              ri.item_id, ri.quantity::float AS portion_qty, ri.unit
       FROM recipes r
       JOIN recipe_items ri ON ri.recipe_id = r.id
       WHERE r.restaurant_id = $1 AND r.product_id = ANY($2::uuid[])`,
      [restaurantId, productIds]
    );

    if (recipesRes.rows.length === 0) {
      // No recipes configured for these menu items; skip BOM deduction
      return;
    }

    // 3. Aggregate total ingredient requirement across all ordered menu products
    // ingredientId -> requiredQty
    const ingredientReqMap = new Map<string, number>();
    for (const row of recipesRes.rows) {
      const orderedCount = prodMap.get(row.product_id) || 0;
      const servings = Math.max(1, Number(row.yield_servings || 1));
      const needed = (orderedCount * row.portion_qty) / servings;

      ingredientReqMap.set(
        row.item_id,
        (ingredientReqMap.get(row.item_id) || 0) + needed
      );
    }

    // 4. Lock each required ingredient row, deduct stock, and write stock_movement
    for (const [itemId, deductQty] of ingredientReqMap.entries()) {
      if (deductQty <= 0) continue;

      const itemRes = await clientOrPool.query(
        `SELECT id, name, unit, current_stock, cost_per_unit
         FROM inventory_items
         WHERE restaurant_id = $1 AND id = $2
         FOR UPDATE`,
        [restaurantId, itemId]
      );
      if (itemRes.rows.length === 0) continue;

      const ing = itemRes.rows[0];
      const prevStock = Number(ing.current_stock);
      const newStock = prevStock - deductQty;
      const unitCost = Number(ing.cost_per_unit);
      const totalCost = Math.round(deductQty * unitCost * 100) / 100;

      // Update inventory_items
      await clientOrPool.query(
        `UPDATE inventory_items
         SET current_stock = $1, updated_at = NOW()
         WHERE id = $2`,
        [newStock, itemId]
      );

      // Record immutable stock movement
      await clientOrPool.query(
        `INSERT INTO stock_movements (
          restaurant_id, item_id, movement_type, quantity, balance_after,
          unit_cost, total_cost, reference_type, reference_id, reason
        ) VALUES ($1, $2, 'CONSUMPTION', $3, $4, $5, $6, 'ORDER', $7, $8)`,
        [
          restaurantId,
          itemId,
          -deductQty,
          newStock,
          unitCost,
          totalCost,
          orderId,
          `Order #${orderId.slice(-6)} consumption`,
        ]
      );
    }
  } catch (err) {
    console.error('Error during order inventory auto-deduction:', err);
    // Let caller handle or log without crashing user order if appropriate
  }
}

// ============================================================
// 9. INVENTORY REPORTS
// ============================================================

export async function getInventoryReports(
  restaurantId: string,
  filters: {
    date_from?: string;
    date_to?: string;
  } = {}
) {
  const dateFrom = filters.date_from || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
  const dateTo = filters.date_to || new Date().toISOString().split('T')[0];

  // 1. Stock Valuation Report
  const valuationRes = await pool.query(
    `SELECT
      i.id, i.name, c.name AS category, i.unit,
      i.current_stock::float, i.cost_per_unit::float,
      (i.current_stock * i.cost_per_unit)::float AS total_value,
      CASE
        WHEN i.current_stock <= 0 THEN 'Out of Stock'
        WHEN i.current_stock <= i.min_stock THEN 'Low Stock'
        ELSE 'Normal'
      END AS status
     FROM inventory_items i
     LEFT JOIN inventory_categories c ON c.id = i.category_id
     WHERE i.restaurant_id = $1 AND i.is_active = true
     ORDER BY total_value DESC`,
    [restaurantId]
  );

  // 2. Consumption Ledger Report
  const consumptionRes = await pool.query(
    `SELECT
      i.id, i.name, i.unit,
      COALESCE(SUM(sm.quantity) FILTER (WHERE sm.movement_type = 'PURCHASE'), 0)::float AS purchased_qty,
      COALESCE(ABS(SUM(sm.quantity) FILTER (WHERE sm.movement_type = 'CONSUMPTION')), 0)::float AS consumed_qty,
      COALESCE(ABS(SUM(sm.quantity) FILTER (WHERE sm.movement_type = 'WASTAGE')), 0)::float AS wastage_qty,
      COALESCE(SUM(sm.quantity) FILTER (WHERE sm.movement_type = 'ADJUSTMENT'), 0)::float AS adjustment_qty,
      i.current_stock::float AS closing_stock,
      COALESCE(ABS(SUM(sm.total_cost) FILTER (WHERE sm.movement_type = 'CONSUMPTION')), 0)::float AS consumed_value
     FROM inventory_items i
     LEFT JOIN stock_movements sm ON sm.item_id = i.id
       AND sm.created_at >= $2::date
       AND sm.created_at <= ($3::date + INTERVAL '1 day')
     WHERE i.restaurant_id = $1 AND i.is_active = true
     GROUP BY i.id, i.name, i.unit, i.current_stock
     ORDER BY consumed_value DESC`,
    [restaurantId, dateFrom, dateTo]
  );

  // 3. Wastage by Reason
  const wastageRes = await pool.query(
    `SELECT
      reason,
      COUNT(*)::int AS count,
      COALESCE(SUM(total_cost), 0)::float AS total_loss,
      COALESCE(SUM(quantity), 0)::float AS total_qty
     FROM wastages
     WHERE restaurant_id = $1
       AND logged_at >= $2::date
       AND logged_at <= ($3::date + INTERVAL '1 day')
     GROUP BY reason
     ORDER BY total_loss DESC`,
    [restaurantId, dateFrom, dateTo]
  );

  // 4. Valuation by Category
  const categoryValuationRes = await pool.query(
    `SELECT
      COALESCE(c.name, 'Uncategorized') AS category,
      COUNT(i.id)::int AS items_count,
      COALESCE(SUM(i.current_stock * i.cost_per_unit), 0)::float AS total_value
     FROM inventory_items i
     LEFT JOIN inventory_categories c ON c.id = i.category_id
     WHERE i.restaurant_id = $1 AND i.is_active = true
     GROUP BY c.name
     ORDER BY total_value DESC`,
    [restaurantId]
  );

  return {
    date_from: dateFrom,
    date_to: dateTo,
    valuation_report: valuationRes.rows,
    consumption_report: consumptionRes.rows,
    wastage_by_reason: wastageRes.rows,
    category_valuation: categoryValuationRes.rows,
  };
}
