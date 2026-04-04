'use client';
import { useState, useEffect, useRef, use } from 'react';
import Link from 'next/link';
import { formatPrice, formatOrdinal } from '@/lib/format';
import { Order } from '@/types';
import BottomNav from '@/components/BottomNav';
import { pusherClient } from '@/lib/pusher-client';

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

export default function OrderStatusTicketPage({ params }: { params: Promise<{ ticket: string }> }) {
  const { ticket } = use(params);
  const [order, setOrder] = useState<Order | null>(null);
  const [queueState, setQueueState] = useState<QueueState | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLive, setIsLive] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchOrder = async (silent = false) => {
      try {
        // Cache-buster added
        const res = await fetch(`/api/orders/ticket/${ticket}?t=${Date.now()}`);
        const data = await res.json();

        if (data.success && data.data) {
          setOrder(data.data);
        } else if (!silent) {
          setError(data.error || 'Order not found');
          setOrder(null);
        }
      } catch (err) {
        console.error('Failed to fetch order:', err);
        if (!silent) setError('Failed to load order');
      } finally {
        if (!silent) setLoading(false);
      }
    };

    fetchOrder();

    if (!pusherClient) return;

    const channel = pusherClient.subscribe('queue-channel');

    // ✅ CONNECTION STATUS
    channel.bind('pusher:subscription_succeeded', () => {
      setIsLive(true);
    });

    channel.bind('pusher:subscription_error', () => {
      setIsLive(false);
    });

    // ✅ RE-FETCH ON ANY EVENT THAT AFFECTS QUEUE
    channel.bind('order_update', (data: any) => {
      console.log('✅ Ticket Page received order_update:', data);
      // We re-fetch for ANY update to ensure position is correct
      // (Someone leaving queue, or our own order getting ready)
      fetchOrder(true);
    });

    channel.bind('new_order', () => {
      fetchOrder(true);
    });

    return () => {
      channel.unbind_all();
      channel.unsubscribe();
    };
  }, [ticket]);

  const renderHeader = () => (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '16px 20px',
      background: 'white',
      borderBottom: '1px solid rgba(0,0,0,0.05)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '18px' }}>🍴</span>
        <span style={{ fontWeight: 800, fontSize: '15px', color: 'var(--text-primary)' }}>The Culinary Conductor</span>
      </div>
      <div style={{
        width: '36px', height: '36px', borderRadius: '50%',
        background: 'rgba(0,0,0,0.05)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '16px',
      }}>👤</div>
    </div>
  );

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '16px', background: 'linear-gradient(135deg, #FFF7F4 0%, #FFF0E8 100%)' }}>
        <div className="loader" style={{ width: 40, height: 40, borderWidth: 4 }} />
        <p style={{ color: 'var(--text-secondary)' }}>Fetching ticket #{ticket}...</p>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div style={{ background: 'linear-gradient(135deg, #FFF7F4 0%, #FFF0E8 100%)', minHeight: '100vh', color: 'var(--text-primary)' }}>
        {renderHeader()}
        <BottomNav />
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 24px', textAlign: 'center' }} className="animate-fade-in">
          <div style={{ fontSize: '64px', marginBottom: '16px', opacity: 0.5 }}>🔍</div>
          <h2 style={{ fontWeight: 800, marginBottom: '8px', fontSize: '24px' }}>Ticket Not Found</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '32px' }}>{error || 'The requested ticket could not be found.'}</p>
          <Link href="/menu" className="btn btn-primary btn-lg" style={{ width: '100%', maxWidth: '300px' }}>
            Go to Menu →
          </Link>
        </div>
      </div>
    );
  }

  const stageIndex = getStageIndex(order.status);
  const isReady = order.status === 'READY';
  const isActive = ['PENDING', 'PREPARING', 'READY'].includes(order.status);

  // Use the precise database rank if available. If it's not present (e.g. order is cancelled or done), we treat as 0.
  const position = typeof order.queue_position === 'number' ? order.queue_position : 0;

  // The position variable is at least 1 thanks to the DB subquery (COUNT(*) + 1).
  // If it's somehow 0, we show 1 as a safe default for active orders.
  const displayPosition = position || 1;

  const getNearlyText = () => {
    if (isReady) return '🎉 Ready!';
    return '👨‍🍳 Processing your order...';
  };

  return (
    <div style={{ background: 'linear-gradient(135deg, #FFF7F4 0%, #FFF0E8 100%)', minHeight: '100vh', color: 'var(--text-primary)' }}>
      {renderHeader()}

      {/* Live Status Banner */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: '8px', padding: '10px',
        background: isLive ? 'rgba(6,167,125,0.08)' : 'rgba(255,165,0,0.08)',
        borderBottom: '1px solid rgba(0,0,0,0.05)',
      }}>
        <span className={isLive ? 'live-dot' : ''} style={{ background: isLive ? 'var(--success)' : 'var(--warning)' }} />
        <span style={{
          fontSize: '12px', fontWeight: 700, letterSpacing: '0.08em',
          color: isLive ? 'var(--success)' : 'var(--warning)',
          textTransform: 'uppercase',
        }}>
          {isLive ? '● LIVE STATUS UPDATE' : '⚡ CONNECTING...'}
        </span>
      </div>

      <div style={{ maxWidth: '480px', margin: '0 auto', padding: '20px 16px 100px' }} className="animate-fade-in">

        {isActive ? (
          <>
            {/* Ticket Card */}
            <div style={{
              background: 'white',
              border: '1px solid rgba(0,0,0,0.05)',
              borderRadius: '20px',
              padding: '28px 24px',
              textAlign: 'center',
              marginBottom: '20px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.04)',
            }}>
              <p style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '12px' }}>
                YOUR TICKET NUMBER
              </p>
              <div style={{ fontSize: '72px', fontWeight: 900, color: 'var(--primary)', lineHeight: 1, letterSpacing: '-2px', marginBottom: '8px' }}>
                #{String(order.ticket_number).padStart(3, '0')}
              </div>

              {isActive && !isReady && (
                <div style={{ 
                  margin: '12px 0 20px',
                  padding: '12px',
                  background: 'rgba(255,107,53,0.03)',
                  borderRadius: '16px',
                  border: '1px solid rgba(255,107,53,0.08)'
                }}>
                  <p style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
                    Current Position
                  </p>
                  <div style={{ fontSize: '32px', fontWeight: 900, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '20px' }}>📍</span> {formatOrdinal(displayPosition)}
                  </div>
                </div>
              )}

              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                background: isReady ? 'rgba(6,167,125,0.1)' : 'rgba(0,0,0,0.04)',
                color: isReady ? 'var(--success)' : 'var(--text-primary)',
                padding: '6px 16px', borderRadius: '999px',
                fontSize: '13px', fontWeight: 700,
                border: `1px solid ${isReady ? 'rgba(6,167,125,0.2)' : 'rgba(0,0,0,0.05)'}`,
                marginBottom: '20px',
              }}>
                {isReady ? '✓' : '●'} {isReady ? 'Confirmed & Ready!' : 'Confirmed & Active'}
              </span>



              {isReady && (
                <div style={{
                  background: 'rgba(6,167,125,0.1)',
                  border: '1px solid rgba(6,167,125,0.2)',
                  borderRadius: '14px',
                  padding: '16px',
                  fontSize: '20px', fontWeight: 900, color: 'var(--success)',
                  textTransform: 'uppercase'
                }}>
                  READY FOR PICKUP
                </div>
              )}
            </div>

            {/* Progress */}
            <div style={{
              background: 'white',
              border: '1px solid rgba(0,0,0,0.05)',
              borderRadius: '20px',
              padding: '20px',
              marginBottom: '20px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.04)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ fontWeight: 700, fontSize: '16px' }}>Queue Progress</h3>
                <span style={{ fontSize: '13px', color: 'var(--primary)', fontWeight: 600 }}>{getNearlyText()}</span>
              </div>
              <div className="progress-track" style={{ background: '#F3F4F6' }}>
                <div className="progress-fill" style={{ width: `${Math.min(100, (stageIndex / 2) * 100)}%` }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '24px' }}>
                {STAGES.map((stage, i) => (
                  <div key={stage.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', flex: 1 }}>
                    <div style={{
                      width: '32px', height: '32px', borderRadius: '50%',
                      background: stageIndex >= i ? 'var(--primary)' : '#F3F4F6',
                      color: stageIndex >= i ? 'white' : 'var(--text-secondary)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px',
                      boxShadow: stageIndex >= i ? '0 4px 12px rgba(255,107,53,0.3)' : 'none',
                    }}>
                      {stageIndex > i ? '✓' : stage.icon}
                    </div>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: stageIndex >= i ? 'var(--primary)' : 'var(--text-secondary)' }}>{stage.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div style={{
            textAlign: 'center',
            padding: '32px 24px',
            background: 'white',
            borderRadius: '20px',
            marginBottom: '20px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.04)',
            border: '1px solid rgba(0,0,0,0.05)'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>🍽️</div>
            <h2 style={{ fontWeight: 800, fontSize: '20px', marginBottom: '4px' }}>No Status for Orders</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '16px' }}>
              Ticket #{String(order.ticket_number).padStart(3, '0')} is already {order.status.toLowerCase()}.
            </p>
          </div>
        )}

        {/* Details - Always shown if order exists */}
        <div style={{
          background: 'white',
          border: '1px solid rgba(0,0,0,0.05)',
          borderRadius: '20px',
          padding: '20px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.04)',
        }}>
          <h3 style={{ fontWeight: 700, marginBottom: '14px' }}>Order Details</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {(order.items || []).map((item, idx) => (
              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>{item.product_name} × {item.quantity}</span>
                <span style={{ fontWeight: 600 }}>{formatPrice(item.price_at_purchase * item.quantity)}</span>
              </div>
            ))}
            <hr style={{ border: 'none', borderTop: '1px dashed rgba(0,0,0,0.1)', margin: '8px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800 }}>
              <span>Total</span>
              <span style={{ color: 'var(--primary)' }}>{formatPrice(order.total_price)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginTop: '4px', color: 'var(--text-secondary)' }}>
              <span>Status</span>
              <span style={{ fontWeight: 700, color: order.status === 'COMPLETED' ? 'var(--success)' : 'var(--primary)' }}>{order.status}</span>
            </div>
          </div>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
