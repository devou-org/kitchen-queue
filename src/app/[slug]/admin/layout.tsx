'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname, useParams } from 'next/navigation';
import Link from 'next/link';
import { authService } from '@/app/services/auth.api';
import { ClipboardList, Wallet, UtensilsCrossed, Box, Settings } from 'lucide-react';
import { useRestaurant } from '@/hooks/useRestaurant';

const ServiceToggle = () => {
  const [isActive, setIsActive] = useState(true);
  const [message, setMessage] = useState('');
  const [toggling, setToggling] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const { slug } = useParams();

  useEffect(() => {
    fetch('/api/admin/settings', {
      headers: { 'x-restaurant-slug': slug as string }
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setIsActive(data.isServiceActive);
          setMessage(data.serviceMessage || '');
        }
      });
  }, [slug]);

  const updateService = async (newActive: boolean, newMessage?: string) => {
    setToggling(true);
    setShowSaved(false);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-restaurant-slug': slug as string
        },
        body: JSON.stringify({ active: newActive, message: newMessage ?? message })
      });
      const data = await res.json();
      if (data.success) {
        setIsActive(newActive);
        if (newMessage !== undefined) {
          setMessage(newMessage);
          setShowSaved(true);
          setTimeout(() => setShowSaved(false), 2000);
        }
      }
    } catch {
      // Fallback
    } finally {
      setToggling(false);
    }
  };

  return (
    <div style={{ marginBottom: '16px', marginTop: '-4px' }}>
      <div className="status-toggle-wrapper" style={{ marginBottom: '12px' }}>
        <div className="status-toggle-label">
          <span className="status-label-primary">Service Status</span>
          <span className="status-label-secondary" style={{ color: isActive ? 'var(--success)' : '#ef4444' }}>
            {isActive ? 'Online' : 'Offline'}
          </span>
        </div>
        <label className="switch">
          <input type="checkbox" checked={isActive} onChange={(e) => updateService(e.target.checked)} disabled={toggling} />
          <span className="slider"></span>
        </label>
      </div>
      
      {!isActive && (
        <div className="animate-fade-in" style={{ padding: '0 4px' }}>
          <label style={{ fontSize: '10px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px', display: 'block', fontWeight: 600 }}>
            Offline Reason / Message
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <input 
              type="text" 
              value={message} 
              onChange={(e) => setMessage(e.target.value)}
              placeholder="e.g. Kitchen Break"
              style={{
                width: '100%',
                background: 'white',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                padding: '10px 12px',
                color: 'var(--text-primary)',
                fontSize: '13px'
              }}
            />
            <button 
              onClick={() => updateService(false, message)}
              disabled={toggling}
              style={{
                background: toggling ? '#E5E7EB' : 'var(--primary)',
                border: 'none',
                borderRadius: '8px',
                padding: '8px',
                color: toggling ? 'var(--text-secondary)' : 'white',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.2s',
                textAlign: 'center'
              }}
            >
              {toggling ? 'Saving...' : showSaved ? '✅ Saved!' : 'Update Message'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { slug } = useParams();
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const { restaurant, loading: resLoading } = useRestaurant();
  const showOrdering = restaurant?.modules?.ONLINE_ORDERING !== false;
  const showQueue = restaurant?.modules?.QUEUE_MANAGEMENT !== false;

  useEffect(() => {
    // Check if token exists in cookie or localStorage
    const adminToken = localStorage.getItem('admin_token');
    const hasCookie = document.cookie.includes('admin_logged_in=1');
    
    // Allow access to login page
    if (pathname === `/${slug}/admin/login`) {
      setLoading(false);
      return;
    }

    if (!hasCookie) {
      router.push(`/${slug}/admin/login`);
    } else {
      setLoading(false);
    }
  }, [pathname, router, slug]);

  useEffect(() => {
    if (!resLoading && restaurant && restaurant.modules?.ONLINE_ORDERING === false) {
      const isUnauthorizedPath = 
        pathname.startsWith(`/${slug}/admin/orders`) || 
        pathname.startsWith(`/${slug}/admin/statements`) || 
        pathname.startsWith(`/${slug}/admin/inventory`);
      if (isUnauthorizedPath) {
        const target = showQueue ? 'queue' : 'products';
        router.replace(`/${slug}/admin/${target}`);
      }
    }
  }, [restaurant, resLoading, pathname, router, slug, showQueue]);

  // If on login page, render children without sidebar
  if (pathname === `/${slug}/admin/login`) {
    return <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>{children}</div>;
  }

  // If loading auth or restaurant data, show skeleton
  if (loading || resLoading) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
        <div className="admin-layout" style={{ opacity: 0.6, pointerEvents: 'none' }}>
          {/* Skeleton Sidebar */}
          <aside className="sidebar open" style={{ borderRight: '1px solid var(--border)', background: 'white' }}>
            <div className="sidebar-header" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#e2e8f0', animation: 'pulse 2s infinite' }} />
              <div style={{ height: '20px', width: '120px', background: '#e2e8f0', borderRadius: '4px', animation: 'pulse 2s infinite' }} />
            </div>
            <nav className="sidebar-nav" style={{ marginTop: '30px' }}>
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} style={{ height: '44px', background: '#e2e8f0', borderRadius: '8px', marginBottom: '12px', animation: 'pulse 2s infinite' }} />
              ))}
            </nav>
          </aside>
          {/* Skeleton Main */}
          <main className="admin-main" style={{ padding: '24px' }}>
            <div style={{ height: '32px', width: '250px', background: '#e2e8f0', borderRadius: '8px', marginBottom: '32px', animation: 'pulse 2s infinite' }} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginBottom: '24px' }}>
              {[1, 2, 3].map(i => (
                <div key={i} style={{ height: '120px', background: 'white', borderRadius: '16px', border: '1px solid var(--border)', animation: 'pulse 2s infinite' }} />
              ))}
            </div>
            <div style={{ height: '500px', background: 'white', borderRadius: '16px', border: '1px solid var(--border)', animation: 'pulse 2s infinite' }} />
          </main>
        </div>
      </div>
    );
  }

  const handleLogout = () => {
    authService.logout();
    document.cookie = 'admin_token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;'; document.cookie = 'admin_logged_in=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;';
    router.push(`/${slug}/admin/login`);
  };



  const navLinks = [
    ...(showOrdering ? [{ name: 'Orders', href: `/${slug}/admin/orders`, icon: <ClipboardList size={20} strokeWidth={2.5} /> }] : []),
    ...(!showOrdering && showQueue ? [{ name: 'Queue', href: `/${slug}/admin/queue`, icon: <ClipboardList size={20} strokeWidth={2.5} /> }] : []),
    ...(showOrdering ? [{ name: 'Statements', href: `/${slug}/admin/statements`, icon: <Wallet size={20} strokeWidth={2.5} /> }] : []),
    { name: 'Products', href: `/${slug}/admin/products`, icon: <UtensilsCrossed size={20} strokeWidth={2.5} /> },
    ...(showOrdering ? [{ name: 'Sales', href: `/${slug}/admin/inventory`, icon: <Box size={20} strokeWidth={2.5} /> }] : []),
    { name: 'Settings', href: `/${slug}/admin/settings`, icon: <Settings size={20} strokeWidth={2.5} /> },
  ];

  return (
    <div className="admin-layout">
      {restaurant?.primary_color && (
        <style dangerouslySetInnerHTML={{ __html: `
          :root {
            --primary: ${restaurant.primary_color};
            --primary-dark: ${restaurant.primary_color};
          }
        `}} />
      )}

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
          {restaurant?.logo_url ? (
            <img 
              src={restaurant.logo_url} 
              alt={restaurant.name} 
              style={{ width: '32px', height: '32px', borderRadius: '8px', objectFit: 'cover' }} 
            />
          ) : (
            <div style={{
              width: '32px', height: '32px', borderRadius: '8px',
              backgroundColor: restaurant?.primary_color || 'var(--primary)',
              color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 800, fontSize: '14px', flexShrink: 0
            }}>
              {restaurant?.name ? restaurant.name.charAt(0).toUpperCase() : '🌿'}
            </div>
          )}
          <h2 style={{ fontSize: '16px', fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {restaurant?.name || 'Renjz'} Admin
          </h2>
        </div>
        <nav className="sidebar-nav">
          {navLinks.map((link) => {
            const isActive = pathname.startsWith(link.href);
            return (
              <Link key={link.name} 
                href={link.href} 
                prefetch={false}
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
          {showOrdering && <ServiceToggle />}
          <button 
            className="btn" 
            style={{ 
              width: '100%', 
              color: 'var(--text-primary)', 
              background: '#F9FAFB', 
              border: '1px solid var(--border)',
              justifyContent: 'flex-start',
              fontWeight: 600,
              fontSize: '14px',
              padding: '10px 16px',
              borderRadius: '8px'
            }}
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
        {/* Mobile Header */}
        <div className="md:hidden" style={{ display: 'flex', alignItems: 'center', padding: '16px', background: 'var(--card)', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, zIndex: 40, gap: '16px' }}>
          <button 
            style={{ border: 'none', background: 'transparent', fontSize: '20px', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', color: 'var(--text-primary)' }}
            onClick={() => setSidebarOpen(true)}
          >
            ☰
          </button>
        </div>
        {children}
      </main>
    </div>
  );
}
