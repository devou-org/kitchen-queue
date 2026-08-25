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
  active_orders_count?: number;
  active_orders?: any[];
}

export class TablesRepository {
  /**
   * Fetch all tables for a restaurant with live active order statistics
   */
  static async getTablesByRestaurant(restaurantId: string): Promise<RestaurantTable[]> {
    const res = await pool.query(
      `SELECT 
         t.*,
         COALESCE(active.active_orders_count, 0)::int as active_orders_count,
         COALESCE(active.orders_json, '[]'::json) as active_orders
       FROM restaurant_tables t
       LEFT JOIN (
         SELECT 
           restaurant_id,
           table_number,
           COUNT(*)::int as active_orders_count,
           json_agg(
             json_build_object(
               'id', id,
               'ticket_number', ticket_number,
               'customer_name', customer_name,
               'phone', phone,
               'total_price', total_price,
               'status', status,
               'pending_at', pending_at,
               'preparing_at', preparing_at,
               'ready_at', ready_at,
               'paid_at', paid_at,
               'created_at', created_at
             ) ORDER BY created_at DESC
           ) as orders_json
         FROM orders
         WHERE restaurant_id = $1
           AND status NOT IN ('PAID', 'CANCELLED')
           AND table_number IS NOT NULL AND table_number != ''
         GROUP BY restaurant_id, table_number
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
      const computedStatus: 'AVAILABLE' | 'OCCUPIED' = activeCount > 0 ? 'OCCUPIED' : 'AVAILABLE';

      // Auto-heal table status in DB if out of sync with active orders count
      if (r.status !== computedStatus) {
        pool.query(
          `UPDATE restaurant_tables SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
          [computedStatus, r.id]
        ).catch(err => console.error('Failed to sync table status in DB:', err));
      }

      tables.push({
        ...r,
        status: computedStatus,
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
   * Update table details (capacity, status, qr_code_url)
   */
  static async updateTable(
    tableId: string,
    restaurantId: string,
    data: { capacity?: number; status?: 'AVAILABLE' | 'OCCUPIED'; qr_code_url?: string }
  ): Promise<RestaurantTable | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

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

    return res.rows[0] || null;
  }

  /**
   * Delete table
   */
  static async deleteTable(tableId: string, restaurantId: string): Promise<boolean> {
    const res = await pool.query(
      `DELETE FROM restaurant_tables WHERE id = $1 AND restaurant_id = $2 RETURNING id`,
      [tableId, restaurantId]
    );
    return (res.rowCount ?? 0) > 0;
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
         AND status NOT IN ('PAID', 'CANCELLED')`,
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
