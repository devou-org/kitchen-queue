'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname, useParams } from 'next/navigation';
import Link from 'next/link';
import { ClipboardList, UtensilsCrossed, LogOut } from 'lucide-react';
import { ServiceToggle } from '@/components/ServiceToggle';
import { useRestaurant } from '@/hooks/useRestaurant';
function parseToken(token: string) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      window.atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
}

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { slug } = useParams();
  const [loading, setLoading] = useState(true);
  const [staff, setStaff] = useState<{ name: string; role: string; restaurantName?: string; restaurantSlug?: string } | null>(null);
  const { restaurant } = useRestaurant();

  useEffect(() => {
    const staffToken = localStorage.getItem('staff_token');
    const hasCookie = document.cookie.includes('staff_token=');
    const loginPath = `/${slug}/staff/login`;

    if (pathname === loginPath) {
      setLoading(false);
      return;
    }

    if (!staffToken && !hasCookie) {
      router.push(loginPath);
    } else {
      if (staffToken) {
        const payload = parseToken(staffToken);
        if (payload) {
          setStaff({
            name: payload.name || payload.email?.split('@')[0] || 'Staff',
            role: payload.role || 'STAFF',
            restaurantName: payload.restaurantName,
            restaurantSlug: payload.restaurantSlug
          });

          // Role check: KITCHEN staff shouldn't access POS Menu
          if (payload.role === 'KITCHEN' && pathname === `/${slug}/staff/menu`) {
            router.replace(`/${slug}/staff/orders`);
            return;
          }
        }
      }
      setLoading(false);
    }
  }, [pathname, router, slug]);

  const loginPath = `/${slug}/staff/login`;
  if (loading || pathname === loginPath) {
    return <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>{loading ? null : children}</div>;
  }

  const handleLogout = async () => {
    localStorage.removeItem('staff_token');
    document.cookie = 'staff_token=; Max-Age=0; path=/';
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (err) {
      console.error('Logout API failed:', err);
    }
    router.push(`/${slug}/staff/login`);
  };

  const navLinks = [
    ...(staff?.role !== 'KITCHEN' ? [{ name: 'Menu (POS)', href: `/${slug}/staff/menu`, icon: <UtensilsCrossed size={20} strokeWidth={2.5} /> }] : []),
    { name: 'Active Orders', href: `/${slug}/staff/orders`, icon: <ClipboardList size={20} strokeWidth={2.5} /> },
  ];

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', paddingBottom: '70px' }}>
      {/* Top Header */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 50, background: 'var(--card)',
        padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid var(--border)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '40px', height: '40px', borderRadius: '8px',
            backgroundColor: '#000000', color: 'white',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 800, fontSize: '18px', flexShrink: 0,
            overflow: 'hidden'
          }}>
            {restaurant?.logo_url ? (
              <img
                src={restaurant?.logo_url}
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
            ) : (
              staff?.restaurantName
                ? staff.restaurantName.charAt(0).toUpperCase()
                : '🌿'
            )}          </div>
          <div>
            <h2 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.2 }}>
              {staff?.restaurantName || 'Staff Portal'}
            </h2>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginTop: '1px' }}>
              {staff?.name} • <span style={{ fontWeight: 600, color: 'var(--primary)' }}>{staff?.role}</span>
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <ServiceToggle variant="light" />
          <button onClick={handleLogout} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, fontSize: '14px' }}>
            <LogOut size={18} /> <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </header>

      <main>
        {children}
      </main>

      {/* Bottom Nav for Staff */}
      <nav style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: 'var(--card)', borderTop: '1px solid var(--border)',
        display: 'flex', zIndex: 50, height: '64px'
      }}>
        {navLinks.map((link) => {
          const isActive = pathname.startsWith(link.href);
          return (
            <Link
              key={link.name} href={link.href}
              style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                color: isActive ? 'var(--primary)' : 'var(--text-secondary)',
                textDecoration: 'none', gap: '4px'
              }}
            >
              {link.icon}
              <span style={{ fontSize: '11px', fontWeight: isActive ? 700 : 500 }}>{link.name}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
