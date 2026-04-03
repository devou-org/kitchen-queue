'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { formatPrice, formatOrdinal } from '@/lib/format';
import { Order } from '@/types';
import BottomNav from '@/components/BottomNav';
import { pusherClient } from '@/lib/pusher-client';
import { usePusher } from '@/context/PusherContext';

type QueueState = {
  type: string;
  queue_number: number;
  last_served_number: number;
  timestamp: string;
};

const STAGES = [
  { key: 'PENDING', label: 'CHECK-IN', icon: '✓' },
  { key: 'PREPARING', label: 'PREPARING', icon: '🍴' },
  { key: 'READY', label: 'READY', icon: '🍽️' },
];

function getStageIndex(status: string) {
  if (status === 'PENDING') return 0;
  if (status === 'PREPARING') return 1;
  if (status === 'READY') return 2;
  return -1; // completed or cancelled
}

export default function OrderStatusPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const { isLive, channel } = usePusher();
  const [loading, setLoading] = useState(true);

  const fetchOrders = async (silent = false) => {
    try {
      const userStr = localStorage.getItem('user');
      if (!userStr) {
        if (!silent) setLoading(false);
        return;
      }

      const user = JSON.parse(userStr);
      const token = localStorage.getItem('auth_token');
      // Added cache-buster to ensure we get fresh DB rank
      const res = await fetch(`/api/orders/history?phone=${encodeURIComponent(user.phone)}&t=${Date.now()}`, {
        headers: {
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        }
      });
      const data = await res.json();

      if (data.success && data.data) {
        setOrders(data.data);
      } else if (!silent) {
        setOrders([]);
      }
    } catch (err) {
      console.error('Failed to fetch orders:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  useEffect(() => {
    if (!channel) return;

    // ✅ HANDLE STATUS UPDATES using the global channel
    channel.bind('order_update', (data: any) => {
      console.log('✅ Global connection update: order_update', data);
      fetchOrders(true);
    });

    channel.bind('new_order', () => {
      console.log('✅ Global connection update: new_order');
      fetchOrders(true);
    });

    return () => {
      channel.unbind('order_update');
      channel.unbind('new_order');
    };
  }, [channel]);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '16px', background: 'linear-gradient(135deg, #FFF7F4 0%, #FFF0E8 100%)' }}>
        <div className="loader" style={{ width: 40, height: 40, borderWidth: 4 }} />
        <p style={{ color: 'var(--text-secondary)' }}>Loading your order status...</p>
      </div>
    );
  }

  // If they have active orders, show them all in a cleaner list or focused view
  const activeOrders = orders.filter(o => ['PENDING', 'PREPARING', 'READY'].includes(o.status));
  const hasMultiple = activeOrders.length > 1;

  if (orders.length === 0) {
    return (
      <div style={{ background: 'linear-gradient(135deg, #FFF7F4 0%, #FFF0E8 100%)', minHeight: '100vh', color: 'var(--text-primary)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', background: 'white', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><span>🍴</span><span style={{ fontWeight: 800, fontSize: '15px' }}>The Culinary Conductor</span></div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: '64px', marginBottom: '16px' }}>🤷‍♂️</div>
          <h2 style={{ fontWeight: 800, fontSize: '24px' }}>No Orders Found</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '32px' }}>You haven't placed any orders yet.</p>
          <Link href="/menu" className="btn btn-primary" style={{ width: '100%', maxWidth: '300px' }}>Order Now →</Link>
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div style={{ background: 'linear-gradient(135deg, #FFF7F4 0%, #FFF0E8 100%)', minHeight: '100vh', paddingBottom: '100px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', background: 'white', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><span>🍴</span><span style={{ fontWeight: 800, fontSize: '15px' }}>The Culinary Conductor</span></div>
      </div>

      {/* Live Status Banner */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '10px', background: isLive ? 'rgba(6,167,125,0.08)' : 'rgba(255,165,0,0.08)', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
        <span className={isLive ? 'live-dot' : ''} style={{ background: isLive ? 'var(--success)' : 'var(--warning)' }} />
        <span style={{ fontSize: '12px', fontWeight: 700, color: isLive ? 'var(--success)' : 'var(--warning)' }}>
          {isLive ? '● LIVE STATUS UPDATE' : '⚡ CONNECTING...'}
        </span>
      </div>

      <div style={{ maxWidth: '480px', margin: '0 auto', padding: '20px 16px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '20px', display: 'flex', justifyContent: 'space-between' }}>
          Your Orders
          <span style={{ background: 'var(--primary)', color: 'white', fontSize: '12px', padding: '2px 8px', borderRadius: '10px' }}>{orders.length}</span>
        </h2>

        {orders.map((order, idx) => {
          const isActive = ['PENDING', 'PREPARING', 'READY'].includes(order.status);
          const isReady = order.status === 'READY';
          const rawPos = Number(order.queue_position);
          const pos = isNaN(rawPos) ? 0 : rawPos;
          const displayPos = pos || 1;

          return (
            <div key={order.id} style={{
              background: 'white', border: '1px solid rgba(0,0,0,0.05)', borderRadius: '20px', padding: '20px', marginBottom: '16px', boxShadow: '0 4px 12px rgba(0,0,0,0.03)', opacity: isActive ? 1 : 0.7, transform: idx === 0 ? 'scale(1.02)' : 'none'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                <div>
                  <h3 style={{ fontSize: '28px', fontWeight: 900, color: 'var(--primary)', lineHeight: 1 }}>#{String(order.ticket_number).padStart(3, '0')}</h3>
                  <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>{new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span className={`badge badge-${order.status.toLowerCase()}`}>{order.status}</span>
                  {order.is_paid && <div style={{ fontSize: '10px', color: 'var(--success)', fontWeight: 800, marginTop: '4px' }}>✓ PAID</div>}
                </div>
              </div>

              {isActive && !isReady && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: '#F9FAFB', padding: '12px', borderRadius: '12px', marginBottom: '12px' }}>
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-secondary)' }}>QUEUE POSITION</p>
                    <p style={{ fontSize: '32px', fontWeight: 900, color: 'var(--primary)', lineHeight: 1 }}>{displayPos}</p>
                  </div>
                  <div style={{ borderLeft: '1px solid rgba(0,0,0,0.1)', height: '40px' }} />
                  <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    {pos <= 1 ? 'You are next in line!' : `${pos - 1} orders ahead of you`}
                  </p>
                </div>
              )}

              {isReady && (
                <div style={{ background: 'rgba(6,167,125,0.1)', color: 'var(--success)', padding: '12px', borderRadius: '12px', textAlign: 'center', fontWeight: 900, marginBottom: '12px', animation: 'pulse 2s infinite' }}>
                  🍽️ READY FOR PICKUP!
                </div>
              )}

              <Link href={`/order-status/${order.ticket_number}`} style={{ display: 'block', textAlign: 'center', fontSize: '13px', fontWeight: 700, color: 'var(--primary)', background: 'rgba(255,107,53,0.05)', padding: '8px', borderRadius: '10px' }}>
                View Full Details →
              </Link>
            </div>
          );
        })}
      </div>
      <BottomNav />
    </div>
  );
}