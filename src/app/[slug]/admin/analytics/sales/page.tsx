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
import { Search, Utensils, MoveHorizontal } from 'lucide-react';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { Pagination } from '@/components/ui/Pagination';
import { LayoutMaximizeToggle } from '@/components/LayoutMaximizeToggle';

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

function ProductThumbnail({ src, alt }: { src?: string; alt: string }) {
  const [error, setError] = useState(false);

  if (!src || error) {
    return (
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 8,
          background: '#F1F5F9',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          border: '1px solid #E2E8F0',
          color: '#64748B',
        }}
      >
        <Utensils size={16} strokeWidth={2} />
      </div>
    );
  }

  return (
    <div
      style={{
        width: 36,
        height: 36,
        borderRadius: 8,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        overflow: 'hidden',
        border: '1px solid var(--border)',
        background: '#FFFFFF',
      }}
    >
      <img
        src={src}
        alt={alt}
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        onError={() => setError(true)}
      />
    </div>
  );
}

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
  const [dateTo, setDateTo] = useState(() =>
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date())
  );
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(d);
  });
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
    <AdminContentWrapper fullWidth style={{ paddingTop: 0, paddingLeft: 0, paddingRight: 0, maxWidth: '100%' }}>
      <style>{`
        .analytics-page-header,
        .analytics-page-header.admin-page-header-container {
          height: 68px !important;
          min-height: 68px !important;
          display: flex !important;
          align-items: stretch !important;
          margin: 0 !important;
          padding: 0 20px 0 0 !important;
          border-bottom: 1px solid var(--border) !important;
          background: #FFFFFF !important;
          box-sizing: border-box !important;
          position: relative !important;
        }

        .analytics-page-header .admin-page-header-container {
          height: 68px !important;
          min-height: 68px !important;
          display: flex !important;
          align-items: stretch !important;
          margin: 0 !important;
          padding: 0 !important;
          gap: 12px !important;
          width: 100% !important;
        }

        .analytics-page-header .admin-header-left,
        .analytics-page-header .admin-header-search {
          height: 68px !important;
          display: flex !important;
          align-items: stretch !important;
          flex-wrap: nowrap !important;
          width: 100% !important;
          margin: 0 !important;
          padding: 0 !important;
        }

        .analytics-toolbar {
          display: flex !important;
          flex-wrap: nowrap !important;
          align-items: stretch !important;
          justify-content: space-between !important;
          gap: 12px !important;
          width: 100% !important;
          height: 68px !important;
          min-width: 0 !important;
          margin: 0 !important;
          padding: 0 !important;
        }

        .analytics-tabs-wrapper {
          display: flex !important;
          align-items: stretch !important;
          height: 68px !important;
          min-height: 68px !important;
          padding-top: 10px !important;
          padding-right: 0 !important;
          padding-bottom: 0 !important;
          padding-left: 0 !important;
          box-sizing: border-box !important;
          flex-shrink: 0 !important;
          margin: 0 !important;
        }

        .analytics-filters {
          display: flex !important;
          flex-wrap: nowrap !important;
          align-items: center !important;
          gap: 8px !important;
          min-width: 0 !important;
        }

        .analytics-dates-row {
          display: flex !important;
          align-items: center !important;
          gap: 8px !important;
        }

        .analytics-actions {
          display: flex !important;
          flex-wrap: nowrap !important;
          align-items: center !important;
          gap: 8px !important;
          margin-left: auto !important;
          flex-shrink: 0 !important;
          height: 68px !important;
        }

        .sales-scroll-hint {
          display: none !important;
        }

        @media (max-width: 768px) {
          .analytics-page-header,
          .analytics-page-header.admin-page-header-container {
            height: auto !important;
            min-height: auto !important;
            padding: 0 !important;
            margin: 0 !important;
            display: flex !important;
            flex-direction: column !important;
            align-items: stretch !important;
            border-bottom: 1px solid var(--border) !important;
            background: #FFFFFF !important;
          }

          .analytics-page-header .admin-page-header-container,
          .analytics-page-header .admin-header-left,
          .analytics-page-header .admin-header-search {
            height: auto !important;
            min-height: auto !important;
            width: 100% !important;
            display: flex !important;
            flex-direction: column !important;
            align-items: stretch !important;
            padding: 0 !important;
            margin: 0 !important;
          }

          .analytics-toolbar {
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 0 !important;
            height: auto !important;
            min-height: auto !important;
            width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
          }

          .analytics-tabs-wrapper {
            width: 100% !important;
            height: 44px !important;
            min-height: 44px !important;
            padding: 0 !important;
            border-bottom: 1px solid var(--border) !important;
            box-sizing: border-box !important;
            background: #FFFFFF !important;
          }

          .analytics-actions {
            width: 100% !important;
            height: auto !important;
            min-height: auto !important;
            margin-left: 0 !important;
            padding: 10px 14px !important;
            background: #F8FAFC !important;
            border-bottom: 1px solid var(--border) !important;
            box-sizing: border-box !important;
            display: flex !important;
            flex-direction: column !important;
            gap: 8px !important;
          }

          .analytics-filters {
            width: 100% !important;
            display: flex !important;
            flex-direction: column !important;
            gap: 8px !important;
          }

          .analytics-dates-row {
            display: grid !important;
            grid-template-columns: 1fr 1fr !important;
            gap: 8px !important;
            width: 100% !important;
          }

          .analytics-date-field {
            display: flex !important;
            align-items: center !important;
            gap: 6px !important;
            width: 100% !important;
            min-width: 0 !important;
          }

          .analytics-date-input {
            width: 100% !important;
            min-width: 0 !important;
            height: 36px !important;
            box-sizing: border-box !important;
            padding: 0 8px !important;
            font-size: 12px !important;
          }

          .sales-apply-button {
            width: 100% !important;
            height: 36px !important;
            justify-content: center !important;
          }

          .analytics-maximize-wrapper {
            display: none !important;
          }

          /* Sales Graph Container on Mobile */
          .sales-graph-container {
            padding: 14px 12px 18px 12px !important;
          }

          /* Secondary Filter Bar on Mobile */
          .sales-filter-bar {
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 10px !important;
            padding: 12px 14px !important;
          }

          .sales-search-wrapper {
            width: 100% !important;
            max-width: 100% !important;
            min-width: 0 !important;
          }

          .sales-category-wrapper {
            width: 100% !important;
            max-width: 100% !important;
            min-width: 0 !important;
          }

          .sales-category-wrapper > div,
          .sales-category-wrapper button {
            width: 100% !important;
          }

          .sales-scroll-hint {
            display: flex !important;
            align-items: center;
            gap: 6px;
            padding: 8px 14px;
            font-size: 11px;
            color: #64748B;
            background: #F8FAFC;
            border-bottom: 1px solid var(--border);
          }

          .sales-table {
            min-width: 580px !important;
          }

          .sales-table th,
          .sales-table td {
            padding-left: 14px !important;
            padding-right: 14px !important;
          }
        }
      `}</style>
      <AdminPageHeader
        className="analytics-page-header"
        style={{ paddingTop: 0, marginBottom: 0 }}
        hideMaximize={true}
        search={
          <div className="analytics-toolbar">
            {/* Left Side (Starting): Tabs */}
            <div className="analytics-tabs-wrapper">
              <AnalyticsNav inHeader={true} />
            </div>

            {/* Right Side: Date Filters (From, To, Apply) and Maximize button */}
            <div className="analytics-actions">
              <div className="analytics-filters">
                <div className="analytics-dates-row">
                  <div className="analytics-date-field">
                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748B', whiteSpace: 'nowrap' }}>From</span>
                    <input
                      type="date"
                      value={dateFrom}
                      max={dateTo}
                      onChange={(e) => setDateFrom(e.target.value)}
                      className="analytics-date-input"
                      style={{
                        height: '38px',
                        width: '135px',
                        padding: '0 8px',
                        fontSize: '12px',
                        borderRadius: '8px',
                        background: 'white',
                        border: '1px solid var(--border)',
                        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
                        outline: 'none',
                        color: 'var(--text-primary)',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                  <div className="analytics-date-field">
                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748B', whiteSpace: 'nowrap' }}>To</span>
                    <input
                      type="date"
                      value={dateTo}
                      min={dateFrom}
                      onChange={(e) => setDateTo(e.target.value)}
                      className="analytics-date-input"
                      style={{
                        height: '38px',
                        width: '135px',
                        padding: '0 8px',
                        fontSize: '12px',
                        borderRadius: '8px',
                        background: 'white',
                        border: '1px solid var(--border)',
                        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
                        outline: 'none',
                        color: 'var(--text-primary)',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    fetchData();
                    setPage(1);
                  }}
                  className="sales-apply-button"
                  style={{
                    height: '38px',
                    padding: '0 16px',
                    borderRadius: '8px',
                    background: 'var(--primary, #971345)',
                    color: '#FFFFFF',
                    fontSize: '12px',
                    fontWeight: 700,
                    border: 'none',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.08)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Apply
                </button>
              </div>

              {/* Left Border Separator */}
              <div className="analytics-maximize-wrapper" style={{ borderLeft: '1px solid #E2E8F0', paddingLeft: '8px', display: 'flex', alignItems: 'center', height: '32px' }}>
                <LayoutMaximizeToggle />
              </div>
            </div>
          </div>
        }
      />

      <div style={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box', margin: 0, padding: 0 }}>

      {/* Sales Graph */}
      <div className="sales-graph-container" style={{ width: '100%', background: '#FFFFFF', borderBottom: '1px solid var(--border)', padding: '20px 24px 24px 24px', boxSizing: 'border-box' }}>
        <SalesAnalyticsChart
          dailyData={dailyData}
          topProducts={items}
          paymentMethods={paymentData}
          primaryColor={restaurant?.primary_color || '#971345'}
          dateFrom={dateFrom}
          dateTo={dateTo}
          loading={loading}
          avgOrderValue={avgOrderValue}
        />
      </div>

      {/* Filters */}
      <div className="sales-filter-bar" style={{ display: 'flex', gap: '12px', padding: '16px 24px', margin: 0, background: '#FFFFFF', borderBottom: '1px solid var(--border)', flexWrap: 'wrap', alignItems: 'center' }}>
        <div className="sales-search-wrapper" style={{ position: 'relative', width: '100%', maxWidth: '280px' }}>
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
        <div className="sales-category-wrapper" style={{ width: '200px' }}>
          <CustomSelect
            style={{ width: '100%' }}
            value={categoryFilter}
            onChange={(val) => {
              setCategoryFilter(val);
              setPage(1);
            }}
            options={categories.map((c) => ({ value: c, label: c }))}
          />
        </div>
      </div>

      {/* Table */}
      <div style={{ width: '100%', padding: 0, overflow: 'hidden', borderRadius: 0, border: 'none', boxShadow: 'none', margin: 0, background: '#FFFFFF' }}>
        <div className="sales-scroll-hint" aria-hidden="true">
          <MoveHorizontal size={13} style={{ flexShrink: 0 }} />
          <span>Swipe horizontally to view full sales details</span>
        </div>
        <div className="table-wrapper" style={{ border: 'none', borderRadius: 0, overflowX: 'auto', width: '100%', margin: 0 }}>
          {loading ? (
            <div style={{ padding: '60px', display: 'flex', justifyContent: 'center' }}>
              <div className="loader" style={{ width: 40, height: 40, borderWidth: 4 }} />
            </div>
          ) : (
            <table className="sales-table" style={{ width: '100%', borderCollapse: 'collapse', margin: 0 }}>
              <thead>
                <tr style={{ background: '#F8FAFC', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ paddingLeft: '24px' }}>Item Name</th>
                  <th>Category</th>
                  <th style={{ textAlign: 'center' }}>Qty Sold</th>
                  <th style={{ textAlign: 'right' }}>Unit Price</th>
                  <th style={{ textAlign: 'right', paddingRight: '24px' }}>Total Rev</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((item, idx) => {
                  const catStyle = getCategoryStyle(item.category);
                  return (
                    <tr key={`${item.product_id || item.id}-${idx}`} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ paddingLeft: '24px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <ProductThumbnail src={item.image_url} alt={item.product_name} />
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
                            padding: '3px 8px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: 700,
                            background: catStyle.bg,
                            color: catStyle.color,
                          }}
                        >
                          {item.category || 'General'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center', fontWeight: 700 }}>
                        {Number(item.total_quantity).toLocaleString()}
                      </td>
                      <td style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>
                        {item.price ? formatPrice(item.price) : '—'}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--primary)', paddingRight: '24px' }}>
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
          <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)' }}>
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
      </div>
    </AdminContentWrapper>
  );
}

