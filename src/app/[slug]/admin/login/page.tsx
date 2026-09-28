'use client';
import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { authService } from '@/app/services/auth.api';
import { useRestaurant } from '@/hooks/useRestaurant';

export default function AdminLogin() {
  const router = useRouter();
  const { slug } = useParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { restaurant } = useRestaurant();

  const getTargetRoute = (user: any) => {
    const showOrdering = restaurant?.modules?.ONLINE_ORDERING !== false;
    const showQueue = restaurant?.modules?.QUEUE_MANAGEMENT !== false;

    if (user?.is_admin || (user?.permissions && user.permissions.includes('*'))) {
      return showOrdering ? 'orders' : (showQueue ? 'queue' : 'products');
    }

    const perms: string[] = user?.permissions || [];
    if (perms.includes('pos') && showOrdering) return 'pos';
    if (perms.includes('orders') && showOrdering) return 'orders';
    if (perms.includes('tables')) return 'tables';
    if (perms.includes('products')) return 'products';
    if (perms.includes('inventory')) return 'inventory';
    if (perms.includes('analytics') && showOrdering) return 'analytics';
    if (perms.includes('staff')) return 'staff';
    if (perms.includes('billing')) return 'billing';
    if (perms.includes('settings')) return 'settings';

    return showOrdering ? 'orders' : 'products';
  };

  useEffect(() => {
    const checkAuth = async () => {
      const hasCookie = document.cookie.split('; ').find(row => row.startsWith('admin_logged_in='));
      if (hasCookie) {
        const res = await authService.refresh();
        if (res.success && (res.user?.is_admin || res.user?.is_staff)) {
          const slugStr = (Array.isArray(slug) ? slug[0] : slug) || '';
          const target = getTargetRoute(res.user);
          window.location.assign(`/${slugStr}/admin/${target}`);
        }
      }
    };
    checkAuth();
  }, [slug, restaurant, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return toast.error('Email and password required');

    setLoading(true);
    try {
      const data = await authService.adminLogin(email, password);
      if (data.success) {
        const slugStr = (Array.isArray(slug) ? slug[0] : slug) || '';
        const target = getTargetRoute(data.user);
        toast.success(`Welcome back, ${data.user?.name || 'Team Member'}!`);
        window.location.assign(`/${slugStr}/admin/${target}`);
      } else {
        toast.error(data.error || 'Invalid credentials');
      }
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      {restaurant?.primary_color && (
        <style dangerouslySetInnerHTML={{ __html: `
          :root {
            --primary: ${restaurant.primary_color};
            --primary-dark: ${restaurant.primary_color};
          }
        `}} />
      )}
      <div className="card animate-fade-in" style={{ width: '100%', maxWidth: '400px' }}>
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <div style={{
            width: '80px', height: '80px',
            background: 'white',
            borderRadius: '8px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
            boxShadow: '0 8px 16px rgba(0,0,0,0.06)',
            overflow: 'hidden',
            border: '2px solid white'
          }}>
            {restaurant?.logo_url ? (
              <img
                src={restaurant.logo_url}
                alt={restaurant.name || 'Logo'}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <div style={{
                width: '100%', height: '100%',
                backgroundColor: restaurant?.primary_color || 'var(--primary)',
                color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 800, fontSize: '32px'
              }}>
                {restaurant?.name ? restaurant.name.charAt(0).toUpperCase() : '🌿'}
              </div>
            )}
          </div>
          <h2 style={{ fontSize: '24px', fontWeight: 900 }}>{restaurant?.name || 'Loading...'} Admin</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Sign in to manage your kitchen</p>
        </div>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label className="label">Email Address</label>
            <input
              type="email"
              className="input"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="Your Email"
            />
          </div>
          <div>
            <label className="label">Password</label>
            <input
              type="password"
              className="input"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          <button type="submit" className="btn btn-primary btn-lg" style={{ marginTop: '10px' }} disabled={loading}>
            {loading ? <span className="loader" style={{ width: 18, height: 18, borderWidth: 2 }} /> : 'Secure Login →'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '13px' }}>
          <a href={`/${slug}/menu`} style={{ color: 'var(--text-secondary)' }}>← Back to Customer Menu</a>
        </p>
      </div>
    </div>
  );
}
