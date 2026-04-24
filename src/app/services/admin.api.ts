import { ApiResponse, Product, DashboardStats, Order, OrderFilters } from '@/types';

class AdminService {
  private getAuthHeaders(): Record<string, string> {
    if (typeof window === 'undefined') return {};
    const token = localStorage.getItem('admin_token') || localStorage.getItem('auth_token');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  }

  // --- ANALYTICS ---
  async getDailyAnalytics(): Promise<ApiResponse<any[]>> {
    try {
      const res = await fetch('/api/analytics?type=daily', {
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
