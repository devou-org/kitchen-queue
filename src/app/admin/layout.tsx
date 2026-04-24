'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { authService } from '@/app/services/auth.api';
import { ClipboardList, Wallet, UtensilsCrossed, Box } from 'lucide-react';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if token exists in cookie or localStorage
    const adminToken = localStorage.getItem('admin_token');
    const hasCookie = document.cookie.includes('admin_token=');
    
    // Allow access to login page
    if (pathname === '/admin/login') {
      setLoading(false);
      return;
    }

    if (!adminToken && !hasCookie) {
      router.push('/admin/login');
    } else {
      setLoading(false);
    }
  }, [pathname, router]);

  // If loading or on login page, render children without sidebar
  if (loading || pathname === '/admin/login') {
    return <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>{loading ? null : children}</div>;
  }

  const handleLogout = () => {
    authService.logout();
    localStorage.removeItem('admin_token');
    router.push('/admin/login');
  };

  const navLinks = [
    { name: 'Orders', href: '/admin/orders', icon: <ClipboardList size={20} strokeWidth={2.5} /> },
    { name: 'Statements', href: '/admin/statements', icon: <Wallet size={20} strokeWidth={2.5} /> },
    { name: 'Products', href: '/admin/products', icon: <UtensilsCrossed size={20} strokeWidth={2.5} /> },
    { name: 'Sales', href: '/admin/inventory', icon: <Box size={20} strokeWidth={2.5} /> },
  ];

  return (
    <div className="admin-layout">
      {/* Mobile nav toggle */}
      <button 
        style={{ position: 'fixed', top: 16, left: 16, zIndex: 70, border: 'none', background: 'var(--card)', padding: '8px', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', cursor: 'pointer' }}
        className="md:hidden"
        onClick={() => setSidebarOpen(true)}
      >
        ☰
      </button>

      {/* Backdrop for mobile */}
      {isSidebarOpen && (
        <div 
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 50 }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`sidebar ${isSidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <img 
            src="/logo.jpeg" 
            alt="Renjz Kitchen" 
            style={{ width: '32px', height: '32px', borderRadius: '8px', objectFit: 'cover' }} 
          />
          <h2 style={{ fontSize: '18px', fontWeight: 800 }}>Renjz Admin</h2>
        </div>
        <nav className="sidebar-nav">
          {navLinks.map((link) => {
            const isActive = pathname.startsWith(link.href);
            return (
              <Link 
                key={link.name} 
                href={link.href} 
                className={`sidebar-link ${isActive ? 'active' : ''}`}
                onClick={() => setSidebarOpen(false)}
              >
                <span>{link.icon}</span>
                {link.name}
              </Link>
            );
          })}
        </nav>
        <div style={{ position: 'absolute', bottom: 20, left: 20, right: 20 }}>
          <button 
            className="btn btn-ghost" 
            style={{ width: '100%', color: 'rgba(255,255,255,0.7)', justifyContent: 'flex-start' }}
            onClick={handleLogout}
          >
            Log Out →
          </button>
          {/* <div style={{
            marginTop: '16px',
            textAlign: 'center',
            fontSize: '10px',
            color: 'rgba(255,255,255,0.35)',
            letterSpacing: '0.04em',
            fontWeight: 500,
            borderTop: '1px solid rgba(255,255,255,0.1)',
            paddingTop: '12px',
          }}>
            Crafted with ♥ by{' '}
            <a
              href="https://devou.in"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: 'rgba(255,255,255,0.65)',
                fontWeight: 700,
                textDecoration: 'none',
                letterSpacing: '0.05em',
              }}
            >
              Devou
            </a>
          </div> */}
        </div>
      </aside>

      {/* Main Content */}
      <main className="admin-main">
        {children}
      </main>
    </div>
  );
}
