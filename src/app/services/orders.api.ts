import { ApiResponse, Order, OrderFilters } from '@/types';

export interface CreateOrderData {
  customer_name: string;
  phone: string;
  items: {
    product_id: string;
    quantity: number;
    price_at_purchase: number;
  }[];
  notes?: string;
  party_size: number;
  table_number?: string;
}

export interface UpdateOrderData {
  status?: string;
  is_paid?: boolean;
  table_number?: string;
  customer_name?: string;
  phone?: string;
  notes?: string | null;
  party_size?: number;
  items?: { product_id: string; quantity: number }[];
}

class OrderService {
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
    
    // Extract slug from URL: /[slug]/...
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

    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (slug) headers['x-restaurant-slug'] = slug;
    
    return headers;
  }

  async createOrder(orderData: CreateOrderData): Promise<ApiResponse<Order>> {
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.getAuthHeaders(),
        },
        body: JSON.stringify(orderData),
      });
      return await res.json();
    } catch (error) {
      return { success: false, error: 'Network error while creating order.' };
    }
  }

  async getHistory(phone?: string, page: number = 1, limit: number = 20): Promise<import('@/types').PaginatedResponse<Order>> {
    try {
      const params = new URLSearchParams({ page: page.toString(), limit: limit.toString(), t: Date.now().toString() });
      if (phone) params.append('phone', phone);
        
      const res = await fetch(`/api/orders/history?${params.toString()}`, {
        headers: this.getAuthHeaders(),
      });
      return await res.json();
    } catch (error) {
      return { success: false, error: 'Network error while fetching history.', data: [], total: 0, page: 1, per_page: 20 };
    }
  }

  async getOrderById(id: string): Promise<ApiResponse<Order>> {
    try {
      const res = await fetch(`/api/orders/${id}`, {
        headers: this.getAuthHeaders(),
      });
      return await res.json();
    } catch (error) {
      return { success: false, error: 'Network error while fetching order.' };
    }
  }

  async updateOrder(id: string, updateData: UpdateOrderData): Promise<ApiResponse<Order>> {
    try {
      const res = await fetch(`/api/orders/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...this.getAuthHeaders(),
        },
        body: JSON.stringify(updateData),
      });
      return await res.json();
    } catch (error) {
      return { success: false, error: 'Network error while updating order.' };
    }
  }

  async getOrders(filters: OrderFilters = {}): Promise<ApiResponse<Order[]>> {
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined) params.append(key, value.toString());
      });

      const res = await fetch(`/api/orders?${params.toString()}`, {
        headers: this.getAuthHeaders(),
      });
      return await res.json();
    } catch (error) {
      return { success: false, error: 'Network error while fetching orders.' };
    }
  }



}

export const orderService = new OrderService();
