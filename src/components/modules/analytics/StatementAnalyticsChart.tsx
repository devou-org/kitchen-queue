'use client';

import React, { useState, useEffect } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
  PieChart,
  Pie,
} from 'recharts';
import { Wallet, CreditCard, Banknote, QrCode, CheckCircle2, AlertCircle } from 'lucide-react';
import { formatPrice } from '@/lib/format';
import { Order } from '@/types';

interface StatementAnalyticsChartProps {
  orders: Order[];
  stats?: {
    totalRevenue: number;
    totalPaidRevenue: number;
    orderCount: number;
    paidCount: number;
    totalRegularSubtotal?: number;
    totalRegularGst?: number;
    totalCompositionRevenue?: number;
    totalCompositionGst?: number;
  };
  primaryColor?: string;
  dateFrom?: string;
  dateTo?: string;
  loading?: boolean;
}

export function StatementAnalyticsChart({
  orders = [],
  stats,
  primaryColor = '#971345',
  dateFrom,
  dateTo,
  loading = false,
}: StatementAnalyticsChartProps) {
  const [activeTab, setActiveTab] = useState<'timeline' | 'payment_modes' | 'statuses'>('timeline');
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

  // Group by Date or Hour for Timeline
  const isSingleDay = dateFrom && dateTo && dateFrom === dateTo;
  const timelineMap: Record<string, { label: string; fullLabel: string; total: number; paid: number; count: number }> = {};

  orders.forEach((o) => {
    const d = new Date(o.created_at);
    let key = '';
    let label = '';
    let fullLabel = '';

    if (isSingleDay) {
      // Group by hour
      const hour = d.getHours();
      key = `${hour}:00`;
      label = `${hour}:00`;
      fullLabel = `${hour}:00 - ${hour + 1}:00`;
    } else {
      // Group by date
      const dateStr = d.toISOString().split('T')[0];
      const parts = dateStr.split('-');
      key = dateStr;
      label = parts.length === 3 ? `${parts[2]}/${parts[1]}` : dateStr;
      fullLabel = dateStr;
    }

    if (!timelineMap[key]) {
      timelineMap[key] = { label, fullLabel, total: 0, paid: 0, count: 0 };
    }

    const price = Number(o.total_price || 0);
    timelineMap[key].total += price;
    timelineMap[key].count += 1;
    if (o.is_paid || o.status === 'PAID') {
      timelineMap[key].paid += price;
    }
  });

  const timelineData = Object.entries(timelineMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, val]) => ({
      ...val,
      total: Math.round(val.total),
      paid: Math.round(val.paid),
    }));

  // Payment Method Breakdown
  const paymentMap: Record<string, { name: string; revenue: number; count: number; color: string }> = {
    UPI: { name: 'UPI / QR', revenue: 0, count: 0, color: '#059669' },
    CASH: { name: 'Cash', revenue: 0, count: 0, color: '#2563EB' },
    CARD: { name: 'Card', revenue: 0, count: 0, color: '#D97706' },
    OTHER: { name: 'Pending / Other', revenue: 0, count: 0, color: '#6B7280' },
  };

  orders.forEach((o) => {
    const rawMethod = (o.payment_method || '').toUpperCase();
    const method = rawMethod === 'UPI' ? 'UPI' : rawMethod === 'CASH' ? 'CASH' : rawMethod === 'CARD' ? 'CARD' : 'OTHER';
    const amount = Number(o.total_price || 0);
    paymentMap[method].revenue += amount;
    paymentMap[method].count += 1;
  });

  const paymentData = Object.values(paymentMap)
    .filter((p) => p.count > 0 || p.revenue > 0)
    .map((p) => ({
      ...p,
      revenue: Math.round(p.revenue),
    }));

  // Status Breakdown
  const statusMap: Record<string, { name: string; count: number; revenue: number; color: string }> = {
    PAID: { name: 'Paid / Completed', count: 0, revenue: 0, color: '#059669' },
    READY: { name: 'Ready', count: 0, revenue: 0, color: '#2563EB' },
    PREPARING: { name: 'Preparing', count: 0, revenue: 0, color: '#EAB308' },
    PENDING: { name: 'Pending', count: 0, revenue: 0, color: '#F97316' },
    CANCELLED: { name: 'Cancelled', count: 0, revenue: 0, color: '#DC2626' },
  };

  orders.forEach((o) => {
    const st = (o.status || 'PENDING').toUpperCase();
    const target = statusMap[st] ? st : 'PENDING';
    statusMap[target].count += 1;
    statusMap[target].revenue += Number(o.total_price || 0);
  });

  const statusData = Object.values(statusMap)
    .filter((s) => s.count > 0)
    .map((s) => ({
      ...s,
      revenue: Math.round(s.revenue),
    }));

  const totalRev = stats?.totalRevenue ?? orders.reduce((sum, o) => sum + Number(o.total_price || 0), 0);
  const paidRev = stats?.totalPaidRevenue ?? orders.filter((o) => o.is_paid || o.status === 'PAID').reduce((sum, o) => sum + Number(o.total_price || 0), 0);
  const collectionRate = totalRev > 0 ? Math.round((paidRev / totalRev) * 100) : 0;
  const topPayment = [...paymentData].sort((a, b) => b.revenue - a.revenue)[0];

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
      }}
    >
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              backgroundColor: 'rgba(5, 150, 105, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#059669',
            }}
          >
            <Wallet size={18} />
          </div>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0, color: '#0F172A' }}>
              Statement & Collections Graph
            </h3>
            <p style={{ fontSize: '12px', color: '#64748B', margin: '2px 0 0 0' }}>
              {dateFrom && dateTo ? `${dateFrom} to ${dateTo}` : 'Real-time billing, collections, & payment modes'}
            </p>
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
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab('timeline')}
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: activeTab === 'timeline' ? 700 : 500,
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer',
              backgroundColor: activeTab === 'timeline' ? '#FFFFFF' : 'transparent',
              color: activeTab === 'timeline' ? '#0F172A' : '#64748B',
              boxShadow: activeTab === 'timeline' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s ease',
            }}
          >
            <Wallet size={13} />
            <span>Collections Timeline</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('payment_modes')}
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: activeTab === 'payment_modes' ? 700 : 500,
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer',
              backgroundColor: activeTab === 'payment_modes' ? '#FFFFFF' : 'transparent',
              color: activeTab === 'payment_modes' ? '#0F172A' : '#64748B',
              boxShadow: activeTab === 'payment_modes' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s ease',
            }}
          >
            <QrCode size={13} />
            <span>Payment Modes</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('statuses')}
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: activeTab === 'statuses' ? 700 : 500,
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer',
              backgroundColor: activeTab === 'statuses' ? '#FFFFFF' : 'transparent',
              color: activeTab === 'statuses' ? '#0F172A' : '#64748B',
              boxShadow: activeTab === 'statuses' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s ease',
            }}
          >
            <CheckCircle2 size={13} />
            <span>Order Statuses</span>
          </button>
        </div>
      </div>

      {/* Quick Metrics Ribbon */}
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
          <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 600 }}>Total Billed</span>
          <div style={{ fontSize: '15px', fontWeight: 800, color: '#0F172A' }}>
            {formatPrice(totalRev)}
          </div>
        </div>
        <div>
          <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 600 }}>Paid Collections</span>
          <div style={{ fontSize: '15px', fontWeight: 800, color: '#059669' }}>
            {formatPrice(paidRev)}
          </div>
        </div>
        <div>
          <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 600 }}>Collection Efficiency</span>
          <div style={{ fontSize: '15px', fontWeight: 800, color: collectionRate >= 90 ? '#059669' : '#D97706' }}>
            {collectionRate}% Collected
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
      </div>

      {/* Chart Canvas Area */}
      <div style={{ width: '100%', height: 260, minWidth: 0 }}>
        {loading ? (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="loader" style={{ width: 28, height: 28 }} />
          </div>
        ) : orders.length === 0 ? (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', fontSize: '13px' }}>
            No statements or orders found for the selected date range
          </div>
        ) : activeTab === 'timeline' ? (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={timelineData} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
              <XAxis
                dataKey="label"
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
                          {d.fullLabel || d.label}
                        </p>
                        <p style={{ margin: '3px 0', display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
                          <span style={{ color: '#94A3B8' }}>Total Billed:</span>
                          <strong>{formatPrice(d.total)}</strong>
                        </p>
                        <p style={{ margin: '3px 0', display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
                          <span style={{ color: '#94A3B8' }}>Paid Collected:</span>
                          <strong style={{ color: '#6EE7B7' }}>{formatPrice(d.paid)}</strong>
                        </p>
                        <p style={{ margin: '3px 0', display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
                          <span style={{ color: '#94A3B8' }}>Orders:</span>
                          <strong>{d.count} orders</strong>
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar dataKey="total" name="Total Billed" fill="#CBD5E1" radius={[4, 4, 0, 0]} maxBarSize={30} />
              <Bar dataKey="paid" name="Paid Collected" fill="#059669" radius={[4, 4, 0, 0]} maxBarSize={30} />
            </BarChart>
          </ResponsiveContainer>
        ) : activeTab === 'payment_modes' ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(240px, 1fr) minmax(200px, 1fr)', height: '100%', gap: '16px', alignItems: 'center' }}>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={paymentData} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748B', fontWeight: 600 }} tickLine={false} axisLine={{ stroke: '#E2E8F0' }} />
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
                          <p style={{ margin: '3px 0' }}>Orders: <strong>{d.count} orders</strong></p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="revenue" radius={[4, 4, 0, 0]} maxBarSize={45}>
                  {paymentData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            {/* Side summary cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '12px' }}>
              {paymentData.map((p) => {
                const pct = totalRev > 0 ? Math.round((p.revenue / totalRev) * 100) : 0;
                return (
                  <div
                    key={p.name}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '8px',
                      backgroundColor: '#F8FAFC',
                      border: '1px solid #E2E8F0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: p.color }} />
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>{p.name}</div>
                        <div style={{ fontSize: '11px', color: '#64748B' }}>{p.count} transactions</div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '13px', fontWeight: 800, color: '#0F172A' }}>{formatPrice(p.revenue)}</div>
                      <div style={{ fontSize: '11px', color: p.color, fontWeight: 700 }}>{pct}% of total</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={statusData} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F1F5F9" />
              <XAxis type="number" tick={{ fontSize: 11, fill: '#64748B' }} tickLine={false} axisLine={{ stroke: '#E2E8F0' }} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: '#334155', fontWeight: 600 }} tickLine={false} axisLine={false} width={120} />
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
                        <p style={{ fontWeight: 700, margin: '0 0 4px 0', color: '#93C5FD' }}>{d.name}</p>
                        <p style={{ margin: '3px 0' }}>Orders: <strong>{d.count} orders</strong></p>
                        <p style={{ margin: '3px 0' }}>Billed: <strong>{formatPrice(d.revenue)}</strong></p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={24}>
                {statusData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

