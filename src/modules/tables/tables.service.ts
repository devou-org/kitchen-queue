import { TablesRepository, RestaurantTable } from './tables.repository';

export class TablesService {
  /**
   * Get all tables for a restaurant
   */
  static async getTables(restaurantId: string): Promise<RestaurantTable[]> {
    return await TablesRepository.getTablesByRestaurant(restaurantId);
  }

  /**
   * Create table with auto-generated QR code link
   */
  static async createTable(restaurantId: string, restaurantSlug: string, tableNumber: string, capacity: number): Promise<RestaurantTable> {
    const cleanTableNum = tableNumber.trim();
    
    // Check if table already exists
    const existing = await TablesRepository.getTableByNumber(restaurantId, cleanTableNum);
    if (existing) {
      throw new Error(`Table "${cleanTableNum}" already exists.`);
    }

    // Generate table-specific order link for QR Code
    const baseUrl = process.env.NEXT_PUBLIC_URL || 'https://qdinetest.devou.in';
    const qrUrl = `${baseUrl}/${restaurantSlug}/menu?table=${encodeURIComponent(cleanTableNum)}`;

    return await TablesRepository.createTable({
      restaurant_id: restaurantId,
      table_number: cleanTableNum,
      capacity: capacity || 4,
      qr_code_url: qrUrl
    });
  }

  /**
   * Update table
   */
  static async updateTable(
    tableId: string,
    restaurantId: string,
    data: { capacity?: number; status?: 'AVAILABLE' | 'OCCUPIED' }
  ): Promise<RestaurantTable> {
    const table = await TablesRepository.updateTable(tableId, restaurantId, data);
    if (!table) throw new Error('Table not found');
    return table;
  }

  /**
   * Delete table
   */
  static async deleteTable(tableId: string, restaurantId: string): Promise<void> {
    const table = await TablesRepository.getTableById(tableId, restaurantId);
    if (!table) throw new Error('Table not found');

    if (table.status === 'OCCUPIED') {
      throw new Error(`Cannot delete Table #${table.table_number} while it is OCCUPIED. Please settle active orders first.`);
    }

    const deleted = await TablesRepository.deleteTable(tableId, restaurantId);
    if (!deleted) throw new Error('Table not found');
  }

  /**
   * Recheck table status: Sets table to OCCUPIED if active orders exist, or AVAILABLE if all orders are PAID/CANCELLED.
   */
  static async syncTableOccupancy(restaurantId: string, tableNumber: string): Promise<'AVAILABLE' | 'OCCUPIED'> {
    return await TablesRepository.reevaluateOccupancy(restaurantId, tableNumber);
  }
}
