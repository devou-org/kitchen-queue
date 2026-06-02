'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

export default function StaffLogin() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return toast.error('Email and password required');

    setLoading(true);
    try {
      const res = await fetch('/api/auth/staff-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      
      if (data.success) {
        if (data.token) localStorage.setItem('staff_token', data.token);
        toast.success(`Welcome back, ${data.user.name}!`);
        router.push('/staff/menu');
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
      <div className="card animate-fade-in" style={{ width: '100%', maxWidth: '400px' }}>
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <div style={{
            width: '80px', height: '80px',
            background: 'white',
            borderRadius: '20px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
            boxShadow: '0 8px 16px rgba(0,0,0,0.1)',
            overflow: 'hidden',
            border: '2px solid white'
          }}>
            <img
              src="https://ik.imagekit.io/j2q8x5lu0/Renjzkitchen/renjz.jpg"
              alt="Renjz Kitchen"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </div>
          <h2 style={{ fontSize: '24px', fontWeight: 900 }}>Staff POS</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Sign in to Point of Sale</p>
        </div>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label className="label">Email Address</label>
            <input
              type="email"
              className="input"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="Staff Email"
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
            {loading ? <span className="loader" style={{ width: 18, height: 18, borderWidth: 2 }} /> : 'Login to POS →'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '13px' }}>
          <a href="/menu" style={{ color: 'var(--text-secondary)' }}>← Back to Customer Menu</a>
        </p>
      </div>
    </div>
  );
}
