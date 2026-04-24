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
    const token = localStorage.getItem('auth_token') || localStorage.getItem('admin_token');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
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

  async getHistory(phone?: string): Promise<ApiResponse<Order[]>> {
    try {
      const url = phone 
        ? `/api/orders/history?phone=${encodeURIComponent(phone)}&t=${Date.now()}`
        : `/api/orders/history?t=${Date.now()}`;
        
      const res = await fetch(url, {
        headers: this.getAuthHeaders(),
      });
      return await res.json();
    } catch (error) {
      return { success: false, error: 'Network error while fetching history.' };
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

  async getOrderByTicket(ticket: string): Promise<ApiResponse<Order>> {
    try {
      const res = await fetch(`/api/orders/ticket/${ticket}`, {
        headers: this.getAuthHeaders(),
      });
      return await res.json();
    } catch (error) {
      return { success: false, error: 'Network error while fetching order by ticket.' };
    }
  }

}

export const orderService = new OrderService();
