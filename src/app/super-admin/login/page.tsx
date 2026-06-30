'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function SuperAdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/super-admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (data.success) {
        router.push('/super-admin');
      } else {
        setError(data.error || 'Login failed');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#ffffff',
      fontFamily: "'Inter', sans-serif",
      padding: '20px',
    }}>
      <div style={{
        width: '100%',
        maxWidth: '400px',
      }}>
        {/* Logo area */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <img 
            src="https://ik.imagekit.io/j2q8x5lu0/qdine/qdine-logo-rotated.png" 
            alt="Qdine Logo" 
            style={{ height: '80px', width: '80px', objectFit: 'cover', margin: '0 auto 24px', borderRadius: '50%', border: '1px solid #e5e5e5' }} 
          />
          <h1 style={{ color: '#000000', fontSize: '24px', fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>Super Admin Login</h1>
          <p style={{ color: '#666666', fontSize: '14px', marginTop: '6px' }}>System Control & Management</p>
        </div>

        {/* Form Container */}
        <div style={{
          background: '#ffffff',
          border: '1px solid #e5e5e5',
          borderRadius: '12px',
          padding: '32px',
        }}>
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <label style={{ display: 'block', color: '#000000', fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="admin@qdine.com"
                style={{
                  width: '100%', padding: '12px 16px',
                  background: '#f9fafb',
                  border: '1px solid #e5e5e5',
                  borderRadius: '8px',
                  color: '#000000',
                  fontSize: '14px',
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.2s',
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = '#000000'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = '#e5e5e5'; }}
              />
            </div>
            <div>
              <label style={{ display: 'block', color: '#000000', fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                style={{
                  width: '100%', padding: '12px 16px',
                  background: '#f9fafb',
                  border: '1px solid #e5e5e5',
                  borderRadius: '8px',
                  color: '#000000',
                  fontSize: '14px',
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.2s',
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = '#000000'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = '#e5e5e5'; }}
              />
            </div>

            {error && (
              <div style={{
                background: '#fef2f2',
                border: '1px solid #fee2e2',
                borderRadius: '8px',
                padding: '12px 16px',
                color: '#dc2626',
                fontSize: '14px',
                fontWeight: 500,
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '14px',
                background: loading ? '#666666' : '#000000',
                border: 'none',
                borderRadius: '8px',
                color: '#ffffff',
                fontSize: '15px',
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                marginTop: '8px',
                transition: 'background 0.2s ease',
              }}
              onMouseOver={(e) => { if(!loading) e.currentTarget.style.background = '#333333'; }}
              onMouseOut={(e) => { if(!loading) e.currentTarget.style.background = '#000000'; }}
            >
              {loading ? 'Authenticating...' : 'Sign In'}
            </button>
          </form>
        </div>
        
        {/* Footer Text */}
        <p style={{ textAlign: 'center', color: '#999999', fontSize: '12px', marginTop: '32px' }}>
          &copy; {new Date().getFullYear()} Qdine Platform. All rights reserved.
        </p>
      </div>
    </div>
  );
}
