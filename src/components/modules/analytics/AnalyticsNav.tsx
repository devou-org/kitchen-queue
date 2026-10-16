'use client';
import Link from 'next/link';
import { usePathname, useParams, useRouter } from 'next/navigation';

interface AnalyticsNavProps {
  inHeader?: boolean;
}

export function AnalyticsNav({ inHeader = false }: AnalyticsNavProps = {}) {
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
          align-items: stretch;
          gap: 0;
          overflow-x: auto;
          overscroll-behavior-x: contain;
          -webkit-overflow-scrolling: touch;
          touch-action: pan-x;
          border-top: none;
          height: 100%;
          min-height: ${inHeader ? 'auto' : '44px'};
          padding: 0;
          margin: 0;
          margin-bottom: ${inHeader ? '0' : '20px'};
          scrollbar-width: none;
          -ms-overflow-style: none;
          box-sizing: border-box;
          position: relative;
        }
        .analytics-nav-scroll::-webkit-scrollbar {
          display: none;
        }
        .analytics-nav-item {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          height: 100%;
          min-height: ${inHeader ? 'auto' : '44px'};
          box-sizing: border-box;
          padding: ${inHeader ? '0 28px' : '0 22px'};
          border-radius: 0;
          font-size: 14.5px;
          font-weight: 500;
          color: #475569;
          text-decoration: none;
          white-space: nowrap;
          flex-shrink: 0;
          cursor: pointer;
          user-select: none;
          touch-action: manipulation;
          -webkit-tap-highlight-color: transparent;
          border-top: 3.5px solid transparent;
          margin-top: 0;
          background-color: transparent;
          transition: all 0.15s ease-in-out;
        }
        .analytics-nav-item:hover:not(.analytics-nav-item--active) {
          color: #0F172A;
          background-color: rgba(0, 0, 0, 0.035);
        }
        .analytics-nav-item--active {
          font-weight: 600;
          color: var(--primary, #E11D48);
          background-color: rgba(225, 29, 72, 0.08);
          background-color: color-mix(in srgb, var(--primary, #E11D48) 9%, transparent);
          border-top: 3.5px solid var(--primary, #E11D48);
        }
        @media (max-width: 768px) {
          .analytics-nav-scroll {
            height: 44px !important;
            min-height: 44px !important;
            width: 100% !important;
          }
          .analytics-nav-item {
            height: 44px !important;
            min-height: 44px !important;
            padding: 0 20px !important;
            font-size: 13.5px !important;
          }
        }
      `}</style>
      <div className="analytics-nav-scroll">
        {tabs.map((tab) => {
          const isActive = tab.matches(cleanPath);

          return (
            <Link
              key={tab.name}
              href={tab.href}
              className={`analytics-nav-item ${isActive ? 'analytics-nav-item--active' : ''}`}
              onClick={(e) => {
                if (!e.defaultPrevented && e.button === 0 && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) {
                  router.push(tab.href);
                }
              }}
            >
              <span>{tab.name}</span>
            </Link>
          );
        })}
      </div>
    </>
  );
}

