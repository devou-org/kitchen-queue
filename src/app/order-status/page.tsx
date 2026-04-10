'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { formatOrdinal } from '@/lib/format';
import { Order } from '@/types';
import BottomNav from '@/components/BottomNav';
import { pusherClient } from '@/lib/pusher-client';

export default function OrderStatusPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLive, setIsLive] = useState(false);

  const fetchOrders = async (silent = false) => {
    try {
      const userStr = localStorage.getItem('user');
      if (!userStr) { if (!silent) setLoading(false); return; }
      const user = JSON.parse(userStr);
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`/api/orders/history?phone=${encodeURIComponent(user.phone)}&t=${Date.now()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (data.success && data.data) setOrders(data.data);
      else if (!silent) setOrders([]);
    } catch (err) {
      console.error('Failed to fetch orders:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    if (!pusherClient) return;
    const channel = pusherClient.subscribe('queue-channel');
    setIsLive(true);
    channel.bind('order_update', () => fetchOrders(true));
    channel.bind('new_order', () => fetchOrders(true));
    channel.bind('pusher:subscription_succeeded', () => setIsLive(true));
    channel.bind('pusher:subscription_error', () => setIsLive(false));
    return () => { channel.unbind_all(); channel.unsubscribe(); };
  }, []);

  const Header = () => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', background: 'white', borderBottom: '1px solid rgba(0,0,0,0.05)', position: 'sticky', top: 0, zIndex: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <img src="/logo.jpeg" alt="Renjz Kitchen" style={{ width: '30px', height: '30px', borderRadius: '6px', objectFit: 'cover' }} />
        <span style={{ fontWeight: 800, fontSize: '16px' }}>Renjz Kitchen</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 12px', borderRadius: '99px', background: isLive ? 'rgba(6,167,125,0.1)' : 'rgba(255,165,0,0.1)' }}>
        <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: isLive ? 'var(--success)' : 'var(--warning)', display: 'inline-block', animation: isLive ? 'pulse 2s infinite' : 'none' }} />
        <span style={{ fontSize: '11px', fontWeight: 800, color: isLive ? 'var(--success)' : 'var(--warning)', letterSpacing: '0.05em' }}>
          {isLive ? 'LIVE' : 'CONNECTING'}
        </span>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '16px', background: 'linear-gradient(135deg, #FDF9FA 0%, #F8EDF0 100%)' }}>
        <div className="loader" style={{ width: 44, height: 44, borderWidth: 4 }} />
        <p style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Loading your orders...</p>
      </div>
    );
  }

  const activeOrders = orders.filter(o => ['PENDING', 'READY'].includes(o.status));

  if (activeOrders.length === 0) {
    return (
      <div style={{ background: 'linear-gradient(135deg, #FDF9FA 0%, #F8EDF0 100%)', minHeight: '100vh' }}>
        <Header />
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 24px', textAlign: 'center' }}>
          <div style={{ width: '100px', height: '100px', borderRadius: '50%', background: 'rgba(151,19,69,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '48px', marginBottom: '24px' }}>
            🍽️
          </div>
          <h2 style={{ fontWeight: 800, fontSize: '22px', marginBottom: '8px' }}>No Active Orders</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '32px', maxWidth: '260px', lineHeight: 1.6 }}>
            Your orders have been served or no orders are in progress right now.
          </p>
          <Link href="/menu" className="btn btn-primary btn-lg" style={{ width: '100%', maxWidth: '280px' }}>
            Browse Menu →
          </Link>
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div style={{ background: 'linear-gradient(135deg, #FDF9FA 0%, #F8EDF0 100%)', minHeight: '100vh', paddingBottom: '100px' }}>
      <Header />

      <div style={{ maxWidth: '480px', margin: '0 auto', padding: '20px 16px' }}>
        {/* Section heading */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
          <div>
            <h2 style={{ fontSize: '22px', fontWeight: 900, lineHeight: 1 }}>Active Orders</h2>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>Updates in real-time — no need to refresh</p>
          </div>
          <span style={{
            background: 'var(--primary)', color: 'white',
            fontSize: '13px', fontWeight: 800,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            minWidth: '28px', height: '28px', borderRadius: '50%',
          }}>
            {activeOrders.length}
          </span>
        </div>

        {activeOrders.map((order) => {
          const isReady = order.status === 'READY';
          const rawPos = Number(order.queue_position);
          const pos = isNaN(rawPos) || rawPos === 0 ? 1 : rawPos;

          return (
            <div key={order.id} style={{
              background: isReady ? 'linear-gradient(160deg, #f0fdf8 0%, #ffffff 60%)' : 'white',
              border: isReady ? '1.5px solid rgba(6,167,125,0.3)' : '1px solid rgba(0,0,0,0.07)',
              borderRadius: '18px',
              overflow: 'hidden',
              marginBottom: '10px',
              boxShadow: isReady ? '0 6px 24px rgba(6,167,125,0.1)' : '0 2px 12px rgba(0,0,0,0.05)',
            }}>

              {/* Accent stripe */}
              <div style={{
                height: '3px',
                background: isReady
                  ? 'linear-gradient(90deg, #06a77d, #34d399)'
                  : 'linear-gradient(90deg, var(--primary), #c0374f)',
              }} />

              <div style={{ padding: '12px 14px' }}>

                {/* Ticket + badge + time — all in one row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{
                      fontSize: '22px', fontWeight: 900,
                      color: isReady ? '#065f46' : 'var(--primary)',
                      letterSpacing: '-0.5px', lineHeight: 1,
                    }}>
                      #{String(order.ticket_number).padStart(3, '0')}
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 500 }}>
                      {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    {order.is_paid && (
                      <span style={{ fontSize: '9px', color: 'var(--success)', fontWeight: 800, background: 'rgba(6,167,125,0.1)', padding: '2px 6px', borderRadius: '99px' }}>✓ PAID</span>
                    )}
                    <span className={`badge badge-${order.status.toLowerCase()}`} style={{ fontSize: '10px', padding: '2px 8px' }}>{order.status}</span>
                  </div>
                </div>

                {/* Queue position — compact inline */}
                {!isReady && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '7px 10px',
                    background: 'rgba(151,19,69,0.04)',
                    borderRadius: '10px',
                    border: '1px solid rgba(151,19,69,0.08)',
                    marginBottom: '8px',
                  }}>
                    <span style={{ fontSize: '14px' }}>📍</span>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Position</span>
                    <span style={{ fontSize: '14px', fontWeight: 900, color: 'var(--primary)', marginLeft: '2px' }}>{formatOrdinal(pos)}</span>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 500 }}>in queue</span>
                  </div>
                )}

                {/* READY banner — slim single line */}
                {isReady && (
                  <div style={{
                    background: 'linear-gradient(90deg, #d1fae5, #a7f3d0)',
                    borderRadius: '10px',
                    padding: '8px 12px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                    marginBottom: '8px',
                  }}>
                    <span style={{ fontSize: '14px' }}>🎉</span>
                    <span style={{ fontSize: '13px', fontWeight: 900, color: '#065f46', letterSpacing: '0.02em' }}>READY TO GET IN!</span>
                    <span style={{ fontSize: '11px', color: '#047857', fontWeight: 500 }}>— Head to counter</span>
                  </div>
                )}

                {/* CTA */}
                <Link href={`/order-status/${order.ticket_number}`} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '12px', fontWeight: 700,
                  color: isReady ? '#065f46' : 'var(--primary)',
                  background: isReady ? 'rgba(6,167,125,0.08)' : 'rgba(151,19,69,0.04)',
                  padding: '8px',
                  borderRadius: '10px',
                  border: isReady ? '1px solid rgba(6,167,125,0.15)' : '1px solid rgba(151,19,69,0.08)',
                  textDecoration: 'none',
                }}>
                  View Full Details →
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      <BottomNav />
    </div>
  );
}