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
  const { restaurant, loading: resLoading } = useRestaurant();

  // Forgot / Reset Password State
  type ViewMode = 'LOGIN' | 'FORGOT_PASSWORD' | 'RESET_PASSWORD';
  const [viewMode, setViewMode] = useState<ViewMode>('LOGIN');
  const [resetEmail, setResetEmail] = useState('');
  const [resetOtp, setResetOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

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
    if (perms.includes('finance')) return 'finance';
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

  const handleRequestResetOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail || !resetEmail.trim()) {
      return toast.error('Please enter your admin email address');
    }

    setResetLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetEmail.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message || 'Verification code sent to your email!');
        setViewMode('RESET_PASSWORD');
      } else {
        toast.error(data.error || 'Failed to send reset code');
      }
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setResetLoading(false);
    }
  };

  const handleConfirmReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetOtp || !resetOtp.trim()) {
      return toast.error('Please enter the 6-digit verification code');
    }
    if (!newPassword || newPassword.length < 6) {
      return toast.error('Password must be at least 6 characters');
    }
    if (newPassword !== confirmPassword) {
      return toast.error('Passwords do not match');
    }

    setResetLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: resetEmail.trim(),
          otp: resetOtp.trim(),
          new_password: newPassword,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Password updated successfully! Logging you in...');
        // Auto-login with the updated credentials
        const loginRes = await authService.adminLogin(resetEmail.trim(), newPassword);
        if (loginRes.success) {
          const slugStr = (Array.isArray(slug) ? slug[0] : slug) || '';
          const target = getTargetRoute(loginRes.user);
          window.location.assign(`/${slugStr}/admin/${target}`);
        } else {
          setEmail(resetEmail);
          setPassword('');
          setViewMode('LOGIN');
          toast.success('Please sign in with your new password.');
        }
      } else {
        toast.error(data.error || 'Failed to reset password');
      }
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setResetLoading(false);
    }
  };

  if (resLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="loader" />
      </div>
    );
  }

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
      <div className="card animate-fade-in" style={{ width: '100%', maxWidth: '420px' }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
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
          <h2 style={{ fontSize: '24px', fontWeight: 900 }}>
            {viewMode === 'LOGIN' && `${restaurant?.name || 'Store'} Admin`}
            {viewMode === 'FORGOT_PASSWORD' && 'Forgot Password'}
            {viewMode === 'RESET_PASSWORD' && 'Create New Password'}
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '4px' }}>
            {viewMode === 'LOGIN' && 'Sign in to manage your kitchen'}
            {viewMode === 'FORGOT_PASSWORD' && 'Enter your email to receive a 6-digit reset code'}
            {viewMode === 'RESET_PASSWORD' && `Enter the 6-digit code sent to ${resetEmail}`}
          </p>
        </div>

        {/* 1. SIGN IN FORM */}
        {viewMode === 'LOGIN' && (
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label className="label">Email Address</label>
              <input
                type="email"
                className="input"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="admin@restaurant.com"
                autoComplete="email"
                required
              />
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label className="label" style={{ margin: 0 }}>Password</label>
                <button
                  type="button"
                  onClick={() => {
                    setResetEmail(email || '');
                    setViewMode('FORGOT_PASSWORD');
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: restaurant?.primary_color || 'var(--primary)',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    padding: 0
                  }}
                >
                  Forgot Password?
                </button>
              </div>
              <input
                type="password"
                className="input"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                required
              />
            </div>
            <button type="submit" className="btn btn-primary btn-lg" style={{ marginTop: '10px' }} disabled={loading}>
              {loading ? <span className="loader" style={{ width: 18, height: 18, borderWidth: 2 }} /> : 'Secure Login →'}
            </button>
          </form>
        )}

        {/* 2. FORGOT PASSWORD: ENTER EMAIL */}
        {viewMode === 'FORGOT_PASSWORD' && (
          <form onSubmit={handleRequestResetOtp} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label className="label">Registered Admin Email</label>
              <input
                type="email"
                className="input"
                value={resetEmail}
                onChange={e => setResetEmail(e.target.value)}
                placeholder="admin@restaurant.com"
                autoFocus
                required
              />
            </div>
            <button
              type="submit"
              className="btn btn-primary btn-lg"
              style={{ marginTop: '6px' }}
              disabled={resetLoading}
            >
              {resetLoading ? <span className="loader" style={{ width: 18, height: 18, borderWidth: 2 }} /> : 'Send Reset Code →'}
            </button>
            <button
              type="button"
              onClick={() => setViewMode('LOGIN')}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-secondary)',
                fontSize: '13px',
                cursor: 'pointer',
                padding: '8px',
                textAlign: 'center'
              }}
            >
              ← Back to Login
            </button>
          </form>
        )}

        {/* 3. RESET PASSWORD: ENTER OTP & NEW PASSWORD */}
        {viewMode === 'RESET_PASSWORD' && (
          <form onSubmit={handleConfirmReset} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label className="label">6-Digit Verification Code</label>
              <input
                type="text"
                className="input"
                value={resetOtp}
                onChange={e => setResetOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="123456"
                maxLength={6}
                style={{ textAlign: 'center', fontSize: '20px', letterSpacing: '6px', fontWeight: 800 }}
                autoFocus
                required
              />
            </div>
            <div>
              <label className="label">New Password</label>
              <input
                type="password"
                className="input"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="Min 6 characters"
                required
              />
            </div>
            <div>
              <label className="label">Confirm New Password</label>
              <input
                type="password"
                className="input"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Re-type password"
                required
              />
            </div>
            <button
              type="submit"
              className="btn btn-primary btn-lg"
              style={{ marginTop: '6px' }}
              disabled={resetLoading}
            >
              {resetLoading ? <span className="loader" style={{ width: 18, height: 18, borderWidth: 2 }} /> : 'Update Password & Login →'}
            </button>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
              <button
                type="button"
                onClick={handleRequestResetOtp}
                disabled={resetLoading}
                style={{
                  background: 'none',
                  border: 'none',
                  color: restaurant?.primary_color || 'var(--primary)',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  padding: 0
                }}
              >
                Resend Code
              </button>
              <button
                type="button"
                onClick={() => setViewMode('LOGIN')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  fontSize: '12px',
                  cursor: 'pointer',
                  padding: 0
                }}
              >
                ← Back to Login
              </button>
            </div>
          </form>
        )}

        <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '13px' }}>
          <a href={`/${slug}/menu`} style={{ color: 'var(--text-secondary)' }}>← Back to Customer Menu</a>
        </p>
      </div>
    </div>
  );
}
