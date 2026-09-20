'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { formatPrice } from '@/lib/format';
import { productService } from '@/app/services/products.api';
import { adminService } from '@/app/services/admin.api';
import { AdminContentWrapper } from '@/components/AdminContentWrapper';
import { AdminPageHeader } from '@/components/AdminPageHeader';
import { AnalyticsNav } from '@/components/modules/analytics/AnalyticsNav';
import { SalesAnalyticsChart } from '@/components/modules/analytics/SalesAnalyticsChart';
import { useRestaurant } from '@/hooks/useRestaurant';
import { Search } from 'lucide-react';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { Pagination } from '@/components/ui/Pagination';

export interface SalesItem {
  id: string;
  product_id?: string;
  product_name: string;
  category: string;
  price?: number;
  total_quantity: number;
  total_revenue: number;
  image_url?: string;
  [key: string]: any;
}

const CATEGORY_COLORS: Record<string, { bg: string; color: string }> = {
  'MAIN COURSE': { bg: 'rgba(151,19,69,0.1)', color: '#971345' },
  'SEAFOOD':     { bg: 'rgba(37,99,235,0.1)',  color: '#2563EB' },
  'BREADS':      { bg: 'rgba(217,119,6,0.1)',  color: '#D97706' },
  'BEVERAGES':   { bg: 'rgba(5,150,105,0.1)', color: '#059669' },
  'STARTERS':    { bg: 'rgba(124,58,237,0.1)', color: '#7C3AED' },
  'DESSERTS':    { bg: 'rgba(236,72,153,0.1)', color: '#EC4899' },
};

const getCategoryStyle = (cat: string) => {
  const norm = (cat || '').toUpperCase();
  return CATEGORY_COLORS[norm] || { bg: 'rgba(107,114,128,0.1)', color: '#6B7280' };
};

const CATEGORY_ICON: Record<string, string> = {
  'MAIN COURSE': '🍴',
  'SEAFOOD': '🦐',
  'BREADS': '🫓',
  'BEVERAGES': '☕',
  'STARTERS': '🥗',
  'DESSERTS': '🍮',
};
const getIcon = (cat: string) => {
  const norm = (cat || '').toUpperCase();
  return CATEGORY_ICON[norm] || '🍽️';
};

const PAGE_SIZE = 10;

