'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname, useParams } from 'next/navigation';
import Link from 'next/link';
import { authService } from '@/app/services/auth.api';
import { ClipboardList, Wallet, UtensilsCrossed, Box, Settings, Receipt, Users, AlertTriangle, Sparkles, Bot, LayoutGrid, Boxes, Store, BarChart3, LogOut } from 'lucide-react';

import { useRestaurant } from '@/hooks/useRestaurant';
import { ServiceToggle } from '@/components/ServiceToggle';
import { AIAnalystWidget } from '@/components/ai/AIAnalystWidget';
import { AdminLayoutProvider, useAdminLayout } from '@/context/AdminLayoutContext';

function AdminLayoutInner({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { slug } = useParams();
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);

  const { isMaximized } = useAdminLayout();
  const { restaurant, loading: resLoading, refresh } = useRestaurant();
  const showOrdering = restaurant?.modules?.ONLINE_ORDERING !== false;
  const showQueue = restaurant?.modules?.QUEUE_MANAGEMENT !== false;
  const showDigitalMenu = restaurant?.modules?.DIGITAL_MENU !== false;
  // Controlled via Super Admin Subscription Modules
  const showInventory = restaurant?.modules?.INVENTORY === true;

  useEffect(() => {
    // Check if token exists in cookie or localStorage
    const hasCookie = document.cookie.includes('admin_logged_in=1');
    
    // Allow access to login page
    if (pathname === `/${slug}/admin/login`) {
      setLoading(false);
      return;
    }

    if (!hasCookie) {
      router.push(`/${slug}/admin/login`);
      return;
    }

    // Try loading saved user from localStorage
    const localUser = authService.getAdminUser();
    if (localUser) {
      setCurrentUser(localUser);
      setLoading(false);
    }

    // Refresh user info in background to ensure latest permissions
    authService.refresh().then(res => {
      if (res.success && res.user) {
        setCurrentUser(res.user);
        if (typeof window !== 'undefined') {
          localStorage.setItem('admin_user', JSON.stringify(res.user));
        }
      }
      setLoading(false);
    }).catch(() => {
      setLoading(false);
    });
  }, [pathname, router, slug]);

  const isSuperAdminOrOwner = currentUser?.is_admin === true || (currentUser?.permissions && currentUser.permissions.includes('*'));

  const allNavLinks = [
    ...(showOrdering ? [{ key: 'pos', name: 'POS Terminal', href: `/${slug}/admin/pos`, icon: <Store size={20} strokeWidth={2.5} /> }] : []),
    ...(showOrdering ? [{ key: 'orders', name: 'Orders', href: `/${slug}/admin/orders`, icon: <ClipboardList size={20} strokeWidth={2.5} /> }] : []),
    ...(!showOrdering && showQueue ? [{ key: 'queue', name: 'Queue', href: `/${slug}/admin/queue`, icon: <ClipboardList size={20} strokeWidth={2.5} /> }] : []),
    { key: 'tables', name: 'Tables', href: `/${slug}/admin/tables`, icon: <LayoutGrid size={20} strokeWidth={2.5} /> },
    { key: 'products', name: 'Products', href: `/${slug}/admin/products`, icon: <UtensilsCrossed size={20} strokeWidth={2.5} /> },
    ...(showInventory ? [{ key: 'inventory', name: 'Inventory', href: `/${slug}/admin/inventory`, icon: <Boxes size={20} strokeWidth={2.5} /> }] : []),
    ...(showOrdering ? [{ key: 'analytics', name: 'Analytics', href: `/${slug}/admin/analytics`, icon: <BarChart3 size={20} strokeWidth={2.5} /> }] : []),
    ...(showOrdering ? [{ key: 'staff', name: 'Staff', href: `/${slug}/admin/staff`, icon: <Users size={20} strokeWidth={2.5} /> }] : []),
    { key: 'billing', name: 'Billing', href: `/${slug}/admin/billing`, icon: <Receipt size={20} strokeWidth={2.5} /> },
    { key: 'settings', name: 'Settings', href: `/${slug}/admin/settings`, icon: <Settings size={20} strokeWidth={2.5} /> },
  ];

  // Filter links dynamically based on user role permissions
  const navLinks = allNavLinks.filter(link => {
    if (isSuperAdminOrOwner) return true;
    if (!currentUser) return true; // default before user is loaded
    const perms = currentUser.permissions || [];
    return perms.includes(link.key);
  });

  // Route protection for unauthorized direct navigation
  useEffect(() => {
    if (loading || !currentUser || pathname === `/${slug}/admin/login`) return;
    if (isSuperAdminOrOwner) return;

    if (pathname.startsWith(`/${slug}/admin/ai-analyst`)) {
      const perms = currentUser.permissions || [];
      const firstAllowed = allNavLinks.find(link => perms.includes(link.key));
      if (firstAllowed) {
        router.replace(firstAllowed.href);
      } else {
        router.replace(`/${slug}/admin/orders`);
      }
      return;
    }

    const currentModule = allNavLinks.find(link => pathname.startsWith(link.href) || 
      (link.key === 'analytics' && (pathname.startsWith(`/${slug}/admin/sales`) || pathname.startsWith(`/${slug}/admin/statements`)))
    );

    if (currentModule) {
      const perms = currentUser.permissions || [];
      if (!perms.includes(currentModule.key)) {
        // Find first permitted route
        const firstAllowed = allNavLinks.find(link => perms.includes(link.key));
        if (firstAllowed) {
          router.replace(firstAllowed.href);
        }
      }
    }
  }, [pathname, currentUser, loading, isSuperAdminOrOwner, router, slug]);

  useEffect(() => {
    if (!resLoading && restaurant && restaurant.modules?.ONLINE_ORDERING === false) {
      const isUnauthorizedPath = 
        pathname.startsWith(`/${slug}/admin/pos`) || 
        pathname.startsWith(`/${slug}/admin/orders`) || 
        pathname.startsWith(`/${slug}/admin/statements`) || 
        pathname.startsWith(`/${slug}/admin/sales`) ||
        pathname.startsWith(`/${slug}/admin/analytics`);
      if (isUnauthorizedPath) {
        const target = showQueue ? 'queue' : 'products';
        router.replace(`/${slug}/admin/${target}`);
      }
    }

    if (!resLoading && restaurant && restaurant.modules?.INVENTORY !== true) {
      if (pathname.startsWith(`/${slug}/admin/inventory`)) {
        // Double-check with a fresh fetch in case the module was just enabled in another tab/window
        refresh().then((latest) => {
          if (latest && latest.modules?.INVENTORY !== true) {
            const target = showOrdering ? 'orders' : showQueue ? 'queue' : 'products';
            router.replace(`/${slug}/admin/${target}`);
          }
        });
      }
    }
  }, [restaurant, resLoading, pathname, router, slug, showOrdering, showQueue, refresh]);

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
                <div key={i} style={{ height: '120px', background: 'white', borderRadius: '8px', border: '1px solid var(--border)', animation: 'pulse 2s infinite' }} />
              ))}
            </div>
            <div style={{ height: '500px', background: 'white', borderRadius: '8px', border: '1px solid var(--border)', animation: 'pulse 2s infinite' }} />
          </main>
        </div>
      </div>
    );
  }

  const handleLogout = async () => {
    authService.logout('admin');
    const slugStr = Array.isArray(slug) ? slug[0] : slug;
    localStorage.removeItem(`kitchenQueue_liveAdditions_${slugStr}`);
    document.cookie = 'admin_token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;'; document.cookie = 'admin_logged_in=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;';
    try {
      await fetch('/api/auth/logout', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'admin' })
      });
    } catch (err) {
      console.error('Logout API failed:', err);
    }
    router.push(`/${slug}/admin/login`);
  };

  const navLinks = [
    ...(showOrdering ? [{ name: 'POS Terminal', href: `/${slug}/admin/pos`, icon: <Store size={20} strokeWidth={2.5} /> }] : []),
    ...(showOrdering ? [{ name: 'Orders', href: `/${slug}/admin/orders`, icon: <ClipboardList size={20} strokeWidth={2.5} /> }] : []),
    ...(!showOrdering && showQueue ? [{ name: 'Queue', href: `/${slug}/admin/queue`, icon: <ClipboardList size={20} strokeWidth={2.5} /> }] : []),
    { name: 'Tables', href: `/${slug}/admin/tables`, icon: <LayoutGrid size={20} strokeWidth={2.5} /> },
    { name: 'Products', href: `/${slug}/admin/products`, icon: <UtensilsCrossed size={20} strokeWidth={2.5} /> },
    ...(showInventory ? [{ name: 'Inventory', href: `/${slug}/admin/inventory`, icon: <Boxes size={20} strokeWidth={2.5} /> }] : []),
    ...(showOrdering ? [{ name: 'Sales', href: `/${slug}/admin/sales`, icon: <Box size={20} strokeWidth={2.5} /> }] : []),
    ...(showOrdering ? [{ name: 'Statements', href: `/${slug}/admin/statements`, icon: <Wallet size={20} strokeWidth={2.5} /> }] : []),
    ...(showOrdering ? [{ name: 'Staff', href: `/${slug}/admin/staff`, icon: <Users size={20} strokeWidth={2.5} /> }] : []),
    { name: 'Billing', href: `/${slug}/admin/billing`, icon: <Receipt size={20} strokeWidth={2.5} /> },
    { name: 'Settings', href: `/${slug}/admin/settings`, icon: <Settings size={20} strokeWidth={2.5} /> },
  ];

  if (restaurant?.billing_status === 'SUSPENDED') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: '20px' }}>
        <div style={{ background: 'white', padding: '40px', borderRadius: '8px', textAlign: 'center', maxWidth: '400px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}>
          <div style={{ width: '64px', height: '64px', background: '#FEF2F2', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
            <AlertTriangle size={32} color="#EF4444" />
          </div>
          <h2 style={{ fontSize: '24px', fontWeight: 800, marginBottom: '16px', color: '#111827' }}>Account Suspended</h2>
          <p style={{ color: '#4B5563', marginBottom: '24px', lineHeight: 1.6 }}>
            Your account has been suspended due to pending payments. Please make the payment to restore access to your admin panel.
          </p>
          <button 
            onClick={handleLogout}
            style={{ width: '100%', padding: '12px', background: '#F3F4F6', color: '#374151', borderRadius: '8px', fontWeight: 600, border: 'none', cursor: 'pointer' }}
          >
            Log Out
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <link rel="manifest" href={`/api/manifest?slug=${slug}&type=admin`} />
      <div className="admin-layout">
        <style dangerouslySetInnerHTML={{ __html: `
          ${restaurant?.primary_color ? `
          :root {
            --primary: ${restaurant.primary_color};
            --primary-dark: ${restaurant.primary_color};
          }
          ` : ''}
          .sidebar {
            transition: transform 0.35s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease !important;
          }
          .admin-main {
            transition: margin-left 0.35s cubic-bezier(0.4, 0, 0.2, 1) !important;
          }
          @media (min-width: 769px) {
            .sidebar.maximized-hidden {
              transform: translateX(-100%) !important;
              opacity: 0 !important;
              pointer-events: none !important;
            }
            .admin-main.maximized-full {
              margin-left: 0 !important;
            }
          }
        `}} />

      {/* Backdrop for mobile */}
      {isSidebarOpen && (
        <div 
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 50 }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`sidebar ${isSidebarOpen ? 'open' : ''} ${isMaximized ? 'maximized-hidden' : ''}`}>
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
            const isActive = pathname.startsWith(link.href) ||
              (link.name === 'Analytics' && (pathname.startsWith(`/${slug}/admin/sales`) || pathname.startsWith(`/${slug}/admin/statements`)));
            return (
              <Link key={link.name} 
                href={link.href} 
                prefetch={false}
                className={`sidebar-link ${isActive ? 'active' : ''}`}
                onClick={() => setSidebarOpen(false)}
              >
                <span>{link.icon}</span>
                <span>{link.name}</span>
                {link.name === 'Products' && (
                  <Sparkles size={14} style={{ marginLeft: 'auto', color: '#ffffff' }} />
                )}
              </Link>
            );
          })}
        </nav>
        <div style={{ padding: '16px', borderTop: '1px solid var(--border)', flexShrink: 0, marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {(showOrdering || showDigitalMenu) && <ServiceToggle />}

          {currentUser ? (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '10px',
              padding: '10px 12px',
              borderRadius: '12px',
              background: '#F9FAFB',
              border: '1px solid var(--border)',
            }}>
              {/* Initial Avatar */}
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: isSuperAdminOrOwner ? '#EEF2FF' : '#F3F4F6',
                color: isSuperAdminOrOwner ? '#4F46E5' : '#374151',
                fontWeight: 600,
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                {(currentUser.name || currentUser.email || 'U').charAt(0).toUpperCase()}
              </div>

              {/* User Details */}
              <div style={{ overflow: 'hidden', minWidth: 0, flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{
                    fontWeight: 600,
                    fontSize: '12px',
                    color: 'var(--text-primary)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}>
                    {currentUser.name || 'Team Member'}
                  </span>
                  <span style={{
                    padding: '1px 6px',
                    borderRadius: '999px',
                    fontSize: '9px',
                    fontWeight: 600,
                    background: isSuperAdminOrOwner ? '#EEF2FF' : '#ECFDF5',
                    color: isSuperAdminOrOwner ? '#4F46E5' : '#059669',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                    textTransform: 'capitalize',
                  }}>
                    {isSuperAdminOrOwner ? 'Owner' : (currentUser.role || 'Staff')}
                  </span>
                </div>
                <div style={{
                  fontSize: '11px',
                  color: 'var(--text-secondary)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  marginTop: '1px',
                }}>
                  {currentUser.email}
                </div>
              </div>

              {/* Small Logout Button */}
              <button
                onClick={handleLogout}
                title="Log Out"
                aria-label="Log Out"
                style={{
                  width: '30px',
                  height: '30px',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  background: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: 'var(--text-secondary)',
                  flexShrink: 0,
                  transition: 'all 0.15s ease',
                  padding: 0,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = '#EF4444';
                  e.currentTarget.style.borderColor = '#FCA5A5';
                  e.currentTarget.style.background = '#FEF2F2';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--text-secondary)';
                  e.currentTarget.style.borderColor = 'var(--border)';
                  e.currentTarget.style.background = '#FFFFFF';
                }}
              >
                <LogOut size={15} />
              </button>
            </div>
          ) : (
            <button 
              className="sidebar-logout-btn" 
              onClick={handleLogout}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: 0 }}
            >
              <span>Log Out</span>
              <LogOut size={15} />
            </button>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className={`admin-main ${isMaximized ? 'maximized-full' : ''}`}>
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
        {!isMaximized && isSuperAdminOrOwner && <AIAnalystWidget />}
      </main>
    </div>
    </>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminLayoutProvider>
      <AdminLayoutInner>{children}</AdminLayoutInner>
    </AdminLayoutProvider>
  );
}
