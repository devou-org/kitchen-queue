import { ApiResponse } from '@/types';
import {
  InventoryItem,
  InventoryCategory,
  InventoryUnit,
  Supplier,
  PurchaseOrder,
  WastageRecord,
  StockAdjustment,
  Recipe,
  InventoryDashboardSummary,
} from '@/types/inventory';

class InventoryService {
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
      token =
        localStorage.getItem('admin_token') ||
        localStorage.getItem('auth_token') ||
        localStorage.getItem('staff_token');
    }

    const segments = path.split('/').filter(Boolean);
    let slug = segments[0];

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (slug) headers['x-restaurant-slug'] = slug;

    return headers;
  }

  // Dashboard
  async getDashboardSummary(): Promise<ApiResponse<InventoryDashboardSummary>> {
    try {
      const res = await fetch('/api/inventory/dashboard', {
        headers: this.getAuthHeaders(),
        cache: 'no-store',
      });
      return await res.json();
    } catch {
      return { success: false, error: 'Failed to fetch inventory dashboard summary' };
    }
  }

  // Items / Ingredients
  async getItems(params?: {
    category_id?: string;
    search?: string;
    status?: string;
    is_active?: boolean;
  }): Promise<ApiResponse<InventoryItem[]>> {
    try {
      const query = new URLSearchParams();
      if (params?.category_id) query.set('category_id', params.category_id);
      if (params?.search) query.set('search', params.search);
      if (params?.status) query.set('status', params.status);
      if (params?.is_active !== undefined) query.set('is_active', String(params.is_active));

      const res = await fetch(`/api/inventory/items?${query.toString()}`, {
        headers: this.getAuthHeaders(),
        cache: 'no-store',
      });
      return await res.json();
    } catch {
      return { success: false, error: 'Failed to fetch inventory items' };
    }
  }

  async getItemDetail(id: string): Promise<ApiResponse<any>> {
    try {
      const res = await fetch(`/api/inventory/items/${id}`, {
        headers: this.getAuthHeaders(),
        cache: 'no-store',
      });
      return await res.json();
    } catch {
      return { success: false, error: 'Failed to fetch item details' };
    }
  }

  async createItem(data: any): Promise<ApiResponse<InventoryItem>> {
    try {
      const res = await fetch('/api/inventory/items', {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(data),
      });
      return await res.json();
    } catch {
      return { success: false, error: 'Failed to create inventory item' };
    }
  }

  async updateItem(id: string, data: any): Promise<ApiResponse<InventoryItem>> {
    try {
      const res = await fetch(`/api/inventory/items/${id}`, {
        method: 'PUT',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(data),
      });
      return await res.json();
    } catch {
      return { success: false, error: 'Failed to update inventory item' };
    }
  }

  async deleteItem(id: string): Promise<ApiResponse<any>> {
    try {
      const res = await fetch(`/api/inventory/items/${id}`, {
        method: 'DELETE',
        headers: this.getAuthHeaders(),
      });
      return await res.json();
    } catch {
      return { success: false, error: 'Failed to deactivate inventory item' };
    }
  }

  // Purchases / Stock Receiving
  async getPurchases(): Promise<ApiResponse<PurchaseOrder[]>> {
    try {
      const res = await fetch('/api/inventory/purchases', {
        headers: this.getAuthHeaders(),
        cache: 'no-store',
      });
      return await res.json();
    } catch {
      return { success: false, error: 'Failed to fetch purchases' };
    }
  }

  async receiveStock(data: any): Promise<ApiResponse<PurchaseOrder>> {
    try {
      const res = await fetch('/api/inventory/purchases', {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(data),
      });
      return await res.json();
    } catch {
      return { success: false, error: 'Failed to receive purchase stock' };
    }
  }

  // Suppliers
  async getSuppliers(): Promise<ApiResponse<Supplier[]>> {
    try {
      const res = await fetch('/api/inventory/suppliers', {
        headers: this.getAuthHeaders(),
        cache: 'no-store',
      });
      return await res.json();
    } catch {
      return { success: false, error: 'Failed to fetch suppliers' };
    }
  }

  async createSupplier(data: any): Promise<ApiResponse<Supplier>> {
    try {
      const res = await fetch('/api/inventory/suppliers', {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(data),
      });
      return await res.json();
    } catch {
      return { success: false, error: 'Failed to create supplier' };
    }
  }

  async updateSupplier(id: string, data: any): Promise<ApiResponse<Supplier>> {
    try {
      const res = await fetch(`/api/inventory/suppliers/${id}`, {
        method: 'PUT',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(data),
      });
      return await res.json();
    } catch {
      return { success: false, error: 'Failed to update supplier' };
    }
  }

  // Wastage & Adjustments
  async getWastageRecords(): Promise<ApiResponse<WastageRecord[]>> {
    try {
      const res = await fetch('/api/inventory/wastage', {
        headers: this.getAuthHeaders(),
        cache: 'no-store',
      });
      return await res.json();
    } catch {
      return { success: false, error: 'Failed to fetch wastage records' };
    }
  }

  async recordWastage(data: any): Promise<ApiResponse<WastageRecord>> {
    try {
      const res = await fetch('/api/inventory/wastage', {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(data),
      });
      return await res.json();
    } catch {
      return { success: false, error: 'Failed to record wastage' };
    }
  }

  async getAdjustments(): Promise<ApiResponse<StockAdjustment[]>> {
    try {
      const res = await fetch('/api/inventory/adjustments', {
        headers: this.getAuthHeaders(),
        cache: 'no-store',
      });
      return await res.json();
    } catch {
      return { success: false, error: 'Failed to fetch adjustments' };
    }
  }

  async recordAdjustment(data: any): Promise<ApiResponse<StockAdjustment>> {
    try {
      const res = await fetch('/api/inventory/adjustments', {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(data),
      });
      return await res.json();
    } catch {
      return { success: false, error: 'Failed to record stock adjustment' };
    }
  }

  // Recipes / BOM
  async getRecipes(productId?: string): Promise<ApiResponse<any>> {
    try {
      const url = productId ? `/api/inventory/recipes?product_id=${productId}` : '/api/inventory/recipes';
      const res = await fetch(url, {
        headers: this.getAuthHeaders(),
        cache: 'no-store',
      });
      return await res.json();
    } catch {
      return { success: false, error: 'Failed to fetch recipes' };
    }
  }

  async upsertRecipe(data: any): Promise<ApiResponse<Recipe>> {
    try {
      const res = await fetch('/api/inventory/recipes', {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(data),
      });
      return await res.json();
    } catch {
      return { success: false, error: 'Failed to save recipe' };
    }
  }

  // Categories & Units
  async getCategories(): Promise<ApiResponse<InventoryCategory[]>> {
    try {
      const res = await fetch('/api/inventory/categories', {
        headers: this.getAuthHeaders(),
        cache: 'no-store',
      });
      return await res.json();
    } catch {
      return { success: false, error: 'Failed to fetch categories' };
    }
  }

  async createCategory(name: string, description?: string): Promise<ApiResponse<InventoryCategory>> {
    try {
      const res = await fetch('/api/inventory/categories', {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ name, description }),
      });
      return await res.json();
    } catch {
      return { success: false, error: 'Failed to create category' };
    }
  }

  async getUnits(): Promise<ApiResponse<InventoryUnit[]>> {
    try {
      const res = await fetch('/api/inventory/units', {
        headers: this.getAuthHeaders(),
        cache: 'no-store',
      });
      return await res.json();
    } catch {
      return { success: false, error: 'Failed to fetch units' };
    }
  }

  // Reports
  async getReports(params?: { date_from?: string; date_to?: string }): Promise<ApiResponse<any>> {
    try {
      const query = new URLSearchParams();
      if (params?.date_from) query.set('date_from', params.date_from);
      if (params?.date_to) query.set('date_to', params.date_to);

      const res = await fetch(`/api/inventory/reports?${query.toString()}`, {
        headers: this.getAuthHeaders(),
        cache: 'no-store',
      });
      return await res.json();
    } catch {
      return { success: false, error: 'Failed to fetch inventory reports' };
    }
  }

  // Backwards-compatible sales analytics bridge
  async getTopProducts(options: { limit?: number; date_from?: string; date_to?: string } = {}): Promise<ApiResponse<any[]>> {
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
      return { success: false, error: 'Network error fetching top products' };
    }
  }
}

export const inventoryService = new InventoryService();
export type { InventoryItem } from '@/types/inventory';
