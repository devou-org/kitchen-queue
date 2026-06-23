import { ApiResponse, Product, DashboardStats, Order, OrderFilters } from '@/types';

class AdminService {
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

  // --- ANALYTICS ---
  async getDailyAnalytics(date_from?: string, date_to?: string): Promise<ApiResponse<any[]>> {
    try {
      const qs = new URLSearchParams({ type: 'daily' });
      if (date_from) qs.append('date_from', date_from);
      if (date_to) qs.append('date_to', date_to);
      const res = await fetch(`/api/analytics?${qs.toString()}`, {
        headers: this.getAuthHeaders(),
      });
      return await res.json();
    } catch {
      return { success: false, error: 'Network error fetching daily stats' };
    }
  }

  async getPeakHours(): Promise<ApiResponse<any[]>> {
    try {
      const res = await fetch('/api/analytics?type=peak-hours', {
        headers: this.getAuthHeaders(),
      });
      return await res.json();
    } catch {
      return { success: false, error: 'Network error fetching peak hours' };
    }
  }

  async getTopProducts(limit = 10): Promise<ApiResponse<any[]>> {
    try {
      const res = await fetch(`/api/analytics?type=top-products&limit=${limit}`, {
        headers: this.getAuthHeaders(),
      });
      return await res.json();
    } catch {
      return { success: false, error: 'Network error fetching top products' };
    }
  }

  async getDashboardStats(): Promise<ApiResponse<DashboardStats>> {
    try {
      const res = await fetch('/api/analytics?type=dashboard', {
        headers: this.getAuthHeaders(),
      });
      return await res.json();
    } catch {
      return { success: false, error: 'Network error fetching dashboard stats' };
    }
  }

  async getKitchenSnapshot(): Promise<ApiResponse<any[]>> {
    try {
      const res = await fetch('/api/analytics?type=kitchen-snapshot', {
        headers: this.getAuthHeaders(),
      });
      return await res.json();
    } catch {
      return { success: false, error: 'Network error fetching kitchen snapshot' };
    }
  }

  // --- QUEUE CONTROL ---
  async advanceQueue(): Promise<ApiResponse<any>> {
    try {
      const res = await fetch('/api/queue/advance', {
        method: 'POST',
        headers: this.getAuthHeaders(),
      });
      return await res.json();
    } catch {
      return { success: false, error: 'Network error advancing queue' };
    }
  }

  async setQueueNumber(number: number): Promise<ApiResponse<any>> {
    try {
      const res = await fetch('/api/queue/set', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.getAuthHeaders(),
        },
        body: JSON.stringify({ number }),
      });
      return await res.json();
    } catch {
      return { success: false, error: 'Network error setting queue number' };
    }
  }
}

export const adminService = new AdminService();
