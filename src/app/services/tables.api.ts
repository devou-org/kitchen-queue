import { ApiResponse } from '@/types';

export interface RestaurantTable {
  id: string;
  restaurant_id: string;
  table_number: string;
  capacity: number;
  status: 'AVAILABLE' | 'OCCUPIED';
  qr_code_url?: string;
  active_orders_count?: number;
  created_at?: string;
  updated_at?: string;
}

class TableService {
  private getAuthHeaders(): Record<string, string> {
    if (typeof window === 'undefined') return {};
    let token: string | null = null;
    const path = window.location.pathname;

    if (path.startsWith('/admin')) {
      token = localStorage.getItem('admin_token');
    } else if (path.includes('/staff')) {
      token = localStorage.getItem('staff_token') || localStorage.getItem('admin_token');
    } else {
      token = localStorage.getItem('auth_token');
    }

    if (!token) {
      token = localStorage.getItem('admin_token') || localStorage.getItem('staff_token') || localStorage.getItem('auth_token');
    }

    const segments = path.split('/').filter(Boolean);
    let slug = segments[0];

    if (slug === 'staff' || slug === 'admin') {
      const staffToken = localStorage.getItem('staff_token') || localStorage.getItem('admin_token');
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
          console.error('Error decoding token:', e);
        }
      }
    }

    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (slug) headers['x-restaurant-slug'] = slug;

    return headers;
  }

  async getTables(customSlug?: string): Promise<ApiResponse<RestaurantTable[]>> {
    try {
      const headers = this.getAuthHeaders();
      const slugToUse = customSlug || headers['x-restaurant-slug'];
      const url = slugToUse ? `/api/tables?slug=${encodeURIComponent(slugToUse)}` : '/api/tables';

      const res = await fetch(url, {
        headers,
        cache: 'no-store'
      });
      const data = await res.json();
      if (data.success) {
        return { success: true, data: data.tables };
      }
      return { success: false, error: data.error || 'Failed to fetch tables' };
    } catch {
      return { success: false, error: 'Network error while fetching tables.' };
    }
  }
}

export const tableService = new TableService();
