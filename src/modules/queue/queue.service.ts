import { Pool } from 'pg';

// Note: Use a dedicated Pool instance if transactions are heavily used.
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export interface JoinQueueParams {
  restaurantId: string;
  name: string;
  phone: string;
  partySize: number;
  notes?: string;
  queueType?: string;
}

export class QueueService {
  /**
   * Joins the queue for a given restaurant.
   * Ensures users are created if they don't exist and safely enqueues them using a transaction.
   */
  static async joinQueue(params: JoinQueueParams) {
    const { restaurantId, name, phone, partySize, notes, queueType = 'WALK_IN' } = params;

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // 1. Insert or get user
      // We use FOR UPDATE on the user row if we need to lock it, but INSERT ON CONFLICT DO UPDATE is safer for concurrency
      const userRes = await client.query(`
        INSERT INTO users (name, phone, role)
        VALUES ($1, $2, 'USER')
        ON CONFLICT (phone) DO UPDATE SET name = EXCLUDED.name
        RETURNING id
      `, [name, phone]);

      const userId = userRes.rows[0].id;

      // Check if user is already in queue
      const existingQueueRes = await client.query(`
        SELECT q.*, qs.possible_queue_status 
        FROM queues q
        JOIN queue_status qs ON q.queue_status_id = qs.id
        WHERE q.user_id = $1 
          AND q.restaurant_id = $2 
          AND q.queue_type = $3
          AND (q.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::DATE = (CURRENT_TIMESTAMP AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::DATE
        ORDER BY q.created_at DESC LIMIT 1
      `, [userId, restaurantId, queueType]);

      if (existingQueueRes.rows.length > 0) {
        const existingQueue = existingQueueRes.rows[0];

        // If the most recent ticket is not in a terminal state, return it instead of creating a new one
        const inactiveStatuses = ['SEATED', 'CANCELLED', 'COMPLETED'];
        if (!inactiveStatuses.includes(existingQueue.possible_queue_status)) {
          // Calculate current position (how many people in the first status have a smaller token number)
          const waitTimeRes = await client.query(`
            SELECT COUNT(*) as queue_length 
            FROM queues q
            JOIN queue_status qs ON q.queue_status_id = qs.id
            WHERE q.restaurant_id = $1 
              AND qs.possible_queue_status = (
                SELECT possible_queue_status FROM queue_status WHERE restaurant_id = $1 ORDER BY priority ASC, id ASC LIMIT 1
              )
              AND (q.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::DATE = (CURRENT_TIMESTAMP AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::DATE
              AND q.token_number < $2
          `, [restaurantId, existingQueue.token_number]);

          const queueLength = parseInt(waitTimeRes.rows[0].queue_length, 10);
          existingQueue.position = existingQueue.queue_status_id ? (queueLength + 1) : 0;

          await client.query('COMMIT');
          return existingQueue;
        }
      }

      // 2. Get the default first status id for this restaurant
      const statusRes = await client.query(`
        SELECT id FROM queue_status 
        WHERE restaurant_id = $1
        ORDER BY priority ASC, id ASC
        LIMIT 1
      `, [restaurantId]);

      if (statusRes.rowCount === 0) {
        throw new Error('No queue statuses configured for this restaurant');
      }

      const waitingStatusId = statusRes.rows[0].id;

      // Lock the restaurant row to prevent concurrent token number generation
      await client.query(`SELECT id FROM restaurants WHERE id = $1 FOR UPDATE`, [restaurantId]);

      // 3. Get next token number
      const tokenRes = await client.query(`
        SELECT COALESCE(MAX(token_number), 0) + 1 AS next_token 
        FROM queues 
        WHERE restaurant_id = $1 AND (created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::DATE = (CURRENT_TIMESTAMP AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::DATE
      `, [restaurantId]);

      const nextToken = tokenRes.rows[0].next_token;

      // Calculate position in queue
      const waitTimeRes = await client.query(`
        SELECT COUNT(*) as queue_length 
        FROM queues 
        WHERE restaurant_id = $1 AND queue_status_id = $2 AND (created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::DATE = (CURRENT_TIMESTAMP AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::DATE
      `, [restaurantId, waitingStatusId]);

      const queueLength = parseInt(waitTimeRes.rows[0].queue_length, 10);
      const position = queueLength + 1; // Their position in the queue

      // 4. Insert into queues
      const queueRes = await client.query(`
        INSERT INTO queues (
          restaurant_id, user_id, queue_status_id, token_number, 
          queue_type, party_size, estimated_wait_time, notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *, (REPLACE(created_at::text, ' ', 'T') || 'Z') as created_at_iso
      `, [
        restaurantId, userId, waitingStatusId, nextToken,
        queueType, partySize, null, notes
      ]);

      await client.query('COMMIT');

      const newQueue = queueRes.rows[0];
      newQueue.position = position;
      if (newQueue.created_at_iso) {
        newQueue.created_at = newQueue.created_at_iso;
        delete newQueue.created_at_iso;
      }

      import('../notifications/pusher.service').then(m => {
        m.PusherService.emitToRestaurant(restaurantId, 'QUEUE', 'queue_updated', { type: 'JOIN', queue: newQueue });
      });

      return newQueue;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Admin: Update queue status for a queue entry
   */
  static async updateQueueStatus(queueId: string, statusEnum: string, restaurantId: string) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const statusRes = await client.query(`
        SELECT id FROM queue_status 
        WHERE restaurant_id = $1 AND possible_queue_status = $2
        LIMIT 1
      `, [restaurantId, statusEnum]);

      if (statusRes.rowCount === 0) {
        throw new Error('Status not configured for this restaurant');
      }

      const statusId = statusRes.rows[0].id;

      const updateRes = await client.query(`
        UPDATE queues 
        SET queue_status_id = $1, updated_at = NOW()
        WHERE id = $2 AND restaurant_id = $3
        RETURNING *, (REPLACE(created_at::text, ' ', 'T') || 'Z') as created_at_iso
      `, [statusId, queueId, restaurantId]);

      await client.query('COMMIT');

      const updatedQueue = updateRes.rows[0];
      if (updatedQueue.created_at_iso) {
        updatedQueue.created_at = updatedQueue.created_at_iso;
        delete updatedQueue.created_at_iso;
      }
      import('../notifications/pusher.service').then(m => {
        m.PusherService.emitToRestaurant(restaurantId, 'QUEUE', 'queue_updated', { type: 'UPDATE', queue: updatedQueue });
      });

      return updatedQueue;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Super Admin: Add new custom queue status to a restaurant
   */
  static async addQueueStatus(restaurantId: string, statusEnum: string, color: string = '#cbd5e1', priority: number = 0) {
    try {
      await pool.query(`ALTER TABLE queue_status ALTER COLUMN possible_queue_status TYPE VARCHAR(50) USING possible_queue_status::text`);
      await pool.query(`ALTER TABLE queue_status ADD COLUMN IF NOT EXISTS color VARCHAR(20) DEFAULT '#cbd5e1'`);
      await pool.query(`ALTER TABLE queue_status ADD COLUMN IF NOT EXISTS priority INT DEFAULT 0`);
    } catch (e) { }

    const check = await pool.query(`SELECT id FROM queue_status WHERE restaurant_id = $1 AND possible_queue_status = $2`, [restaurantId, statusEnum]);

    if (check.rows.length > 0) {
      // It exists, let's update color and priority
      const updateRes = await pool.query(`
        UPDATE queue_status SET color = $3, priority = $4 WHERE restaurant_id = $1 AND possible_queue_status = $2 RETURNING *
      `, [restaurantId, statusEnum, color, priority]);
      return updateRes.rows[0];
    } else {
      const res = await pool.query(`
        INSERT INTO queue_status (restaurant_id, possible_queue_status, color, priority)
        VALUES ($1, $2, $3, $4) RETURNING *
      `, [restaurantId, statusEnum, color, priority]);
      return res.rows[0];
    }
  }

  /**
   * Admin: List today's queues
   */
  static async getQueues(restaurantId: string) {
    const res = await pool.query(`
      SELECT q.*, qs.possible_queue_status as queue_status, u.name as user_name, u.phone as user_phone,
             (REPLACE(q.created_at::text, ' ', 'T') || 'Z') as created_at
      FROM queues q
      JOIN queue_status qs ON q.queue_status_id = qs.id
      JOIN users u ON q.user_id = u.id
      WHERE q.restaurant_id = $1 
        AND (q.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::DATE = (CURRENT_TIMESTAMP AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::DATE
      ORDER BY q.token_number ASC
    `, [restaurantId]);
    return res.rows;
  }

  /**
   * Admin: List all configured statuses
   */
  static async getQueueStatuses(restaurantId: string) {
    const res = await pool.query(`
      SELECT * FROM queue_status WHERE restaurant_id = $1 ORDER BY priority ASC, id ASC
    `, [restaurantId]);
    return res.rows;
  }

  /**
   * Super Admin: Delete custom queue status
   */
  static async deleteQueueStatus(statusId: string, restaurantId: string) {
    try {
      const res = await pool.query(`
        DELETE FROM queue_status 
        WHERE id = $1 AND restaurant_id = $2
        RETURNING *
      `, [statusId, restaurantId]);
      return res.rows[0];
    } catch (error: any) {
      if (error.code === '23503') {
        throw new Error('Cannot delete this status because it is currently in use by active or past queue tickets.');
      }
      throw error;
    }
  }

  /**
   * Customer: Get queue status by token number
   */
  static async getQueueByToken(restaurantId: string, tokenNumber: number) {
    const res = await pool.query(`
      SELECT q.*, qs.possible_queue_status as queue_status, u.name as user_name, u.phone as user_phone,
             (REPLACE(q.created_at::text, ' ', 'T') || 'Z') as created_at,
      (
        SELECT COUNT(*)
        FROM queues q2
        JOIN queue_status qs2 ON q2.queue_status_id = qs2.id
        WHERE q2.restaurant_id = $1
          AND qs2.possible_queue_status = 'WAITING'
          AND (q2.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::DATE = (CURRENT_TIMESTAMP AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::DATE
          AND q2.token_number < q.token_number
      ) as wait_position
      FROM queues q
      JOIN queue_status qs ON q.queue_status_id = qs.id
      JOIN users u ON q.user_id = u.id
      WHERE q.restaurant_id = $1 
        AND q.token_number = $2 
        AND CAST(q.created_at AS DATE) = CURRENT_DATE
      LIMIT 1
    `, [restaurantId, tokenNumber]);

    if (res.rows.length === 0) return null;

    const queue = res.rows[0];
    queue.position = parseInt(queue.wait_position, 10) + 1;
    return queue;
  }

  /**
   * Customer: Get queue status by ID (UUID)
   */
  static async getQueueById(restaurantId: string, id: string) {
    const res = await pool.query(`
      SELECT q.*, qs.possible_queue_status as queue_status, u.name as user_name, u.phone as user_phone,
             (REPLACE(q.created_at::text, ' ', 'T') || 'Z') as created_at,
      (
        SELECT COUNT(*)
        FROM queues q2
        JOIN queue_status qs2 ON q2.queue_status_id = qs2.id
        WHERE q2.restaurant_id = $1
          AND qs2.possible_queue_status = 'WAITING'
          AND (q2.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::DATE = (CURRENT_TIMESTAMP AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::DATE
          AND q2.token_number < q.token_number
      ) as wait_position
      FROM queues q
      JOIN queue_status qs ON q.queue_status_id = qs.id
      JOIN users u ON q.user_id = u.id
      WHERE q.restaurant_id = $1 
        AND q.id = $2 
      LIMIT 1
    `, [restaurantId, id]);

    if (res.rows.length === 0) return null;

    const queue = res.rows[0];
    queue.position = parseInt(queue.wait_position, 10) + 1;
    return queue;
  }

  /**
   * Customer: Get active queue history by phone
   */
  static async getQueueHistory(restaurantId: string, phone: string) {
    const res = await pool.query(`
      SELECT q.*, qs.possible_queue_status as queue_status, u.name as user_name, u.phone as user_phone,
             (REPLACE(q.created_at::text, ' ', 'T') || 'Z') as created_at,
      (
        SELECT COUNT(*)
        FROM queues q2
        JOIN queue_status qs2 ON q2.queue_status_id = qs2.id
        WHERE q2.restaurant_id = $1
          AND qs2.possible_queue_status = 'WAITING'
          AND (q2.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::DATE = (CURRENT_TIMESTAMP AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::DATE
          AND q2.token_number < q.token_number
      ) as wait_position
      FROM queues q
      JOIN queue_status qs ON q.queue_status_id = qs.id
      JOIN users u ON q.user_id = u.id
      WHERE q.restaurant_id = $1 
        AND u.phone = $2
        AND q.queue_type = 'WALK_IN'
        AND (q.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::DATE = (CURRENT_TIMESTAMP AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::DATE
      ORDER BY q.created_at DESC
    `, [restaurantId, phone]);

    return res.rows.map(q => ({
      ...q,
      position: parseInt(q.wait_position, 10) + 1
    }));
  }
}
