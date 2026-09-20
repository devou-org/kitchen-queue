'use client';

import React, { useState, useEffect } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from 'recharts';
import { TrendingUp, ShoppingBag, Award, BarChart2, CreditCard } from 'lucide-react';
import { formatPrice } from '@/lib/format';

interface DailyDataPoint {
  date: string;
  total_orders: number | string;
  revenue: number | string;
  avg_wait_time?: number | string;
  peak_hour?: number | string;
}

interface TopProductItem {
  product_name: string;
  category: string;
  total_quantity: number | string;
  total_revenue: number | string;
  price?: number;
}

export interface PaymentMethodItem {
  payment_method: string;
  order_count: number | string;
  total_revenue: number | string;
}

interface SalesAnalyticsChartProps {
  dailyData: DailyDataPoint[];
  topProducts?: TopProductItem[];
  paymentMethods?: PaymentMethodItem[];
  primaryColor?: string;
  dateFrom?: string;
  dateTo?: string;
  loading?: boolean;
}

export function SalesAnalyticsChart({
  dailyData = [],
  topProducts = [],
  paymentMethods = [],
  primaryColor = '#971345',
  dateFrom,
  dateTo,
  loading = false,
}: SalesAnalyticsChartProps) {
  const [activeMetric, setActiveMetric] = useState<'revenue' | 'orders' | 'top_items' | 'payment_methods'>('revenue');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div
        className="card"
        style={{
          height: '320px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#FFFFFF',
          borderRadius: '12px',
          border: '1px solid var(--border)',
        }}
      >
        <div className="loader" style={{ width: 32, height: 32 }} />
      </div>
    );
  }

  // Format daily trend data
  const chartData = dailyData.map((d) => {
    const rawDate = String(d.date || '').split('T')[0];
    const parts = rawDate.split('-');
    const label = parts.length === 3 ? `${parts[2]}/${parts[1]}` : rawDate;

    return {
      date: label,
      fullDate: rawDate,
      revenue: Math.round(Number(d.revenue || 0)),
      orders: Number(d.total_orders || 0),
    };
  });

  // Format top 8 products data
  const topProductsChartData = (topProducts || [])
    .slice(0, 8)
    .map((p) => ({
      name: p.product_name?.length > 16 ? `${p.product_name.slice(0, 15)}…` : p.product_name,
      fullName: p.product_name,
      category: p.category,
      revenue: Math.round(Number(p.total_revenue || 0)),
      quantity: Number(p.total_quantity || 0),
    }));

  // Format payment methods data
  const PAYMENT_COLORS: Record<string, string> = {
    UPI: '#059669',
    CASH: '#2563EB',
    CARD: '#D97706',
    OTHER: '#8B5CF6',
  };

  const paymentChartData = (paymentMethods || []).map((p) => {
    const rawName = String(p.payment_method || '').toUpperCase();
    const cleanName =
      rawName === 'UPI'
        ? 'UPI / QR'
        : rawName === 'CASH'
        ? 'Cash'
        : rawName === 'CARD'
        ? 'Card'
        : p.payment_method || 'Other';
    const colorKey = rawName.includes('UPI')
      ? 'UPI'
      : rawName.includes('CASH')
      ? 'CASH'
      : rawName.includes('CARD')
      ? 'CARD'
      : 'OTHER';
    return {
      name: cleanName,
      revenue: Math.round(Number(p.total_revenue || 0)),
      orders: Number(p.order_count || 0),
      color: PAYMENT_COLORS[colorKey] || '#64748B',
    };
  });

  const totalRev = chartData.reduce((acc, curr) => acc + curr.revenue, 0);
  const totalOrd = chartData.reduce((acc, curr) => acc + curr.orders, 0);
  const peakDay = [...chartData].sort((a, b) => b.revenue - a.revenue)[0];
  const topProduct = topProducts[0];
  const topPayment = [...paymentChartData].sort((a, b) => b.revenue - a.revenue)[0];

  return (
    <div
      className="card"
      style={{
        padding: '20px',
        borderRadius: '12px',
        border: '1px solid var(--border)',
        background: '#FFFFFF',
        marginBottom: '20px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
        overflow: 'hidden',
      }}
    >
      <style>{`
        .payment-methods-layout {
          display: grid;
          grid-template-columns: 1fr;
          gap: 16px;
          width: 100%;
          min-width: 0;
        }
        @media (min-width: 768px) {
          .payment-methods-layout {
            grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
            align-items: center;
          }
        }
        .analytics-metric-switcher {
          display: flex;
          align-items: center;
          gap: 6px;
          background-color: #F1F5F9;
          padding: 3px;
          border-radius: 8px;
          overflow-x: auto;
          max-width: 100%;
          scrollbar-width: none;
          -ms-overflow-style: none;
          -webkit-overflow-scrolling: touch;
        }
        .analytics-metric-switcher::-webkit-scrollbar {
          display: none;
        }
      `}</style>

      {/* Header & Controls */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          marginBottom: '18px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: primaryColor,
              }}
            >
              <TrendingUp size={22} strokeWidth={2.5} />
            </div>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0, color: '#0F172A' }}>
                Sales & Performance Graph
              </h3>
              <p style={{ fontSize: '12px', color: '#64748B', margin: '2px 0 0 0' }}>
                {dateFrom && dateTo ? `${dateFrom} to ${dateTo}` : 'Daily sales volume & revenue analysis'}
              </p>
            </div>
          </div>
        </div>

        {/* View Switcher Buttons */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: '#F1F5F9',
            padding: '3px',
            borderRadius: '8px',
            flexWrap: 'wrap',
          }}
        >
        <div className="analytics-metric-switcher">
          <button
            type="button"
            onClick={() => setActiveMetric('revenue')}
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: activeMetric === 'revenue' ? 700 : 500,
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer',
              backgroundColor: activeMetric === 'revenue' ? '#FFFFFF' : 'transparent',
              color: activeMetric === 'revenue' ? '#0F172A' : '#64748B',
              boxShadow: activeMetric === 'revenue' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              whiteSpace: 'nowrap',
              flexShrink: 0,
              transition: 'all 0.15s ease',
            }}
          >
            <TrendingUp size={13} />
            <span>Revenue (₹)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveMetric('orders')}
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: activeMetric === 'orders' ? 700 : 500,
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer',
              backgroundColor: activeMetric === 'orders' ? '#FFFFFF' : 'transparent',
              color: activeMetric === 'orders' ? '#0F172A' : '#64748B',
              boxShadow: activeMetric === 'orders' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              whiteSpace: 'nowrap',
              flexShrink: 0,
              transition: 'all 0.15s ease',
            }}
          >
            <ShoppingBag size={13} />
            <span>Orders Count</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveMetric('top_items')}
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: activeMetric === 'top_items' ? 700 : 500,
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer',
              backgroundColor: activeMetric === 'top_items' ? '#FFFFFF' : 'transparent',
              color: activeMetric === 'top_items' ? '#0F172A' : '#64748B',
              boxShadow: activeMetric === 'top_items' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              whiteSpace: 'nowrap',
              flexShrink: 0,
              transition: 'all 0.15s ease',
            }}
          >
            <BarChart2 size={13} />
            <span>Top Dishes</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveMetric('payment_methods')}
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: activeMetric === 'payment_methods' ? 700 : 500,
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer',
              backgroundColor: activeMetric === 'payment_methods' ? '#FFFFFF' : 'transparent',
              color: activeMetric === 'payment_methods' ? '#0F172A' : '#64748B',
              boxShadow: activeMetric === 'payment_methods' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              whiteSpace: 'nowrap',
              flexShrink: 0,
              transition: 'all 0.15s ease',
            }}
          >
            <CreditCard size={13} />
            <span>Payment Methods</span>
          </button>
        </div>
      </div>
      </div>

      {/* Metric Quick Stats Ribbon */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '12px',
          marginBottom: '16px',
          padding: '10px 14px',
          backgroundColor: '#F8FAFC',
          borderRadius: '8px',
          border: '1px solid #E2E8F0',
        }}
      >
        <div>
          <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 600 }}>Period Revenue</span>
          <div style={{ fontSize: '15px', fontWeight: 800, color: primaryColor }}>
            {formatPrice(totalRev)}
          </div>
        </div>
        <div>
          <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 600 }}>Total Completed Orders</span>
          <div style={{ fontSize: '15px', fontWeight: 800, color: '#0F172A' }}>
            {totalOrd.toLocaleString()} orders
          </div>
        </div>
        {topPayment && (
          <div>
            <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 600 }}>Top Payment Channel</span>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>
              {topPayment.name} ({formatPrice(topPayment.revenue)})
            </div>
          </div>
        )}
        {topProduct && (
          <div>
            <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 600 }}>Best Selling Dish</span>
            <div
              style={{
                fontSize: '14px',
                fontWeight: 700,
                color: '#0F172A',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
              title={topProduct.product_name}
            >
              {topProduct.product_name} ({topProduct.total_quantity} sold)
            </div>
          </div>
        )}
      </div>

      {/* Chart Canvas Area */}
      <div style={{ width: '100%', minHeight: 260, height: activeMetric === 'payment_methods' ? 'auto' : 260, minWidth: 0 }}>
        {loading ? (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="loader" style={{ width: 28, height: 28 }} />
          </div>
        ) : activeMetric === 'revenue' ? (
          chartData.length === 0 ? (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', fontSize: '13px' }}>
              No sales revenue recorded for this period
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={chartData} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="salesRevGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={primaryColor} stopOpacity={0.4} />
                    <stop offset="95%" stopColor={primaryColor} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: '#64748B', fontWeight: 600 }}
                  tickLine={false}
                  axisLine={{ stroke: '#E2E8F0' }}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#64748B' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val) => `₹${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const d = payload[0].payload;
                      return (
                        <div
                          style={{
                            background: '#0F172A',
                            padding: '10px 14px',
                            borderRadius: '8px',
                            color: '#FFFFFF',
                            fontSize: '12px',
                            boxShadow: '0 4px 14px rgba(0,0,0,0.2)',
                          }}
                        >
                          <p style={{ fontWeight: 700, margin: '0 0 6px 0', color: '#93C5FD' }}>
                            {d.fullDate || d.date}
                          </p>
                          <p style={{ margin: '3px 0', display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
                            <span style={{ color: '#94A3B8' }}>Revenue:</span>
                            <strong>{formatPrice(d.revenue)}</strong>
                          </p>
                          <p style={{ margin: '3px 0', display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
                            <span style={{ color: '#94A3B8' }}>Orders:</span>
                            <strong>{d.orders} orders</strong>
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke={primaryColor}
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#salesRevGrad)"
                  dot={{ r: 3, fill: primaryColor, strokeWidth: 1, stroke: '#FFFFFF' }}
                  activeDot={{ r: 6, stroke: '#FFFFFF', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )
        ) : activeMetric === 'orders' ? (
          chartData.length === 0 ? (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', fontSize: '13px' }}>
              No orders recorded for this period
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={chartData} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: '#64748B', fontWeight: 600 }}
                  tickLine={false}
                  axisLine={{ stroke: '#E2E8F0' }}
                />
                <YAxis tick={{ fontSize: 11, fill: '#64748B' }} tickLine={false} axisLine={false} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const d = payload[0].payload;
                      return (
                        <div
                          style={{
                            background: '#0F172A',
                            padding: '10px 14px',
                            borderRadius: '8px',
                            color: '#FFFFFF',
                            fontSize: '12px',
                            boxShadow: '0 4px 14px rgba(0,0,0,0.2)',
                          }}
                        >
                          <p style={{ fontWeight: 700, margin: '0 0 6px 0', color: '#93C5FD' }}>
                            {d.fullDate || d.date}
                          </p>
                          <p style={{ margin: '3px 0', display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
                            <span style={{ color: '#94A3B8' }}>Total Orders:</span>
                            <strong style={{ color: '#6EE7B7' }}>{d.orders}</strong>
                          </p>
                          <p style={{ margin: '3px 0', display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
                            <span style={{ color: '#94A3B8' }}>Revenue:</span>
                            <strong>{formatPrice(d.revenue)}</strong>
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="orders" fill="#059669" radius={[4, 4, 0, 0]} maxBarSize={42} />
              </BarChart>
            </ResponsiveContainer>
          )
        ) : activeMetric === 'top_items' ? (
          topProductsChartData.length === 0 ? (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', fontSize: '13px' }}>
              No product sales data recorded for this period
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart
                data={topProductsChartData}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F1F5F9" />
                <XAxis
                  type="number"
                  tick={{ fontSize: 11, fill: '#64748B' }}
                  tickLine={false}
                  axisLine={{ stroke: '#E2E8F0' }}
                  tickFormatter={(val) => `₹${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`}
                />
                <YAxis
                  dataKey="name"
                  type="category"
                  tick={{ fontSize: 11, fill: '#334155', fontWeight: 600 }}
                  tickLine={false}
                  axisLine={false}
                  width={110}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const d = payload[0].payload;
                      return (
                        <div
                          style={{
                            background: '#0F172A',
                            padding: '10px 14px',
                            borderRadius: '8px',
                            color: '#FFFFFF',
                            fontSize: '12px',
                            boxShadow: '0 4px 14px rgba(0,0,0,0.2)',
                          }}
                        >
                          <p style={{ fontWeight: 700, margin: '0 0 4px 0', color: '#FCD34D' }}>
                            {d.fullName}
                          </p>
                          <p style={{ fontSize: '11px', color: '#94A3B8', margin: '0 0 6px 0' }}>
                            Category: {d.category}
                          </p>
                          <p style={{ margin: '3px 0', display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
                            <span style={{ color: '#94A3B8' }}>Revenue:</span>
                            <strong style={{ color: '#38BDF8' }}>{formatPrice(d.revenue)}</strong>
                          </p>
                          <p style={{ margin: '3px 0', display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
                            <span style={{ color: '#94A3B8' }}>Units Sold:</span>
                            <strong>{d.quantity} units</strong>
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="revenue" radius={[0, 4, 4, 0]} maxBarSize={22}>
                  {topProductsChartData.map((entry, index) => {
                    const colors = ['#971345', '#059669', '#2563EB', '#D97706', '#7C3AED', '#EC4899', '#0891B2', '#4B5563'];
                    return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )
        ) : (
          /* Payment Methods Performance Graph */
          paymentChartData.length === 0 ? (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', fontSize: '13px' }}>
              No payment transactions recorded for this period
            </div>
          ) : (
            <div className="payment-methods-layout">
              <div style={{ width: '100%', height: 230, minWidth: 0 }}>
                <ResponsiveContainer width="100%" height={230}>
                  <BarChart data={paymentChartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748B', fontWeight: 600 }} tickLine={false} axisLine={{ stroke: '#E2E8F0' }} />
                    <YAxis
                      tick={{ fontSize: 10, fill: '#64748B' }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(val) => `₹${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const d = payload[0].payload;
                          const pct = totalRev > 0 ? Math.round((d.revenue / totalRev) * 100) : 0;
                          return (
                            <div
                              style={{
                                background: '#0F172A',
                                padding: '10px 14px',
                                borderRadius: '8px',
                                color: '#FFFFFF',
                                fontSize: '12px',
                                boxShadow: '0 4px 14px rgba(0,0,0,0.2)',
                              }}
                            >
                              <p style={{ fontWeight: 700, margin: '0 0 6px 0', color: '#FCD34D' }}>{d.name}</p>
                              <p style={{ margin: '3px 0' }}>Revenue: <strong>{formatPrice(d.revenue)}</strong> ({pct}%)</p>
                              <p style={{ margin: '3px 0' }}>Orders: <strong>{d.orders} orders</strong></p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar dataKey="revenue" radius={[4, 4, 0, 0]} maxBarSize={45}>
                      {paymentChartData.map((entry, index) => (
                        <Cell key={`cell-pay-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Side / Stacked summary cards */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', minWidth: 0 }}>
                {paymentChartData.map((p) => {
                  const pct = totalRev > 0 ? Math.round((p.revenue / totalRev) * 100) : 0;
                  return (
                    <div
                      key={p.name}
                      style={{
                        padding: '10px 14px',
                        borderRadius: '8px',
                        backgroundColor: '#F8FAFC',
                        border: '1px solid #E2E8F0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '8px',
                        minWidth: 0,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                        <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: p.color, flexShrink: 0 }} />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                          <div style={{ fontSize: '11px', color: '#64748B' }}>{p.orders} transactions</div>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: '13px', fontWeight: 800, color: '#0F172A' }}>{formatPrice(p.revenue)}</div>
                        <div style={{ fontSize: '11px', color: p.color, fontWeight: 700 }}>{pct}% of sales</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );

}
