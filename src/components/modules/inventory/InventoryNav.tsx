'use client';
import Link from 'next/link';
import { usePathname, useParams, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Boxes,
  Truck,
  Building2,
  Trash2,
  ChefHat,
  BarChart3,
} from 'lucide-react';

export function InventoryNav() {
  const router = useRouter();
  const pathname = usePathname() || '';
  const params = useParams();
  
  // Robust slug resolution: prioritize params, fallback to path segment
  const rawSlug = params?.slug;
  const slugStr = (Array.isArray(rawSlug) ? rawSlug[0] : rawSlug) || pathname.split('/').filter(Boolean)[0] || '';
  const basePath = `/${slugStr}/admin/inventory`;

  const tabs = [
    {
      name: 'Overview',
      href: `${basePath}`,
      icon: <LayoutDashboard size={15} />,
      exact: true,
    },
    {
      name: 'Ingredients',
      href: `${basePath}/ingredients`,
      icon: <Boxes size={15} />,
    },
    {
      name: 'Purchases & Receiving',
      href: `${basePath}/purchases`,
      icon: <Truck size={15} />,
    },
    {
      name: 'Suppliers',
      href: `${basePath}/suppliers`,
      icon: <Building2 size={15} />,
    },
    {
      name: 'Wastage & Stock Take',
      href: `${basePath}/wastage`,
      icon: <Trash2 size={15} />,
    },
    {
      name: 'BOM Recipes',
      href: `${basePath}/recipes`,
      icon: <ChefHat size={15} />,
    },
    {
      name: 'Reports',
      href: `${basePath}/reports`,
      icon: <BarChart3 size={15} />,
    },
  ];

  // Normalize pathname: remove search params and trailing slash for reliable active state comparison
  const cleanPath = pathname.split('?')[0].replace(/\/+$/, '');

  return (
    <>
      <style>{`
        .inventory-nav-scroll {
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
        .inventory-nav-scroll::-webkit-scrollbar {
          display: none;
        }
      `}</style>
      <div className="inventory-nav-scroll">
        {tabs.map((tab) => {
          const cleanHref = tab.href.replace(/\/+$/, '');
          const isActive = tab.exact
            ? cleanPath === cleanHref
            : cleanPath === cleanHref || cleanPath.startsWith(`${cleanHref}/`);

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
                padding: '9px 15px',
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
