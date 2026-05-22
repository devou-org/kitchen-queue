import { Pool } from '@neondatabase/serverless';
import { pusherServer } from '@/lib/pusher';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export class PusherService {
  /**
   * Retrieves or creates a specific channel for a restaurant by type
   * @param restaurantId UUID of the restaurant
   * @param channelType 'QUEUE', 'ORDERS', 'KITCHEN'
   */
  static async getChannelName(restaurantId: string, channelType: string): Promise<string> {
    const res = await pool.query(`
      SELECT channel_name FROM restaurant_channels
      WHERE restaurant_id = $1 AND channel_type = $2
      LIMIT 1
    `, [restaurantId, channelType]);

    if (res.rowCount > 0) {
      return res.rows[0].channel_name;
    }

    // Fallback/Create on demand if it doesn't exist
    const newChannelName = `private-${channelType.toLowerCase()}-${restaurantId}`;
    
    await pool.query(`
      INSERT INTO restaurant_channels (restaurant_id, channel_name, channel_type)
      VALUES ($1, $2, $3)
      ON CONFLICT (restaurant_id, channel_type) DO NOTHING
    `, [restaurantId, newChannelName, channelType]);

    return newChannelName;
  }

  /**
   * Emits an event to a dynamically resolved restaurant channel
   */
  static async emitToRestaurant(
    restaurantId: string, 
    channelType: 'QUEUE' | 'ORDERS' | 'KITCHEN', 
    eventName: string, 
    data: any
  ) {
    try {
      const channelName = await this.getChannelName(restaurantId, channelType);
      await pusherServer.trigger(channelName, eventName, data);
      console.log(`[Pusher Emit] ${eventName} to ${channelName}`);
    } catch (error) {
      console.error(`[Pusher Error] Failed to emit to ${restaurantId}`, error);
    }
  }
}
