'use client';
import Link from 'next/link';
import { usePathname, useParams } from 'next/navigation';
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
  const pathname = usePathname();
  const { slug } = useParams();
  const slugStr = Array.isArray(slug) ? slug[0] : slug;
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

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        overflowX: 'auto',
        padding: '4px 0 16px 0',
        borderBottom: '1px solid var(--border, #E2E8F0)',
        marginBottom: '20px',
      }}
      className="no-scrollbar"
    >
      {tabs.map((tab) => {
        const isActive = tab.exact
          ? pathname === tab.href
          : pathname === tab.href || pathname.startsWith(`${tab.href}/`);

        return (
          <Link
            key={tab.name}
            href={tab.href}
            prefetch={false}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: isActive ? 700 : 500,
              color: isActive ? '#FFFFFF' : '#64748B',
              backgroundColor: isActive ? 'var(--primary, #0F172A)' : '#F8FAFC',
              border: isActive ? '1px solid transparent' : '1px solid #E2E8F0',
              textDecoration: 'none',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s ease',
            }}
          >
            {tab.icon}
            <span>{tab.name}</span>
          </Link>
        );
      })}
    </div>
  );
}