export default function AdminSalesAnalyticsPage() {
  const { slug } = useParams();
  const { restaurant } = useRestaurant();
  const [items, setItems] = useState<SalesItem[]>([]);
  const [categories, setCategories] = useState<string[]>(['All']);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [page, setPage] = useState(1);
  const [dateFrom, setDateFrom] = useState(() =>
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date())
  );
  const [dateTo, setDateTo] = useState(() =>
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date())
  );
  const [orderCount, setOrderCount] = useState(0);
  const [overallRevenue, setOverallRevenue] = useState(0);
  const [dailyData, setDailyData] = useState<any[]>([]);
  const [paymentData, setPaymentData] = useState<any[]>([]);

  const fetchData = useCallback(async (manualFrom?: string, manualTo?: string) => {
    setLoading(true);
    try {
      const from = manualFrom || dateFrom;
      const to = manualTo || dateTo;

      const [topProdRes, catRes, dailyRes, paymentRes] = await Promise.all([
        adminService.getTopProducts({
          limit: 100,
          date_from: from,
          date_to: to,
        }),
        productService.getCategories(),
        adminService.getDailyAnalytics(from, to),
        adminService.getPaymentMethodAnalytics(from, to),
      ]);

      if (topProdRes.success && topProdRes.data) setItems(topProdRes.data);
      
      const availableCategories = new Set<string>();
      if (catRes.success && Array.isArray(catRes.data)) {
        catRes.data.forEach((c: any) => {
          const name = c.name?.trim();
          if (name && name !== 'All') availableCategories.add(name);
        });
      }
      if (topProdRes.success && Array.isArray(topProdRes.data)) {
        topProdRes.data.forEach((p: any) => {
          const name = p.category?.trim();
          if (name && name !== 'All') availableCategories.add(name);
        });
      }
      setCategories(['All', ...Array.from(availableCategories)]);

      if (dailyRes.success && dailyRes.data) {
        setDailyData(dailyRes.data as any[]);
        const totalOrd = (dailyRes.data as any[]).reduce((sum, day) => sum + Number(day.total_orders || 0), 0);
        const totalRev = (dailyRes.data as any[]).reduce((sum, day) => sum + Number(day.revenue || 0), 0);
        setOrderCount(totalOrd);
        setOverallRevenue(totalRev);
      } else {
        setDailyData([]);
        setOrderCount(0);
        setOverallRevenue(0);
      }

      if (paymentRes.success && paymentRes.data) {
        setPaymentData(paymentRes.data as any[]);
      } else {
        setPaymentData([]);
      }
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  // Initial fetch on mount
  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = items.filter((i) => {
    const matchCat = categoryFilter === 'All' || i.category === categoryFilter;
    const matchSearch = (i.product_name || '').toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const filteredRevenue = filtered.reduce((s, i) => s + Number(i.total_revenue), 0);
  const totalUnits = filtered.reduce((s, i) => s + Number(i.total_quantity), 0);

  const displayRevenue = search || categoryFilter !== 'All' ? filteredRevenue : overallRevenue;
  const avgOrderValue = orderCount > 0 ? overallRevenue / orderCount : 0;

  return (
    <AdminContentWrapper>
      <AdminPageHeader
        title="Analytics"
        subtitle="Comprehensive sales insights, top-selling dishes, and revenue tracking."
      />

      {/* Header Sub Buttons (AnalyticsNav) */}
      <AnalyticsNav />

      {/* Date Range Filter */}
      <div
        className="card"
        style={{
          marginBottom: '20px',
          display: 'flex',
          gap: '16px',
          alignItems: 'flex-end',
          flexWrap: 'wrap',
          borderRadius: '12px',
        }}
      >
        <div>
          <label className="label">From</label>
          <input
            type="date"
            className="input"
            value={dateFrom}
            max={dateTo}
            onChange={(e) => setDateFrom(e.target.value)}
            style={{ width: '160px' }}
          />
        </div>
        <div>
          <label className="label">To</label>
          <input
            type="date"
            className="input"
            value={dateTo}
            min={dateFrom}
            onChange={(e) => setDateTo(e.target.value)}
            style={{ width: '160px' }}
          />
        </div>
        <button
          className="btn btn-primary"
          onClick={() => {
            fetchData();
            setPage(1);
          }}
          style={{ marginBottom: '2px' }}
        >
          Apply
        </button>
      </div>

      {/* Sales Graph */}
      <SalesAnalyticsChart
        dailyData={dailyData}
        topProducts={items}
        paymentMethods={paymentData}
        primaryColor={restaurant?.primary_color || '#971345'}
        dateFrom={dateFrom}
        dateTo={dateTo}
        loading={loading}
      />

      {/* Summary Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
          marginBottom: '24px',
        }}
      >
        <div className="stat-card" style={{ borderLeftColor: 'var(--primary)' }}>
          <p className="stat-label">Total Revenue</p>
          <h3 className="stat-value" style={{ color: 'var(--primary)' }}>
            {formatPrice(displayRevenue)}
          </h3>
          <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Revenue from completed orders
          </p>
        </div>
        <div className="stat-card" style={{ borderLeftColor: '#059669' }}>
          <p className="stat-label">Units Sold</p>
          <h3 className="stat-value" style={{ color: '#059669' }}>
            {totalUnits.toLocaleString()}
          </h3>
          <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Total items purchased
          </p>
        </div>
        <div className="stat-card" style={{ borderLeftColor: '#6366F1' }}>
          <p className="stat-label">Avg Order Value</p>
          <h3 className="stat-value" style={{ color: '#6366F1' }}>
            {formatPrice(avgOrderValue)}
          </h3>
          <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Per completed order
          </p>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', width: '100%', maxWidth: '280px' }}>
          <Search
            size={18}
            color="var(--text-secondary)"
            style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              pointerEvents: 'none',
            }}
          />
          <input
            type="search"
            className="input"
            placeholder="Search item name..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            style={{ width: '100%', paddingLeft: '40px' }}
          />
        </div>
        <CustomSelect
          style={{ width: '200px' }}
          value={categoryFilter}
          onChange={(val) => {
            setCategoryFilter(val);
            setPage(1);
          }}
          options={categories.map((c) => ({ value: c, label: c }))}
        />
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden', borderRadius: '12px' }}>
        <div className="table-wrapper" style={{ border: 'none', borderRadius: 0, overflowX: 'auto' }}>
          {loading ? (
            <div style={{ padding: '60px', display: 'flex', justifyContent: 'center' }}>
              <div className="loader" style={{ width: 40, height: 40, borderWidth: 4 }} />
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Item Name</th>
                  <th>Category</th>
                  <th style={{ textAlign: 'center' }}>Qty Sold</th>
                  <th style={{ textAlign: 'right' }}>Unit Price</th>
                  <th style={{ textAlign: 'right' }}>Total Rev</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((item, idx) => {
                  const catStyle = getCategoryStyle(item.category);
                  return (
                    <tr key={`${item.product_id || item.id}-${idx}`}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: 8,
                              background: item.image_url ? 'transparent' : catStyle.bg,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: 18,
                              flexShrink: 0,
                              overflow: 'hidden',
                              border: item.image_url ? '1px solid var(--border)' : 'none',
                            }}
                          >
                            {item.image_url ? (
                              <img
                                src={item.image_url}
                                alt={item.product_name}
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none';
                                  (e.target as HTMLImageElement).parentElement!.style.background = catStyle.bg;
                                  (e.target as HTMLImageElement).parentElement!.innerText = getIcon(item.category);
                                }}
                              />
                            ) : (
                              getIcon(item.category)
                            )}
                          </div>
                          <div>
                            <span style={{ fontWeight: 600, display: 'block' }}>{item.product_name}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: 700,
                            background: catStyle.bg,
                            color: catStyle.color,
                          }}
                        >
                          {getIcon(item.category)} {item.category || 'General'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center', fontWeight: 700 }}>
                        {Number(item.total_quantity).toLocaleString()}
                      </td>
                      <td style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>
                        {item.price ? formatPrice(item.price) : '—'}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--primary)' }}>
                        {formatPrice(item.total_revenue)}
                      </td>
                    </tr>
                  );
                })}
                {paginated.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                      No sales data found for the selected filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
        {!loading && totalPages > 1 && (
          <div style={{ padding: '16px', borderTop: '1px solid var(--border)' }}>
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              onPageChange={(p) => setPage(p)}
              pageSize={PAGE_SIZE}
              totalRecords={filtered.length}
            />
          </div>
        )}
      </div>
    </AdminContentWrapper>
  );
}

