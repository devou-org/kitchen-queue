'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { formatPrice, getTimeAgo } from '@/lib/format';
import { DashboardStats, Order } from '@/types';

function StatCard({ title, value, icon }: { title: string, value: string | number, icon: string }) {
  return (
    <div className="stat-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <p className="stat-label">{title}</p>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '4px' }}>
            <h3 className="stat-value">{value}</h3>
          </div>
        </div>
        <div className="stat-icon" style={{ background: 'var(--bg)', fontSize: '20px' }}>
          {icon}
        </div>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, ordersRes] = await Promise.all([
          fetch('/api/analytics?type=dashboard'),
          fetch('/api/orders?per_page=5')
        ]);
        const statsData = await statsRes.json();
        const ordersData = await ordersRes.json();

        if (statsData.success) setStats(statsData.data);
        if (ordersData.success) setRecentOrders(ordersData.data);
      } catch (error) {
        console.error('Fetch error:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) return <div style={{ padding: '40px', display: 'flex', justifyContent: 'center' }}><div className="loader" style={{ width: 40, height: 40, borderWidth: 4 }} /></div>;

  return (
    <div className="page-content-admin animate-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 800 }}>Dashboard</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Welcome back. Here's what's happening today.</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <Link href="/admin/orders" className="btn btn-primary">Manage Orders →</Link>
        </div>
      </div>

      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginBottom: '32px' }}>
          <StatCard title="Revenue Today" value={formatPrice(stats.revenue_today)} icon="💰" />
          <StatCard title="Orders Today" value={stats.orders_today} icon="🧾" />
          <StatCard title="Avg. Order Value" value={formatPrice(stats.avg_order_value)} icon="📈" />
          <StatCard title="Pending Orders" value={stats.pending_orders} icon="⏳" />
          <StatCard title="Low Stock Items" value={stats.low_stock_items} icon="⚠️" />
        </div>
      )}

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 700 }}>Recent Orders</h2>
          <Link href="/admin/orders" style={{ fontSize: '14px', color: 'var(--primary)', fontWeight: 600 }}>View All →</Link>
        </div>
        <div className="table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
          <table>
            <thead>
              <tr>
                <th>Ticket</th>
                <th>Customer</th>
                <th>Items & Total</th>
                <th>Status</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {recentOrders.map(order => (
                <tr key={order.id}>
                  <td><strong style={{ color: 'var(--primary)' }}>#{String(order.ticket_number).padStart(3, '0')}</strong></td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{order.customer_name}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{order.phone}</div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{formatPrice(order.total_price)}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{order.items?.length || 0} items</div>
                  </td>
                  <td>
                    <span style={{
                      padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 600,
                      background: order.status === 'READY' ? '#D1FAE5' :
                        order.status === 'PENDING' ? '#FFEDD5' :
                          order.status === 'PREPARING' ? '#DBEAFE' : '#F3F4F6',
                      color: order.status === 'READY' ? '#065F46' :
                        order.status === 'PENDING' ? '#9A3412' :
                          order.status === 'PREPARING' ? '#1E40AF' : '#374151'
                    }}>
                      {order.status}
                    </span>
                  </td>
                  <td style={{ color: 'var(--text-secondary)' }}>{getTimeAgo(order.created_at)}</td>
                </tr>
              ))}
              {recentOrders.length === 0 && (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>No orders today yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
