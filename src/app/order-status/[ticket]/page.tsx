'use client';
import { useState, useEffect, useRef, use } from 'react';
import Link from 'next/link';
import { formatPrice, formatOrdinal } from '@/lib/format';
import { Order } from '@/types';

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
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        const res = await fetch(`/api/orders/ticket/${ticket}`);
        const data = await res.json();
        
        if (data.success && data.data) {
          setOrder(data.data);
        } else {
          setError(data.error || 'Order not found');
          setOrder(null);
        }
      } catch (err) {
        console.error('Failed to fetch order:', err);
        setError('Failed to load order');
      } finally {
        setLoading(false);
      }
    };
    fetchOrder();

    // SSE Connection
    const es = new EventSource('/api/queue/stream');
    eventSourceRef.current = es;

    es.onopen = () => setIsLive(true);
    es.onerror = () => setIsLive(false);
    es.onmessage = (e) => {
      const event = JSON.parse(e.data);
      if (event.type === 'queue_update') {
        setQueueState(event);
        setIsLive(true);
      }
      if (event.type === 'order_update' && event.ticket_number === parseInt(ticket)) {
        setOrder(prev => prev ? { ...prev, status: event.new_status } : prev);
      }
    };

    return () => es.close();
  }, [ticket]);

  const renderNavAndHeader = () => (
    <>
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

      <nav style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: 'white', borderTop: '1px solid rgba(0,0,0,0.05)',
        height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'space-around',
        boxShadow: '0 -4px 20px rgba(0,0,0,0.03)',
        zIndex: 10
      }}>
        <Link href="/order-status" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', textDecoration: 'none', color: 'var(--primary)' }}>
          <div style={{
            width: '44px', height: '44px', borderRadius: '50%',
            background: 'var(--primary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px',
            boxShadow: '0 4px 12px rgba(255,107,53,0.3)',
          }}>⏱</div>
          <span style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.05em' }}>STATUS</span>
        </Link>
        <Link href="/menu" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', textDecoration: 'none', color: 'var(--text-secondary)' }}>
          <span style={{ fontSize: '20px' }}>🍴</span>
          <span style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.05em' }}>MENU</span>
        </Link>
        <Link href="/history" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', textDecoration: 'none', color: 'var(--text-secondary)' }}>
          <span style={{ fontSize: '20px' }}>👤</span>
          <span style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.05em' }}>PROFILE</span>
        </Link>
      </nav>
    </>
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
        {renderNavAndHeader()}
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

  const currentQueueNum = queueState?.queue_number || 1;
  const position = order.ticket_number - currentQueueNum;
  const stageIndex = getStageIndex(order.status);
  const isReady = order.status === 'READY';
  const isActive = ['PENDING', 'PREPARING', 'READY'].includes(order.status);

  const getPositionText = () => {
    if (isReady) return 'Ready for Pickup!';
    if (position <= 0) return 'Your Turn is NEXT!';
    return `${formatOrdinal(position)} IN LINE`;
  };

  const getNearlyText = () => {
    if (isReady) return '🎉 Ready!';
    if (position <= 1) return 'Almost there!';
    if (position <= 3) return 'Nearly there!';
    return `~${Math.ceil(position * 5)} min wait`;
  };

  return (
    <div style={{ background: 'linear-gradient(135deg, #FFF7F4 0%, #FFF0E8 100%)', minHeight: '100vh', color: 'var(--text-primary)' }}>
      {renderNavAndHeader()}

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
              <div style={{ fontSize: '72px', fontWeight: 900, color: 'var(--primary)', lineHeight: 1, letterSpacing: '-2px', marginBottom: '16px' }}>
                #{String(order.ticket_number).padStart(3, '0')}
              </div>

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

              {!isReady && (
                <div style={{
                  background: '#F9FAFB',
                  borderRadius: '14px',
                  padding: '16px',
                  display: 'inline-flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '4px',
                  minWidth: '140px',
                  border: '1px solid rgba(0,0,0,0.03)',
                }}>
                  <svg width="24" height="24" fill="none" stroke="var(--text-secondary)" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
                    <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
                  </svg>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>Your position</p>
                  <p style={{ fontWeight: 900, fontSize: '22px', lineHeight: 1 }}>{getPositionText()}</p>
                </div>
              )}

              {isReady && (
                <div style={{
                  background: 'rgba(6,167,125,0.1)',
                  border: '1px solid rgba(6,167,125,0.2)',
                  borderRadius: '14px',
                  padding: '16px',
                  fontSize: '16px', fontWeight: 700, color: 'var(--success)',
                }}>
                  🎉 Your order is ready for pickup!
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
    </div>
  );
}
