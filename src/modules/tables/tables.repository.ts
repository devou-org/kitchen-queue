import { pool } from '@/lib/db';

export interface RestaurantTable {
  id: string;
  restaurant_id: string;
  table_number: string;
  capacity: number;
  status: 'AVAILABLE' | 'OCCUPIED';
  qr_code_url: string | null;
  created_at: string;
  updated_at: string;
  merged_into_table_id?: string | null;
  parent_table_number?: string | null;
  effective_capacity?: number;
  merged_table_numbers?: string[];
  merged_table_ids?: string[];
  merged_children?: { id: string; table_number: string; capacity: number }[];
  active_orders_count?: number;
  active_orders?: any[];
}

let schemaEnsured = false;

export class TablesRepository {
  /**
   * Auto-migrate missing columns for table merge support
   */
  static async ensureSchema(): Promise<void> {
    try {
      await pool.query(`
        ALTER TABLE restaurant_tables
        ADD COLUMN IF NOT EXISTS merged_into_table_id UUID REFERENCES restaurant_tables(id) ON DELETE SET NULL;

        CREATE INDEX IF NOT EXISTS idx_restaurant_tables_merged_into 
        ON restaurant_tables(restaurant_id, merged_into_table_id) 
        WHERE merged_into_table_id IS NOT NULL;
      `);
      console.log('✅ Auto-migrated merged_into_table_id column and index on restaurant_tables');
      schemaEnsured = true;
    } catch (err) {
      console.error('❌ ensureSchema failed:', err);
    }
  }

  /**
   * Fetch all tables for a restaurant with live active order statistics and merged status
   */
  static async getTablesByRestaurant(restaurantId: string): Promise<RestaurantTable[]> {
    if (!schemaEnsured) {
      await this.ensureSchema();
    }

    try {
      return await this._fetchTablesQuery(restaurantId);
    } catch (error: any) {
      if (error?.message?.includes('merged_into_table_id') || error?.message?.includes('does not exist')) {
        console.log('⚠️ Missing merged_into_table_id column detected. Running ensureSchema...');
        await this.ensureSchema();
        return await this._fetchTablesQuery(restaurantId);
      }
      throw error;
    }
  }

