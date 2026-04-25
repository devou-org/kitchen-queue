'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { formatPrice } from '@/lib/format';
import { inventoryService, InventoryItem } from '@/app/services/inventory.api';

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

export default function AdminInventorySummary() {
  const [items, setItems] = useState<InventoryItem[]>([]);
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

  const fetchData = useCallback(async (manualFrom?: string, manualTo?: string) => {
    setLoading(true);
    try {
      const from = manualFrom || dateFrom;
      const to = manualTo || dateTo;
      
      const [invRes, catRes, dailyRes] = await Promise.all([
        inventoryService.getTopProducts({
          limit: 100,
          date_from: from,
          date_to: to,
        }),
        inventoryService.getCategories(),
        fetch(`/api/analytics?type=daily&date_from=${from}&date_to=${to}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('admin_token') || localStorage.getItem('auth_token')}`
          }
        }).then(res => res.json())
      ]);

      if (invRes.success && invRes.data) setItems(invRes.data);
      if (catRes.success && catRes.data) {
        const uniqueCats = Array.from(new Set(
          catRes.data
            .map((c: any) => c.name?.trim())
            .filter((name: string) => name && name !== 'All')
        ));
        setCategories(['All', ...uniqueCats]);
      }

      if (dailyRes.success && dailyRes.data) {
        const totalOrd = (dailyRes.data as any[]).reduce((sum, day) => sum + Number(day.total_orders || 0), 0);
        setOrderCount(totalOrd);
      } else {
        setOrderCount(0);
      }
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  // Initial fetch on mount only
  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);



  const filtered = items.filter(i => {
    const matchCat = categoryFilter === 'All' || i.category === categoryFilter;
    const matchSearch = (i.product_name || '').toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const totalRevenue = filtered.reduce((s, i) => s + Number(i.total_revenue), 0);
  const totalUnits = filtered.reduce((s, i) => s + Number(i.total_quantity), 0);
  const avgOrderValue = orderCount > 0 ? totalRevenue / orderCount : 0;

  return (
    <div className="page-content-admin animate-fade-in">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 800 }}>Sales Summary</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Detailed sales and revenue performance by item.</p>
        </div>
        <Link href="/admin/products" className="btn btn-secondary">← Back to Products</Link>
      </div>

      {/* Date Range Filter */}
      <div className="card" style={{ marginBottom: '20px', display: 'flex', gap: '16px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div>
          <label className="label">From</label>
          <input
            type="date"
            className="input"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            style={{ width: '160px' }}
          />
        </div>
        <div>
          <label className="label">To</label>
          <input
            type="date"
            className="input"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            style={{ width: '160px' }}
          />
        </div>
        <button className="btn btn-primary" onClick={() => { fetchData(); setPage(1); }} style={{ marginBottom: '2px' }}>
          Apply
        </button>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div className="stat-card">
          <p className="stat-label">Total Revenue</p>
          <h3 className="stat-value" style={{ color: 'var(--primary)' }}>{formatPrice(totalRevenue)}</h3>
        </div>
        <div className="stat-card">
          <p className="stat-label">Units Sold</p>
          <h3 className="stat-value">{totalUnits.toLocaleString()}</h3>
        </div>
        <div className="stat-card">
          <p className="stat-label">Avg Order Value</p>
          <h3 className="stat-value">{formatPrice(avgOrderValue)}</h3>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <input
          type="search"
          className="input"
          placeholder="🔍 Search item name..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          style={{ maxWidth: '280px' }}
        />
        <select
          className="input"
          value={categoryFilter}
          onChange={e => { setCategoryFilter(e.target.value); setPage(1); }}
          style={{ maxWidth: '200px' }}
        >
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
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
                    <tr key={`${item.product_id}-${idx}`}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{
                            width: 36, height: 36, borderRadius: 8,
                            background: item.image_url ? 'transparent' : catStyle.bg,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 18, flexShrink: 0,
                            overflow: 'hidden',
                            border: item.image_url ? '1px solid var(--border)' : 'none'
                          }}>
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
                          <span style={{ fontWeight: 600 }}>{item.product_name}</span>
                        </div>
                      </td>
                      <td>
                        <span style={{
                          padding: '3px 10px',
                          borderRadius: '20px',
                          fontSize: '11px',
                          fontWeight: 700,
                          letterSpacing: '0.05em',
                          textTransform: 'uppercase',
                          background: catStyle.bg,
                          color: catStyle.color,
                        }}>
                          {item.category}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center', fontWeight: 700, fontSize: '15px' }}>
                        {Number(item.total_quantity).toLocaleString()}
                      </td>
                      <td style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>
                        {formatPrice(item.price)}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--primary)', fontSize: '15px' }}>
                        {formatPrice(Number(item.total_revenue))}
                      </td>
                    </tr>
                  );
                })}
                {paginated.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                      No items found for the selected period.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '12px 20px', borderTop: '1px solid var(--border)',
            fontSize: '13px', color: 'var(--text-secondary)',
          }}>
            <span>{filtered.length} entries</span>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                className="btn btn-secondary btn-sm"
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
              >‹</button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <button
                  key={p}
                  className={`btn btn-sm ${p === page ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setPage(p)}
                  style={{ minWidth: 32 }}
                >
                  {p}
                </button>
              ))}
              <button
                className="btn btn-secondary btn-sm"
                disabled={page === totalPages}
                onClick={() => setPage(p => p + 1)}
              >›</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
