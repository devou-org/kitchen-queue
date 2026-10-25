import { ApiResponse } from '@/types';

export interface RestaurantTable {
  id: string;
  restaurant_id: string;
  table_number: string;
  capacity: number;
  status: 'AVAILABLE' | 'OCCUPIED';
  qr_code_url?: string;
  merged_into_table_id?: string | null;
  parent_table_number?: string | null;
  effective_capacity?: number;
  merged_table_numbers?: string[];
  merged_table_ids?: string[];
  active_orders_count?: number;
  created_at?: string;
  updated_at?: string;
}

class TableService {
  private getAuthHeaders(): Record<string, string> {
    if (typeof window === 'undefined') return {};
    let token: string | null = null;
    const path = window.location.pathname;

    if (path.startsWith('/admin') || path.includes('/admin')) {
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

  async mergeTables(primaryTableId: string, secondaryTableIds: string[]): Promise<ApiResponse<any>> {
    try {
      const headers = this.getAuthHeaders();
      headers['Content-Type'] = 'application/json';

      const res = await fetch('/api/tables/merge', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          primary_table_id: primaryTableId,
          secondary_table_ids: secondaryTableIds
        })
      });

      const data = await res.json();
      if (data.success) {
        return { success: true, data: data.result, message: data.message };
      }
      return { success: false, error: data.error || 'Failed to merge tables' };
    } catch {
      return { success: false, error: 'Network error while merging tables.' };
    }
  }

  async unmergeTable(tableId: string): Promise<ApiResponse<any>> {
    try {
      const headers = this.getAuthHeaders();
      headers['Content-Type'] = 'application/json';

      const res = await fetch('/api/tables/unmerge', {
        method: 'POST',
        headers,
        body: JSON.stringify({ table_id: tableId })
      });

      const data = await res.json();
      if (data.success) {
        return { success: true, data: data.result, message: data.message };
      }
      return { success: false, error: data.error || 'Failed to unmerge table' };
    } catch {
      return { success: false, error: 'Network error while unmerging table.' };
    }
  }
}

export const tableService = new TableService();

