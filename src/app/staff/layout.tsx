'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { ClipboardList, UtensilsCrossed, LogOut } from 'lucide-react';
import { ServiceToggle } from '@/components/ServiceToggle';

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const staffToken = localStorage.getItem('staff_token');
    const hasCookie = document.cookie.includes('staff_token=');
    
    if (pathname === '/staff/login') {
      setLoading(false);
      return;
    }

    if (!staffToken && !hasCookie) {
      router.push('/staff/login');
    } else {
      setLoading(false);
    }
  }, [pathname, router]);

  if (loading || pathname === '/staff/login') {
    return <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>{loading ? null : children}</div>;
  }

  const handleLogout = () => {
    localStorage.removeItem('staff_token');
    document.cookie = 'staff_token=; Max-Age=0; path=/';
    router.push('/staff/login');
  };

  const navLinks = [
    { name: 'Menu (POS)', href: '/staff/menu', icon: <UtensilsCrossed size={20} strokeWidth={2.5} /> },
    { name: 'Active Orders', href: '/staff/orders', icon: <ClipboardList size={20} strokeWidth={2.5} /> },
  ];

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', paddingBottom: '70px' }}>
      {/* Top Header */}
      <header style={{ 
        position: 'sticky', top: 0, zIndex: 50, background: 'var(--card)', 
        padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid var(--border)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <img 
            src="https://ik.imagekit.io/j2q8x5lu0/Renjzkitchen/renjz.jpg" 
            alt="Renjz Kitchen" 
            style={{ width: '32px', height: '32px', borderRadius: '8px', objectFit: 'cover' }} 
          />
          <h2 style={{ fontSize: '18px', fontWeight: 800 }}>Staff POS</h2>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <ServiceToggle variant="light" />
          <button onClick={handleLogout} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
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