  private static async _fetchTablesQuery(restaurantId: string): Promise<RestaurantTable[]> {
    const res = await pool.query(
      `SELECT 
         t.*,
         parent.table_number as parent_table_number,
         parent.status as parent_status,
         (t.capacity + COALESCE(children.extra_capacity, 0))::int as effective_capacity,
         COALESCE(children.merged_numbers, '[]'::json) as merged_table_numbers,
         COALESCE(children.merged_ids, '[]'::json) as merged_table_ids,
         COALESCE(children.merged_children, '[]'::json) as merged_children,
         COALESCE(active.active_orders_count, 0)::int as active_orders_count,
         COALESCE(active.orders_json, '[]'::json) as active_orders
       FROM restaurant_tables t
       LEFT JOIN restaurant_tables parent ON parent.id = t.merged_into_table_id
       LEFT JOIN LATERAL (
         SELECT 
           SUM(c.capacity)::int as extra_capacity,
           json_agg(c.table_number ORDER BY c.table_number) as merged_numbers,
           json_agg(c.id) as merged_ids,
           json_agg(
             json_build_object(
               'id', c.id,
               'table_number', c.table_number,
               'capacity', c.capacity
             ) ORDER BY c.table_number
           ) as merged_children
         FROM restaurant_tables c
         WHERE c.merged_into_table_id = t.id
       ) children ON true
       LEFT JOIN (
         SELECT 
           o.restaurant_id,
           o.table_number,
           COUNT(DISTINCT o.id)::int as active_orders_count,
           json_agg(
             json_build_object(
               'id', o.id,
               'ticket_number', o.ticket_number,
               'customer_name', o.customer_name,
               'phone', o.phone,
               'party_size', o.party_size,
               'total_price', o.total_price,
               'subtotal', o.subtotal,
               'gst_amount', o.gst_amount,
               'gst_rate', o.gst_rate,
               'gst_type', o.gst_type,
               'status', o.status,
               'order_type', o.order_type,
               'notes', o.notes,
               'is_paid', o.is_paid,
               'payment_method', o.payment_method,
                'payment_split', o.payment_split,
                'table_number', o.table_number,
                'discount_amount', o.discount_amount,
               'pending_at', o.pending_at,
               'preparing_at', o.preparing_at,
               'ready_at', o.ready_at,
               'paid_at', o.paid_at,
               'created_at', o.created_at,
               'items', COALESCE(items_sub.items_json, '[]'::json)
             ) ORDER BY o.created_at DESC
           ) as orders_json
         FROM orders o
         LEFT JOIN LATERAL (
           SELECT json_agg(
             json_build_object(
               'id', oi.id,
               'product_id', oi.product_id,
               'quantity', oi.quantity,
               'price_at_purchase', oi.price_at_purchase,
               'product_name', p.name,
               'counter', p.counter,
                'status', oi.status
             ) ORDER BY oi.id ASC
           ) as items_json
           FROM order_items oi
           LEFT JOIN products p ON p.id = oi.product_id
           WHERE oi.order_id = o.id
         ) items_sub ON true
         WHERE o.restaurant_id = $1
           AND o.status NOT IN ('CLOSED', 'CANCELLED', 'EXPIRED')
           AND o.table_number IS NOT NULL AND o.table_number != ''
           AND (o.order_type IS NULL OR o.order_type NOT IN ('TAKEAWAY', 'DELIVERY'))
         GROUP BY o.restaurant_id, o.table_number
       ) active ON active.table_number = t.table_number
       WHERE t.restaurant_id = $1
       ORDER BY 
         CASE 
           WHEN t.table_number ~ '^[0-9]+$' THEN t.table_number::integer 
           ELSE 999999 
         END ASC, 
         t.table_number ASC`,
      [restaurantId]
    );

    const tables: RestaurantTable[] = [];

    for (const r of res.rows) {
      const activeCount = Number(r.active_orders_count || 0);
      let computedStatus: 'AVAILABLE' | 'OCCUPIED';

      if (r.merged_into_table_id) {
        // Child table status mirrors its parent's status
        computedStatus = (r.parent_status === 'OCCUPIED' || activeCount > 0) ? 'OCCUPIED' : 'AVAILABLE';
      } else {
        computedStatus = activeCount > 0 ? 'OCCUPIED' : 'AVAILABLE';
      }

      // Auto-heal table status in DB if out of sync
      if (r.status !== computedStatus) {
        pool.query(
          `UPDATE restaurant_tables SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
          [computedStatus, r.id]
        ).catch(err => console.error('Failed to sync table status in DB:', err));
      }

      tables.push({
        ...r,
        status: computedStatus,
        effective_capacity: Number(r.effective_capacity || r.capacity || 4),
        merged_table_numbers: Array.isArray(r.merged_table_numbers) ? r.merged_table_numbers : [],
        merged_table_ids: Array.isArray(r.merged_table_ids) ? r.merged_table_ids : [],
        merged_children: Array.isArray(r.merged_children) ? r.merged_children : [],
        active_orders_count: activeCount,
        active_orders: r.active_orders || []
      });
    }

    return tables;
  }

  /**
   * Get single table by ID
   */
  static async getTableById(tableId: string, restaurantId: string): Promise<RestaurantTable | null> {
    const res = await pool.query(
      `SELECT * FROM restaurant_tables WHERE id = $1 AND restaurant_id = $2 LIMIT 1`,
      [tableId, restaurantId]
    );
    return res.rows[0] || null;
  }

  /**
   * Get single table by table number
   */
  static async getTableByNumber(restaurantId: string, tableNumber: string): Promise<RestaurantTable | null> {
    const res = await pool.query(
      `SELECT * FROM restaurant_tables WHERE restaurant_id = $1 AND table_number = $2 LIMIT 1`,
      [restaurantId, tableNumber]
    );
    return res.rows[0] || null;
  }

  /**
   * Create a new table
   */
  static async createTable(data: {
    restaurant_id: string;
    table_number: string;
    capacity: number;
    qr_code_url?: string;
  }): Promise<RestaurantTable> {
    const res = await pool.query(
      `INSERT INTO restaurant_tables (restaurant_id, table_number, capacity, qr_code_url)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [data.restaurant_id, data.table_number.trim(), data.capacity || 4, data.qr_code_url || null]
    );
    return res.rows[0];
  }

  /**
   * Update table details (table_number, capacity, status, qr_code_url)
   */
  static async updateTable(
    tableId: string,
    restaurantId: string,
    data: {
      table_number?: string;
      capacity?: number;
      status?: 'AVAILABLE' | 'OCCUPIED';
      qr_code_url?: string;
      old_table_number?: string;
    }
  ): Promise<RestaurantTable | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (data.table_number !== undefined) {
      fields.push(`table_number = $${idx++}`);
      values.push(data.table_number);
    }

    if (data.capacity !== undefined) {
      fields.push(`capacity = $${idx++}`);
      values.push(data.capacity);
    }

    if (data.status !== undefined) {
      fields.push(`status = $${idx++}`);
      values.push(data.status);
    }

    if (data.qr_code_url !== undefined) {
      fields.push(`qr_code_url = $${idx++}`);
      values.push(data.qr_code_url);
    }

    if (fields.length === 0) return null;

    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(tableId);
    values.push(restaurantId);

    const res = await pool.query(
      `UPDATE restaurant_tables
       SET ${fields.join(', ')}
       WHERE id = $${idx++} AND restaurant_id = $${idx++}
       RETURNING *`,
      values
    );

    const updated = res.rows[0] || null;

    // If table_number changed, update active orders to match new table_number
    if (updated && data.old_table_number && data.table_number) {
      await pool.query(
        `UPDATE orders
         SET table_number = $1
         WHERE restaurant_id = $2 AND table_number = $3 AND status NOT IN ('CLOSED', 'CANCELLED', 'EXPIRED')`,
        [data.table_number, restaurantId, data.old_table_number]
      ).catch(err => console.error('Failed to update orders table_number:', err));
    }

    return updated;
  }

  /**
   * Delete table
   */
  static async deleteTable(tableId: string, restaurantId: string): Promise<boolean> {
    // Check if table has merged children
    const childCheck = await pool.query(
      `SELECT table_number FROM restaurant_tables WHERE merged_into_table_id = $1 AND restaurant_id = $2`,
      [tableId, restaurantId]
    );
    if (childCheck.rowCount && childCheck.rowCount > 0) {
      const childNums = childCheck.rows.map(r => r.table_number).join(', ');
      throw new Error(`Cannot delete this table because Table(s) #${childNums} are merged into it. Please unmerge them first.`);
    }

    const res = await pool.query(
      `DELETE FROM restaurant_tables WHERE id = $1 AND restaurant_id = $2 RETURNING id`,
      [tableId, restaurantId]
    );
    return (res.rowCount ?? 0) > 0;
  }

  /**
   * Merge one or more secondary tables into a primary table
   */
  static async mergeTables(
    restaurantId: string,
    primaryTableId: string,
    secondaryTableIds: string[]
  ): Promise<{ success: boolean; primaryTable: RestaurantTable; mergedTables: RestaurantTable[] }> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Fetch primary table
      const primaryRes = await client.query(
        `SELECT * FROM restaurant_tables WHERE id = $1 AND restaurant_id = $2 FOR UPDATE`,
        [primaryTableId, restaurantId]
      );
      const primaryTable = primaryRes.rows[0];
      if (!primaryTable) throw new Error('Primary table not found');

      if (primaryTable.merged_into_table_id) {
        throw new Error('A secondary merged table cannot be chosen as a primary table. Unmerge it first.');
      }

      // 2. Fetch secondary tables
      const secRes = await client.query(
        `SELECT * FROM restaurant_tables WHERE id = ANY($1::uuid[]) AND restaurant_id = $2 FOR UPDATE`,
        [secondaryTableIds, restaurantId]
      );
      const secondaryTables = secRes.rows;
      if (secondaryTables.length !== secondaryTableIds.length) {
        throw new Error('One or more secondary tables were not found');
      }

      for (const st of secondaryTables) {
        if (st.id === primaryTableId) {
          throw new Error('Cannot merge a table into itself');
        }
        // If secondary table is already a parent of other tables, prevent multi-level nesting
        const childCheck = await client.query(
          `SELECT 1 FROM restaurant_tables WHERE merged_into_table_id = $1 LIMIT 1`,
          [st.id]
        );
        if (childCheck.rowCount && childCheck.rowCount > 0) {
          throw new Error(`Table #${st.table_number} already has other tables merged into it. Please unmerge it first.`);
        }
      }

      // 3. Mark secondary tables as merged into primary
      await client.query(
        `UPDATE restaurant_tables 
         SET merged_into_table_id = $1, updated_at = CURRENT_TIMESTAMP 
         WHERE id = ANY($2::uuid[]) AND restaurant_id = $3`,
        [primaryTableId, secondaryTableIds, restaurantId]
      );

      // 4. Consolidate any active orders from secondary tables to the primary table
      const secTableNumbers = secondaryTables.map(st => st.table_number);
      await client.query(
        `UPDATE orders 
         SET table_number = $1, table_id = $2, updated_at = CURRENT_TIMESTAMP
         WHERE restaurant_id = $3 
           AND table_number = ANY($4::varchar[]) 
           AND status NOT IN ('CLOSED', 'CANCELLED', 'EXPIRED')`,
        [primaryTable.table_number, primaryTable.id, restaurantId, secTableNumbers]
      );

      // 5. If primary has active orders or any secondary table had active orders, update status
      const activeCheck = await client.query(
        `SELECT COUNT(*)::int as count FROM orders 
         WHERE restaurant_id = $1 AND table_number = $2 AND status NOT IN ('CLOSED', 'CANCELLED', 'EXPIRED')`,
        [restaurantId, primaryTable.table_number]
      );
      const hasActive = Number(activeCheck.rows[0]?.count || 0) > 0;
      const newStatus = hasActive ? 'OCCUPIED' : 'AVAILABLE';

      await client.query(
        `UPDATE restaurant_tables 
         SET status = $1, updated_at = CURRENT_TIMESTAMP 
         WHERE restaurant_id = $2 AND (id = $3 OR id = ANY($4::uuid[]))`,
        [newStatus, restaurantId, primaryTableId, secondaryTableIds]
      );

      await client.query('COMMIT');
      return { success: true, primaryTable, mergedTables: secondaryTables };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Unmerge a table:
   * If tableId is a primary table, all secondary tables merged into it are detached.
   * If tableId is a secondary table, only that secondary table is detached.
   */
  static async unmergeTable(
    restaurantId: string,
    tableId: string
  ): Promise<{ success: boolean; unmergedCount: number }> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Check if table is primary (has children) or secondary (has parent)
      const targetRes = await client.query(
        `SELECT * FROM restaurant_tables WHERE id = $1 AND restaurant_id = $2 FOR UPDATE`,
        [tableId, restaurantId]
      );
      const targetTable = targetRes.rows[0];
      if (!targetTable) throw new Error('Table not found');

      let unmergedIds: string[] = [];

      if (targetTable.merged_into_table_id) {
        // It is a secondary table: unmerge just this table
        await client.query(
          `UPDATE restaurant_tables 
           SET merged_into_table_id = NULL, updated_at = CURRENT_TIMESTAMP 
           WHERE id = $1 AND restaurant_id = $2`,
          [tableId, restaurantId]
        );
        unmergedIds = [tableId];
      } else {
        // It might be a primary table with children
        const childrenRes = await client.query(
          `SELECT id FROM restaurant_tables WHERE merged_into_table_id = $1 AND restaurant_id = $2`,
          [tableId, restaurantId]
        );
        unmergedIds = childrenRes.rows.map(r => r.id);

        if (unmergedIds.length > 0) {
          await client.query(
            `UPDATE restaurant_tables 
             SET merged_into_table_id = NULL, updated_at = CURRENT_TIMESTAMP 
             WHERE merged_into_table_id = $1 AND restaurant_id = $2`,
            [tableId, restaurantId]
          );
        }
      }

      // Re-evaluate occupancy for detached tables
      for (const id of unmergedIds) {
        const tRes = await client.query(`SELECT table_number FROM restaurant_tables WHERE id = $1`, [id]);
        const num = tRes.rows[0]?.table_number;
        if (num) {
          const activeRes = await client.query(
            `SELECT COUNT(*)::int as count FROM orders 
             WHERE restaurant_id = $1 AND table_number = $2 AND status NOT IN ('CLOSED', 'CANCELLED', 'EXPIRED')`,
            [restaurantId, num]
          );
          const actCount = Number(activeRes.rows[0]?.count || 0);
          const st = actCount > 0 ? 'OCCUPIED' : 'AVAILABLE';
          await client.query(
            `UPDATE restaurant_tables SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
            [st, id]
          );
        }
      }

      // Also re-evaluate target table itself
      const activeRes = await client.query(
        `SELECT COUNT(*)::int as count FROM orders 
         WHERE restaurant_id = $1 AND table_number = $2 AND status NOT IN ('CLOSED', 'CANCELLED', 'EXPIRED')`,
        [restaurantId, targetTable.table_number]
      );
      const actCount = Number(activeRes.rows[0]?.count || 0);
      const st = actCount > 0 ? 'OCCUPIED' : 'AVAILABLE';
      await client.query(
        `UPDATE restaurant_tables SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
        [st, targetTable.id]
      );

      await client.query('COMMIT');
      return { success: true, unmergedCount: unmergedIds.length };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Re-evaluate table occupancy status based on remaining active orders
   */
  static async reevaluateOccupancy(restaurantId: string, tableNumber: string): Promise<'AVAILABLE' | 'OCCUPIED'> {
    if (!tableNumber) return 'AVAILABLE';

    const activeRes = await pool.query(
      `SELECT COUNT(*)::int as active_count
       FROM orders
       WHERE restaurant_id = $1
         AND table_number = $2
         AND status NOT IN ('CLOSED', 'CANCELLED', 'EXPIRED')
         AND (order_type IS NULL OR order_type != 'TAKEAWAY')`,
      [restaurantId, tableNumber]
    );

    const activeCount = Number(activeRes.rows[0]?.active_count || 0);
    const newStatus: 'AVAILABLE' | 'OCCUPIED' = activeCount > 0 ? 'OCCUPIED' : 'AVAILABLE';

    await pool.query(
      `UPDATE restaurant_tables
       SET status = $1, updated_at = CURRENT_TIMESTAMP
       WHERE restaurant_id = $2 AND table_number = $3`,
      [newStatus, restaurantId, tableNumber]
    );

    return newStatus;
  }
}
