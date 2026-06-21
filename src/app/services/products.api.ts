import { ApiResponse, Product } from '@/types';

class ProductService {
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
      token = localStorage.getItem('admin_token') || localStorage.getItem('auth_token') || localStorage.getItem('staff_token');
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

  // --- PUBLIC METHODS ---
  async getProducts(): Promise<ApiResponse<Product[]>> {
    try {
      const res = await fetch('/api/products', { 
        headers: this.getAuthHeaders(),
        cache: 'no-store' 
      });
      return await res.json();
    } catch {
      return { success: false, error: 'Network error fetching menu' };
    }
  }

  async getProductById(id: string): Promise<ApiResponse<Product>> {
    try {
      const res = await fetch(`/api/products/${id}`, { 
        headers: this.getAuthHeaders(),
        cache: 'no-store' 
      });
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
