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
    const aToken = localStorage.getItem('admin_token');
    const sToken = localStorage.getItem('staff_token');
    const authT = localStorage.getItem('auth_token');
    
    let token = (aToken && aToken !== 'null' && aToken !== 'undefined') ? aToken : 
                ((sToken && sToken !== 'null' && sToken !== 'undefined') ? sToken : 
                ((authT && authT !== 'null' && authT !== 'undefined') ? authT : null));
                
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const path = window.location.pathname;
    const segments = path.split('/').filter(Boolean);
    let slug = segments[0];

    if (slug === 'staff') {
      const staffToken = localStorage.getItem('staff_token');
      if (staffToken) {
        try {
          const payloadPart = staffToken.split('.')[1];
          if (payloadPart) {
            const payload = JSON.parse(atob(payloadPart));
            if (payload.restaurantSlug) {
              slug = payload.restaurantSlug;
            }
          }
        } catch (e) {
          console.error('Error decoding staff token:', e);
        }
      }
    }
    
    if (slug) headers['x-restaurant-slug'] = slug;
    return headers;
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
