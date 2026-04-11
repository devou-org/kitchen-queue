'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function BottomNav() {
  const pathname = usePathname();

  const isActive = (path: string) => pathname === path;

  return (
    <nav className="bottom-nav">
      {/* Nav Icons Row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', width: '100%' }}>
        <Link
          href="/order-status"
          className={`bottom-nav-item ${isActive('/order-status') ? 'active' : ''}`}
        >
          <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
          </svg>
          STATUS
        </Link>
        <Link href="/menu" className="bottom-nav-center">
          <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M3 3h18v18H3z M9 3v18M15 3v18M3 9h18M3 15h18"/>
          </svg>
          <span style={{ fontSize: '9px', letterSpacing: '0.05em' }}>MENU</span>
        </Link>
        <Link
          href="/history"
          className={`bottom-nav-item ${isActive('/history') ? 'active' : ''}`}
        >
          <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>
          </svg>
          PROFILE
        </Link>
      </div>

      {/* Devou Credit — below nav icons */}
      {/* <div style={{
        width: '100%',
        textAlign: 'center',
        fontSize: '10px',
        color: 'var(--text-secondary)',
        fontWeight: 500,
        letterSpacing: '0.03em',
        padding: '6px 0 calc(env(safe-area-inset-bottom) + 2px)',
        marginTop: '4px',
        borderTop: '1px solid var(--border)',
      }}>
        Crafted with ♥ by{' '}
        <a
          href="https://devou.in"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: 'var(--primary)',
            fontWeight: 700,
            textDecoration: 'none',
            letterSpacing: '0.04em',
          }}
        >
          Devou
        </a>
      </div> */}
    </nav>
  );
}
