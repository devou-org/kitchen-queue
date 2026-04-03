'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { formatPrice, formatDateTime } from '@/lib/format';
import { Order } from '@/types';
import { STATUS_BG } from '@/lib/constants';
import BottomNav from '@/components/BottomNav';

export default function HistoryPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const user = localStorage.getItem('user');
    if (!user) { setLoading(false); return; }
    const { phone } = JSON.parse(user);

    const fetchHistory = async () => {
      try {
        const res = await fetch(`/api/orders/history?phone=${encodeURIComponent(phone)}`);
        const data = await res.json();
        if (data.success) setOrders(data.data);
      } catch {}
      finally { setLoading(false); }
    };
    fetchHistory();
  }, []);

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <div className="page-header">
        <Link href="/menu" className="btn btn-ghost btn-sm" style={{ minWidth: 'auto' }}>← Menu</Link>
        <h1 style={{ fontWeight: 800, fontSize: '18px' }}>Order History</h1>
        <div />
      </div>

      <div style={{ maxWidth: '480px', margin: '0 auto', padding: '16px', paddingBottom: '80px' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
            <div className="loader" style={{ width: 36, height: 36, borderWidth: 3 }} />
          </div>
        ) : orders.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <div style={{ fontSize: '64px', marginBottom: '16px' }}>📋</div>
            <h2 style={{ fontWeight: 700, marginBottom: '8px' }}>No orders yet</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>Place your first order from our menu!</p>
            <Link href="/menu" className="btn btn-primary">Browse Menu</Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {orders.map(order => (
              <Link key={order.id} href={`/order-status/${order.ticket_number}`} style={{ textDecoration: 'none' }}>
                <div className="card" style={{ cursor: 'pointer' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                    <div>
                      <p style={{ fontWeight: 800, fontSize: '16px' }}>Ticket #{String(order.ticket_number).padStart(3, '0')}</p>
                      <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{formatDateTime(order.created_at)}</p>
                    </div>
                    <span className={`badge ${STATUS_BG[order.status]}`}>{order.status}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                      {order.items?.length || 0} item{(order.items?.length || 0) !== 1 ? 's' : ''}
                    </p>
                    <p style={{ fontWeight: 700, color: 'var(--primary)' }}>{formatPrice(order.total_price)}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
