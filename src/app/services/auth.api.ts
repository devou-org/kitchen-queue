export interface AuthResponse {
  success: boolean;
  message?: string;
  error?: string;
  otp_token?: string;
  token?: string;
  user?: {
    id: string;
    phone?: string;
    email?: string;
    name: string;
    is_admin: boolean;
  };
}

class AuthService {
  async sendOtp(phone: string): Promise<AuthResponse> {
    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      return await res.json();
    } catch (error) {
      return { success: false, error: 'Network error. Please try again.' };
    }
  }

  async verifyOtp(code: string, otpToken: string): Promise<AuthResponse> {
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, otp_token: otpToken }),
      });
      const data = await res.json();
      if (data.success && data.token) {
        if (typeof window !== 'undefined') {
          localStorage.setItem('auth_token', data.token);
          if (data.user) {
            localStorage.setItem('user', JSON.stringify(data.user));
          }
        }
      }
      return data;
    } catch (error) {
      return { success: false, error: 'Network error. Please try again.' };
    }
  }

  async adminLogin(email: string, password: string): Promise<AuthResponse> {
    try {
      const res = await fetch('/api/auth/admin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      return await res.json();
    } catch (error) {
      return { success: false, error: 'Network error. Please try again.' };
    }
  }

  async refresh(): Promise<AuthResponse> {
    try {
      const res = await fetch('/api/auth/refresh', {
        method: 'POST',
      });
      const data = await res.json();
      if (data.success && data.token) {
        if (typeof window !== 'undefined') {
          localStorage.setItem('auth_token', data.token);
          if (data.user) {
            localStorage.setItem('user', JSON.stringify(data.user));
          }
        }
      } else {
        this.logout();
      }
      return data;
    } catch (error) {
      this.logout();
      return { success: false, error: 'Network error. Please try again.' };
    }
  }

  async me(): Promise<AuthResponse> {
    if (typeof window === 'undefined') return { success: false, error: 'SSR' };
    const token = localStorage.getItem('auth_token');
    
    // If no access token, try refreshing immediately
    if (!token) {
      return this.refresh();
    }
    
    try {
      const res = await fetch('/api/users/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      // If access token is expired, refresh it
      if (res.status === 401) {
        return this.refresh();
      }
      
      return await res.json();
    } catch (error) {
      return { success: false, error: 'Network error. Please try again.' };
    }
  }

  logout() {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('admin_token');
      localStorage.removeItem('user');
    }
    if (typeof document !== 'undefined') {
      document.cookie = 'auth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;';
      document.cookie = 'admin_token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;';
    }
  }

  isAuthenticated(): boolean {
    if (typeof window === 'undefined') return false;
    return !!localStorage.getItem('auth_token');
  }

  getUser() {
    if (typeof window === 'undefined') return null;
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  }
}

export const authService = new AuthService();
