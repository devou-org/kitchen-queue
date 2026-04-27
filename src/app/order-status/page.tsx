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
        <img src="https://ik.imagekit.io/j2q8x5lu0/Renjzkitchen/renjz.jpg" alt="Renjz Kitchen" style={{ width: '30px', height: '30px', borderRadius: '6px', objectFit: 'cover' }} />
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

  const activeOrders = orders.filter(o => {
    if (!['PENDING', 'PREPARING', 'READY'].includes(o.status)) return false;
    
    // Check if order is from today (using Asia/Kolkata timezone to match standard)
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
    const orderDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(o.created_at));
    
    return orderDate === today;
  });

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
            <Link key={order.id} href={`/order-status/${order.ticket_number}`} style={{
              display: 'flex',
              background: 'white',
              border: isReady ? '1px solid rgba(6,167,125,0.2)' : '1px solid rgba(0,0,0,0.05)',
              borderRadius: '12px',
              overflow: 'hidden',
              marginBottom: '12px',
              boxShadow: '0 2px 10px rgba(0,0,0,0.02)',
              textDecoration: 'none',
              color: 'inherit',
              minHeight: '80px'
            }}>
              {/* Left: TICKET */}
              <div style={{
                background: '#faf9f8',
                padding: '16px 24px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                borderRight: '1px solid rgba(0,0,0,0.03)'
              }}>
                <span style={{ fontSize: '9px', fontWeight: 800, letterSpacing: '0.15em', color: '#9ca3af', marginBottom: '6px' }}>TICKET</span>
                <span style={{ fontSize: '26px', fontWeight: 900, color: 'var(--primary)', lineHeight: 1, marginBottom: order.is_paid ? '6px' : '0' }}>#{String(order.ticket_number).padStart(3, '0')}</span>
                {order.is_paid && (
                  <span style={{ fontSize: '9px', color: 'var(--success)', fontWeight: 800, background: 'rgba(6,167,125,0.1)', padding: '2px 6px', borderRadius: '4px', marginTop: '2px' }}>✓ PAID</span>
                )}
              </div>

              {/* Middle: STATUS */}
              <div style={{
                flex: 1,
                padding: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'white'
              }}>
                <div style={{ 
                  display: 'flex', alignItems: 'center', gap: '8px', 
                  background: isReady ? 'var(--success)' : (order.status === 'PENDING' ? '#f59e0b' : 'var(--primary)'), 
                  color: 'white', 
                  padding: '8px 16px', 
                  borderRadius: '99px',
                  fontSize: '12px',
                  fontWeight: 900,
                  letterSpacing: '0.05em'
                }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'white', opacity: 0.9 }} />
                  {order.status}
                </div>
              </div>

              {/* Right: POSITION */}
              <div style={{
                background: '#faf9f8',
                padding: '16px 24px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                borderLeft: '1px solid rgba(0,0,0,0.03)',
                minWidth: '90px'
              }}>
                <span style={{ fontSize: '9px', fontWeight: 800, letterSpacing: '0.15em', color: '#9ca3af', marginBottom: '6px' }}>
                  {isReady ? 'STATUS' : 'POSITION'}
                </span>
                <span style={{ fontSize: '18px', fontWeight: 700, color: isReady ? 'var(--success)' : 'var(--primary)', lineHeight: 1 }}>
                  {isReady ? 'GO!' : formatOrdinal(pos)}
                </span>
              </div>
            </Link>
          );
        })}
      </div>

      <BottomNav />
    </div>
  );
}