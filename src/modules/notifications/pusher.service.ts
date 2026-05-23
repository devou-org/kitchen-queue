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
    // We don't use the DB table for channels anymore, we just return the standard format
    // This fixes the mismatch between frontend and backend channels

    // Fallback/Create on demand if it doesn't exist
    // We will just use the standard queue-channel format to match the frontend
    const newChannelName = `queue-channel-${restaurantId}`;
    
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
