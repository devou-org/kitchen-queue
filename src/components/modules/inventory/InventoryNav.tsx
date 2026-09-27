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

interface InventoryNavProps {
  inHeader?: boolean;
}

export function InventoryNav({ inHeader = false }: InventoryNavProps = {}) {
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
          border-bottom: ${inHeader ? 'none' : '1px solid var(--border, #E2E8F0)'};
          background-color: ${inHeader ? 'transparent' : '#FFFFFF'};
          scrollbar-width: none;
          -ms-overflow-style: none;
          box-sizing: border-box;
          position: relative;
        }
        .inventory-nav-scroll::-webkit-scrollbar {
          display: none;
        }
        .inventory-nav-item {
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
        .inventory-nav-item:hover:not(.inventory-nav-item--active) {
          color: #0F172A;
          background-color: rgba(0, 0, 0, 0.035);
        }
        .inventory-nav-item--active {
          font-weight: 600;
          color: var(--primary, #E11D48);
          background-color: rgba(225, 29, 72, 0.08);
          background-color: color-mix(in srgb, var(--primary, #E11D48) 9%, transparent);
          border-top: 3.5px solid var(--primary, #E11D48);
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
              className={`inventory-nav-item ${isActive ? 'inventory-nav-item--active' : ''}`}
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
