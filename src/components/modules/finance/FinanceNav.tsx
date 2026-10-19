'use client';
import Link from 'next/link';
import { usePathname, useParams, useRouter } from 'next/navigation';

interface FinanceNavProps {
  inHeader?: boolean;
}

export function FinanceNav({ inHeader = false }: FinanceNavProps = {}) {
  const router = useRouter();
  const pathname = usePathname() || '';
  const params = useParams();

  const rawSlug = params?.slug;
  const slugStr = (Array.isArray(rawSlug) ? rawSlug[0] : rawSlug) || pathname.split('/').filter(Boolean)[0] || '';
  const basePath = `/${slugStr}/admin/finance`;

  const tabs = [
    {
      name: 'Overview & P&L',
      href: `${basePath}`,
      exact: true,
    },
    {
      name: 'Petty Cash & Overheads',
      href: `${basePath}/expenses`,
    },
    {
      name: 'Till Reconciliation',
      href: `${basePath}/till`,
    },
    {
      name: 'Tax & Compliance',
      href: `${basePath}/tax`,
    },
    {
      name: 'Ledger & Audit',
      href: `${basePath}/ledger`,
    },
  ];

  const cleanPath = pathname.split('?')[0].replace(/\/+$/, '');

  return (
    <>
      <style>{`
        .finance-nav-scroll {
          display: flex;
          align-items: stretch;
          gap: 0;
          overflow-x: auto;
          overscroll-behavior-x: contain;
          -webkit-overflow-scrolling: touch;
          touch-action: pan-x;
          border-top: none;
          height: 100%;
          min-height: ${inHeader ? 'auto' : '48px'};
          padding: 0;
          margin: 0;
          margin-bottom: ${inHeader ? '0' : '20px'};
          scrollbar-width: none;
          -ms-overflow-style: none;
          box-sizing: border-box;
          position: relative;
        }
        .finance-nav-scroll::-webkit-scrollbar {
          display: none;
        }
        .finance-nav-item {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          height: 100%;
          min-height: ${inHeader ? 'auto' : '48px'};
          box-sizing: border-box;
          padding: ${inHeader ? '0 20px' : '0 18px'};
          border-radius: 0;
          font-size: 13.5px;
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
        .finance-nav-item:hover:not(.finance-nav-item--active) {
          color: #0F172A;
          background-color: rgba(0, 0, 0, 0.035);
        }
        .finance-nav-item--active {
          font-weight: 600;
          color: var(--primary, #971345);
          background-color: color-mix(in srgb, var(--primary, #971345) 9%, transparent);
          border-top: 3.5px solid var(--primary, #971345);
        }

        @media (max-width: 768px) {
          .finance-nav-scroll {
            height: 44px !important;
            min-height: 44px !important;
            width: 100% !important;
          }
          .finance-nav-item {
            height: 44px !important;
            min-height: 44px !important;
            padding: 0 16px !important;
            font-size: 13px !important;
          }
        }
      `}</style>
      <div className="finance-nav-scroll">
        {tabs.map((tab) => {
          const cleanHref = tab.href.replace(/\/+$/, '');
          const isActive = tab.exact
            ? cleanPath === cleanHref
            : cleanPath === cleanHref || cleanPath.startsWith(`${cleanHref}/`);

          return (
            <Link
              key={tab.name}
              href={tab.href}
              className={`finance-nav-item ${isActive ? 'finance-nav-item--active' : ''}`}
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
