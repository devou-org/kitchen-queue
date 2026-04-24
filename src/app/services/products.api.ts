import { ApiResponse, Product } from '@/types';

class ProductService {
  private getAuthHeaders(): Record<string, string> {
    if (typeof window === 'undefined') return {};
    const token = localStorage.getItem('admin_token') || localStorage.getItem('auth_token');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  }

  // --- PUBLIC METHODS ---
  async getProducts(): Promise<ApiResponse<Product[]>> {
    try {
      const res = await fetch('/api/products', { cache: 'no-store' });
      return await res.json();
    } catch {
      return { success: false, error: 'Network error fetching menu' };
    }
  }

  async getProductById(id: string): Promise<ApiResponse<Product>> {
    try {
      const res = await fetch(`/api/products/${id}`, { cache: 'no-store' });
      return await res.json();
    } catch {
      return { success: false, error: 'Network error fetching product' };
    }
  }

  // --- ADMIN METHODS ---
  async getAllProductsAdmin(): Promise<ApiResponse<Product[]>> {
    try {
      const res = await fetch('/api/products?all=true', {
        headers: this.getAuthHeaders(),
        cache: 'no-store',
      });
      return await res.json();
    } catch {
      return { success: false, error: 'Network error fetching all products' };
    }
  }

  async createProduct(data: Partial<Product>): Promise<ApiResponse<Product>> {
    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.getAuthHeaders(),
        },
        body: JSON.stringify(data),
      });
      return await res.json();
    } catch {
      return { success: false, error: 'Network error creating product' };
    }
  }

  async updateProduct(id: string, data: Partial<Product>): Promise<ApiResponse<Product>> {
    try {
      const res = await fetch(`/api/products/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...this.getAuthHeaders(),
        },
        body: JSON.stringify(data),
      });
      return await res.json();
    } catch {
      return { success: false, error: 'Network error updating product' };
    }
  }

  async deleteProduct(id: string): Promise<ApiResponse<void>> {
    try {
      const res = await fetch(`/api/products/${id}`, {
        method: 'DELETE',
        headers: this.getAuthHeaders(),
      });
      return await res.json();
    } catch {
      return { success: false, error: 'Network error deleting product' };
    }
  }
}

export const productService = new ProductService();
