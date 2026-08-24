'use client';

import React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  AreaChart,
  Area,
  Cell
} from 'recharts';
import { Clock, TrendingUp, ShoppingBag, Scale, Layers, DollarSign } from 'lucide-react';

interface SalesTrendChartProps {
  toolCalls?: any[];
  primaryColor?: string;
}

export function SalesTrendChart({ toolCalls, primaryColor = '#059669' }: SalesTrendChartProps) {
  if (!toolCalls || toolCalls.length === 0) return null;

  // 1. Peak Rush Hours Chart (getHourlySales)
  const hourlyCall = toolCalls.find(t => t.name === 'getHourlySales');
  if (hourlyCall) {
    const rawHours = hourlyCall.result?.hourly_breakdown || hourlyCall.result?.hourly_sales || hourlyCall.result?.hours || [];
    const data = rawHours.map((h: any) => ({
      hour: h.hour_label ? h.hour_label.split(' - ')[0] : `${h.hour_24h ?? h.hour ?? 0}:00`,
      fullLabel: h.hour_label || `${h.hour_24h ?? 0}:00`,
      revenue: Number(h.revenue || h.total_revenue || 0),
      orders: Number(h.order_count || h.orders || 0)
    }));

    if (data.length > 0) {
      return (
        <div style={{
          marginTop: '12px',
          padding: '14px',
          borderRadius: '16px',
          background: '#FFFFFF',
          border: '1px solid #E2E8F0',
          boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
          minWidth: 0
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '12px', fontWeight: 800, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Clock size={16} color="#3B82F6" />
              <span style={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}>Peak Rush Hours & Demand</span>
            </span>
            <span style={{ fontSize: '10px', color: '#64748B', fontWeight: 600 }}>By Hourly Sales</span>
          </div>
          <div style={{ width: '100%', height: 170, minWidth: 0 }}>
            <ResponsiveContainer width="100%" height={170} minWidth={0} minHeight={0}>
              <AreaChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="hourlyGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                <XAxis dataKey="hour" tick={{ fontSize: 10, fill: '#64748B', fontWeight: 600 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#64748B' }} tickLine={false} axisLine={false} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const item = payload[0].payload;
                      return (
                        <div style={{ background: '#0F172A', padding: '8px 12px', borderRadius: '8px', color: '#FFF', fontSize: '11px', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
                          <p style={{ fontWeight: 700, margin: '0 0 4px 0', color: '#60A5FA' }}>Time: {item.fullLabel}</p>
                          <p style={{ margin: '2px 0' }}>Orders: <strong>{item.orders} orders</strong></p>
                          <p style={{ margin: '2px 0' }}>Revenue: <strong>₹{item.revenue.toLocaleString('en-IN')}</strong></p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area type="monotone" dataKey="revenue" stroke="#3B82F6" strokeWidth={2.5} fillOpacity={1} fill="url(#hourlyGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      );
    }
  }

  // 2. Sales Trend (Sales vs Days) Chart (getSalesTrend)
  const salesTrendCall = toolCalls.find(t => t.name === 'getSalesTrend');
  if (salesTrendCall) {
    const rawTrend = salesTrendCall.result?.data_points || salesTrendCall.result?.sales_trend || salesTrendCall.result?.trend || [];
    const data = rawTrend.map((item: any) => ({
      date: item.business_date ? String(item.business_date).split('T')[0].slice(5) : 'Date',
      fullDate: item.business_date ? String(item.business_date).split('T')[0] : '',
      revenue: Number(item.total_revenue || 0),
      orders: Number(item.total_orders || 0)
    }));

    if (data.length > 0) {
      return (
        <div style={{
          marginTop: '12px',
          padding: '14px',
          borderRadius: '16px',
          background: '#FFFFFF',
          border: '1px solid #E2E8F0',
          boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
          minWidth: 0
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '12px', fontWeight: 800, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <TrendingUp size={16} color={primaryColor} />
              <span style={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}>Daily Sales Trend (₹)</span>
            </span>
            <span style={{ fontSize: '10px', color: '#64748B', fontWeight: 600 }}>{data.length} Days</span>
          </div>
          <div style={{ width: '100%', height: 170, minWidth: 0 }}>
            <ResponsiveContainer width="100%" height={170} minWidth={0} minHeight={0}>
              <AreaChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="salesTrendGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={primaryColor} stopOpacity={0.4}/>
                    <stop offset="95%" stopColor={primaryColor} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748B', fontWeight: 600 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#64748B' }} tickLine={false} axisLine={false} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const item = payload[0].payload;
                      return (
                        <div style={{ background: '#0F172A', padding: '8px 12px', borderRadius: '8px', color: '#FFF', fontSize: '11px', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
                          <p style={{ fontWeight: 700, margin: '0 0 4px 0', color: '#38BDF8' }}>{item.fullDate || item.date}</p>
                          <p style={{ margin: '2px 0' }}>Revenue: <strong>₹{item.revenue.toLocaleString('en-IN')}</strong></p>
                          <p style={{ margin: '2px 0' }}>Orders: <strong>{item.orders}</strong></p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area type="monotone" dataKey="revenue" stroke={primaryColor} strokeWidth={2.5} fillOpacity={1} fill="url(#salesTrendGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      );
    }
  }

  // 3. Top Products Chart (getTopProducts)
  const topProductsCall = toolCalls.find(t => t.name === 'getTopProducts');
  if (topProductsCall) {
    const rawList = topProductsCall.result?.top_products || topProductsCall.result?.products || topProductsCall.result?.items || [];
    const data = rawList.slice(0, 5).map((p: any) => ({
      name: p.product_name || p.name || 'Item',
      quantity: Number(p.total_quantity_sold || p.quantity || p.total_quantity || 0),
      revenue: Number(p.total_revenue || p.revenue || 0)
    }));

    if (data.length > 0) {
      return (
        <div style={{
          marginTop: '12px',
          padding: '14px',
          borderRadius: '16px',
          background: '#FFFFFF',
          border: '1px solid #E2E8F0',
          boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
          minWidth: 0
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '12px', fontWeight: 800, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ShoppingBag size={16} color={primaryColor} />
              <span style={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}>Top Selling Products</span>
            </span>
            <span style={{ fontSize: '10px', color: '#64748B', fontWeight: 600 }}>By Quantity Sold</span>
          </div>
          <div style={{ width: '100%', height: 170, minWidth: 0 }}>
            <ResponsiveContainer width="100%" height={170} minWidth={0} minHeight={0}>
              <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 25 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                <XAxis 
                  dataKey="name" 
                  tick={{ fontSize: 10, fill: '#475569', fontWeight: 600 }} 
                  tickLine={false} 
                  axisLine={false}
                  interval={0}
                  angle={-15}
                  textAnchor="end"
                />
                <YAxis tick={{ fontSize: 10, fill: '#64748B' }} tickLine={false} axisLine={false} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const item = payload[0].payload;
                      return (
                        <div style={{ background: '#0F172A', padding: '8px 12px', borderRadius: '8px', color: '#FFF', fontSize: '11px', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
                          <p style={{ fontWeight: 700, margin: '0 0 4px 0', color: '#38BDF8' }}>{item.name}</p>
                          <p style={{ margin: '2px 0' }}>Qty Sold: <strong>{item.quantity} portions</strong></p>
                          <p style={{ margin: '2px 0' }}>Revenue: <strong>₹{item.revenue.toLocaleString('en-IN')}</strong></p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="quantity" radius={[8, 8, 0, 0]}>
                  {data.map((_: any, index: number) => {
                    const colors = [primaryColor, '#10B981', '#3B82F6', '#8B5CF6', '#F59E0B'];
                    return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      );
    }
  }

  // 4. Period Comparison Chart (comparePeriods)
  const compareCall = toolCalls.find(t => t.name === 'comparePeriods');
  if (compareCall && compareCall.result?.period_1 && compareCall.result?.period_2) {
    const p1 = compareCall.result.period_1;
    const p2 = compareCall.result.period_2;
    const data = [
      { name: `${p1.date_from} to ${p1.date_to}`, revenue: Number(p1.revenue || 0), orders: Number(p1.orders || 0) },
      { name: `${p2.date_from} to ${p2.date_to}`, revenue: Number(p2.revenue || 0), orders: Number(p2.orders || 0) }
    ];

    return (
      <div style={{
        marginTop: '12px',
        padding: '14px',
        borderRadius: '16px',
        background: '#FFFFFF',
        border: '1px solid #E2E8F0',
        boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
        minWidth: 0
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <span style={{ fontSize: '12px', fontWeight: 800, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Scale size={16} color="#8B5CF6" />
            <span style={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}>Period Comparison</span>
          </span>
        </div>
        <div style={{ width: '100%', height: 160, minWidth: 0 }}>
          <ResponsiveContainer width="100%" height={160} minWidth={0} minHeight={0}>
            <BarChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748B' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#64748B' }} tickLine={false} axisLine={false} />
              <Tooltip
                formatter={(value: any) => [`₹${Number(value).toLocaleString('en-IN')}`, 'Revenue']}
                contentStyle={{ background: '#0F172A', borderRadius: '8px', border: 'none', color: '#FFF', fontSize: '11px' }}
              />
              <Bar dataKey="revenue" fill={primaryColor} radius={[8, 8, 0, 0]}>
                <Cell fill={primaryColor} />
                <Cell fill="#3B82F6" />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  }

  // 5. Category Performance Chart (getCategoryPerformance)
  const categoryCall = toolCalls.find(t => t.name === 'getCategoryPerformance');
  if (categoryCall && categoryCall.result?.categories) {
    const rawCat = categoryCall.result.categories || [];
    const data = rawCat.slice(0, 5).map((c: any) => ({
      name: c.category || 'Category',
      revenue: Number(c.category_revenue || 0),
      itemsSold: Number(c.total_items_sold || 0)
    }));

    if (data.length > 0) {
      return (
        <div style={{
          marginTop: '12px',
          padding: '14px',
          borderRadius: '16px',
          background: '#FFFFFF',
          border: '1px solid #E2E8F0',
          boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
          minWidth: 0
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '12px', fontWeight: 800, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Layers size={16} color={primaryColor} />
              <span style={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}>Category Sales Breakdown</span>
            </span>
          </div>
          <div style={{ width: '100%', height: 160, minWidth: 0 }}>
            <ResponsiveContainer width="100%" height={160} minWidth={0} minHeight={0}>
              <BarChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748B' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#64748B' }} tickLine={false} axisLine={false} />
                <Tooltip
                  formatter={(val: any) => [`₹${Number(val).toLocaleString('en-IN')}`, 'Revenue']}
                  contentStyle={{ background: '#0F172A', borderRadius: '8px', border: 'none', color: '#FFF', fontSize: '11px' }}
                />
                <Bar dataKey="revenue" fill={primaryColor} radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      );
    }
  }

  // 6. Sales Summary Chart
  const salesSummaryCalls = toolCalls.filter(t => t.name === 'getSalesSummary' && (t.result?.paid_revenue !== undefined || t.result?.summary));
  if (salesSummaryCalls.length >= 1) {
    const chartData = salesSummaryCalls.map((call, idx) => {
      const res = call.result;
      const s = res.summary || res;
      const dateLabel = call.args?.date_from || (idx === 0 ? 'Current' : `Period ${idx + 1}`);
      return {
        date: dateLabel,
        revenue: Number(s.paid_revenue || s.total_revenue || s.gross_revenue || 0),
        orders: Number(s.paid_orders || s.total_orders || 0)
      };
    });

    return (
      <div style={{
        marginTop: '12px',
        padding: '14px',
        borderRadius: '16px',
        background: '#FFFFFF',
        border: '1px solid #E2E8F0',
        boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
        minWidth: 0
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <span style={{ fontSize: '12px', fontWeight: 800, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <DollarSign size={16} color={primaryColor} />
            <span style={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}>Revenue & Order Summary</span>
          </span>
        </div>
        <div style={{ width: '100%', height: 160, minWidth: 0 }}>
          <ResponsiveContainer width="100%" height={160} minWidth={0} minHeight={0}>
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748B' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#64748B' }} tickLine={false} axisLine={false} />
              <Tooltip
                formatter={(value: any) => [`₹${Number(value).toLocaleString('en-IN')}`, 'Revenue']}
                contentStyle={{ background: '#0F172A', borderRadius: '8px', border: 'none', color: '#FFF', fontSize: '11px' }}
              />
              <Bar dataKey="revenue" fill={primaryColor} radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  }

  return null;
}
