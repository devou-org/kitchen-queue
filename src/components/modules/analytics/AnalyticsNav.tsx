'use client';
import Link from 'next/link';
import { usePathname, useParams, useRouter } from 'next/navigation';
import { TrendingUp, Wallet } from 'lucide-react';

export function AnalyticsNav() {
  const router = useRouter();
  const pathname = usePathname() || '';
  const params = useParams();

  const rawSlug = params?.slug;
  const slugStr = (Array.isArray(rawSlug) ? rawSlug[0] : rawSlug) || pathname.split('/').filter(Boolean)[0] || '';
  const basePath = `/${slugStr}/admin/analytics`;

  const tabs = [
    {
      name: 'Sales',
      href: `${basePath}/sales`,
      fallbackHref: `${basePath}`,
      icon: <TrendingUp size={15} />,
      matches: (path: string) =>
        path === basePath ||
        path === `${basePath}/sales` ||
        path.startsWith(`${basePath}/sales/`) ||
        path === `/${slugStr}/admin/sales` ||
        path.startsWith(`/${slugStr}/admin/sales/`),
    },
    {
      name: 'Statements',
      href: `${basePath}/statements`,
      fallbackHref: `${basePath}/statements`,
      icon: <Wallet size={15} />,
      matches: (path: string) =>
        path === `${basePath}/statements` ||
        path.startsWith(`${basePath}/statements/`) ||
        path === `/${slugStr}/admin/statements` ||
        path.startsWith(`/${slugStr}/admin/statements/`),
    },
  ];

  const cleanPath = pathname.split('?')[0].replace(/\/+$/, '');

  return (
    <>
      <style>{`
        .analytics-nav-scroll {
          display: flex;
          align-items: center;
          gap: 8px;
          overflow-x: auto;
          overscroll-behavior-x: contain;
          -webkit-overflow-scrolling: touch;
          touch-action: pan-x;
          padding: 4px 12px 14px 0;
          border-bottom: 1px solid var(--border, #E2E8F0);
          margin-bottom: 20px;
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .analytics-nav-scroll::-webkit-scrollbar {
          display: none;
        }
      `}</style>
      <div className="analytics-nav-scroll">
        {tabs.map((tab) => {
          const isActive = tab.matches(cleanPath);

          return (
            <Link
              key={tab.name}
              href={tab.href}
              onClick={(e) => {
                if (!e.defaultPrevented && e.button === 0 && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) {
                  router.push(tab.href);
                }
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '9px 16px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: isActive ? 700 : 500,
                color: isActive ? '#FFFFFF' : '#64748B',
                backgroundColor: isActive ? 'var(--primary, #971345)' : '#F8FAFC',
                border: isActive ? '1px solid transparent' : '1px solid #E2E8F0',
                textDecoration: 'none',
                whiteSpace: 'nowrap',
                flexShrink: 0,
                cursor: 'pointer',
                userSelect: 'none',
                touchAction: 'manipulation',
                WebkitTapHighlightColor: 'transparent',
                transition: 'all 0.15s ease',
              }}
            >
              {tab.icon}
              <span>{tab.name}</span>
            </Link>
          );
        })}
      </div>
    </>
  );
}

