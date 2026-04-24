import { ApiResponse } from '@/types';

export interface InventoryItem {
  product_id: string;
  product_name: string;
  category: string;
  price: number;
  image_url?: string;
  total_quantity: number;
  total_revenue: number;
}

export interface InventorySummary {
  items: InventoryItem[];
  total_revenue: number;
  total_units_sold: number;
}

class InventoryService {
  private getAuthHeaders(): Record<string, string> {
    if (typeof window === 'undefined') return {};
    const token = localStorage.getItem('admin_token') || localStorage.getItem('auth_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  async getTopProducts(options: {
    limit?: number;
    date_from?: string;
    date_to?: string;
  } = {}): Promise<ApiResponse<InventoryItem[]>> {
    try {
      const params = new URLSearchParams({ type: 'top-products' });
      if (options.limit) params.set('limit', String(options.limit));
      if (options.date_from) params.set('date_from', options.date_from);
      if (options.date_to) params.set('date_to', options.date_to);

      const res = await fetch(`/api/analytics?${params}`, {
        headers: this.getAuthHeaders(),
        cache: 'no-store',
      });
      return await res.json();
    } catch {
      return { success: false, error: 'Network error fetching inventory summary' };
    }
  }

  async getCategories(): Promise<ApiResponse<any[]>> {
    try {
      const res = await fetch('/api/categories', {
        headers: this.getAuthHeaders(),
        cache: 'no-store',
      });
      return await res.json();
    } catch {
      return { success: false, error: 'Network error fetching categories' };
    }
  }

  async getProducts(): Promise<ApiResponse<any[]>> {
    try {
      const res = await fetch('/api/products?all=true', {
        headers: this.getAuthHeaders(),
        cache: 'no-store',
      });
      return await res.json();
    } catch {
      return { success: false, error: 'Network error fetching products' };
    }
  }
}

export const inventoryService = new InventoryService();
