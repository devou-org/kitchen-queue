import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export interface CreateOrderParams {
  restaurantId: string;
  userId?: string;
  queueId?: string;
  totalPrice: number;
  isPaid?: boolean;
  tableNumber?: string;
  notes?: string;
  items: { productId: string; quantity: number; priceAtPurchase: number }[];
}

export class OrdersService {
  /**
   * Creates a new order linked to a user and optionally a queue.
   */
  static async createOrder(params: CreateOrderParams) {
    const { restaurantId, userId, queueId, totalPrice, isPaid = false, tableNumber, notes, items } = params;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Lock the restaurant row to prevent concurrent token number generation
      await client.query(`SELECT id FROM restaurants WHERE id = $1 FOR UPDATE`, [restaurantId]);

      const ticketRes = await client.query(`
        SELECT COALESCE(MAX(ticket_number), 0) + 1 AS next_ticket 
        FROM orders 
        WHERE restaurant_id = $1 AND CAST(created_at AS DATE) = CURRENT_DATE
      `, [restaurantId]);
      
      const ticketNumber = ticketRes.rows[0].next_ticket;

      // 2. Insert into orders table
      const orderRes = await client.query(`
        INSERT INTO orders (
          restaurant_id, user_id, queue_id, ticket_number, 
          total_price, is_paid, table_number, notes, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'PENDING')
        RETURNING *
      `, [
        restaurantId, userId || null, queueId || null, ticketNumber, 
        totalPrice, isPaid, tableNumber, notes
      ]);

      const orderId = orderRes.rows[0].id;

      // 3. Insert order items
      for (const item of items) {
        await client.query(`
          INSERT INTO order_items (order_id, product_id, quantity, price_at_purchase)
          VALUES ($1, $2, $3, $4)
        `, [orderId, item.productId, item.quantity, item.priceAtPurchase]);
      }

      await client.query('COMMIT');
      
      const newOrder = orderRes.rows[0];
      import('../notifications/pusher.service').then(m => {
        m.PusherService.emitToRestaurant(restaurantId, 'ORDERS', 'order_created', { order: newOrder });
        m.PusherService.emitToRestaurant(restaurantId, 'KITCHEN', 'new_ticket', { order: newOrder });
      });

      return newOrder;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Fetches an order along with queue and user details
   */
  static async getOrderDetails(orderId: string, restaurantId: string) {
    const res = await pool.query(`
      SELECT 
        o.*,
        u.name AS user_name, u.phone AS user_phone,
        q.token_number, q.party_size,
        qs.possible_queue_status
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      LEFT JOIN queues q ON o.queue_id = q.id
      LEFT JOIN queue_status qs ON q.queue_status_id = qs.id
      WHERE o.id = $1 AND o.restaurant_id = $2
    `, [orderId, restaurantId]);

    return res.rows[0] || null;
  }
}
