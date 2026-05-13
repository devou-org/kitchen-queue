'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, UtensilsCrossed, History } from 'lucide-react';

export default function BottomNav() {
  const pathname = usePathname();

  const isActive = (path: string) => pathname.startsWith(path);

  return (
    <nav className="bottom-nav" style={{ height: '70px', paddingBottom: 'calc(env(safe-area-inset-bottom) + 4px)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', width: '100%', position: 'relative' }}>
        
        {/* Status Link */}
        <Link prefetch={false} href="/order-status"
          prefetch={false}
          className={`bottom-nav-item ${isActive('/order-status') ? 'active' : ''}`}
          style={{ flex: 1 }}
        >
          <LayoutDashboard size={22} strokeWidth={isActive('/order-status') ? 2.5 : 2} />
          <span style={{ marginTop: '4px', fontSize: '10px', fontWeight: 700 }}>STATUS</span>
        </Link>

        {/* Center Menu Button (FAB Style) */}
        <div style={{ position: 'relative', top: '-15px', width: '70px', height: '70px', display: 'flex', justifyContent: 'center' }}>
          <Link prefetch={false} href="/menu" 
            prefetch={false} 
            className="bottom-nav-center"
            style={{ 
              width: '64px', 
              height: '64px', 
              background: '#800020', // Maroon color from image
              boxShadow: '0 8px 20px rgba(128, 0, 32, 0.4)',
              border: '4px solid white'
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'center' }}>
                <div style={{ width: '18px', height: '2px', background: 'white', borderRadius: '1px' }} />
                <div style={{ width: '18px', height: '2px', background: 'white', borderRadius: '1px' }} />
                <div style={{ width: '18px', height: '2px', background: 'white', borderRadius: '1px' }} />
              </div>
              <span style={{ fontSize: '9px', fontWeight: 800, letterSpacing: '0.05em', color: 'white' }}>MENU</span>
            </div>
          </Link>
        </div>

        {/* History Link */}
        <Link prefetch={false} href="/history"
          prefetch={false}
          className={`bottom-nav-item ${isActive('/history') ? 'active' : ''}`}
          style={{ flex: 1 }}
        >
          <History size={22} strokeWidth={isActive('/history') ? 2.5 : 2} />
          <span style={{ marginTop: '4px', fontSize: '10px', fontWeight: 700 }}>HISTORY</span>
        </Link>

      </div>
    </nav>
  );
}
