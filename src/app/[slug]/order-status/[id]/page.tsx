'use client';
import { useState, useEffect, useRef, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ChevronLeft,
  Circle,
  MapPin,
  Bell,
  CheckCircle2,
  Search,
  Utensils,
  CircleDollarSign,
  Info,
  ClipboardEdit,
  Receipt,
  Gift
} from 'lucide-react';
import { formatPrice, formatOrdinal } from '@/lib/format';
import { Order } from '@/types';

import { pusherClient } from '@/lib/pusher-client';
import { orderService } from '@/app/services/orders.api';
import { useRestaurant } from '@/hooks/useRestaurant';
import BillTemplate from '@/components/BillTemplate';

import OrderStatusBadge from '@/components/modules/orders/OrderStatusBadge';

type QueueState = {
  type: string;
  queue_number: number;
  last_served_number: number;
  timestamp: string;
};

const DEFAULT_STAGES_KOT = [
  { key: 'PENDING', label: 'ORDERED', icon: CheckCircle2 },
  { key: 'PREPARING', label: 'PREPARING', icon: Search },
  { key: 'SERVED', label: 'SERVED', icon: Utensils },
  { key: 'CLOSED', label: 'COMPLETED', icon: CheckCircle2 },
];

const DEFAULT_STAGES_KDS = [
  { key: 'PENDING', label: 'ORDERED', icon: CheckCircle2 },
  { key: 'PREPARING', label: 'PREPARING', icon: Search },
  { key: 'READY', label: 'READY', icon: Utensils },
  { key: 'SERVED', label: 'SERVED', icon: Utensils },
  { key: 'CLOSED', label: 'COMPLETED', icon: CheckCircle2 },
];

function getStageIndex(status: string, stages: any[]) {
  const index = stages.findIndex(s => s.key === status);
  return index !== -1 ? index : 0;
}

export default function OrderStatusTicketPage({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = use(params);
  const router = useRouter();
  const { restaurant, loading: resLoading } = useRestaurant();

  useEffect(() => {
    if (!resLoading && restaurant) {
      const showOrdering = restaurant.modules?.ONLINE_ORDERING !== false;
      const showQueue = restaurant.modules?.QUEUE_MANAGEMENT !== false;
      if (!showOrdering && !showQueue) {
        router.replace(`/${slug}/menu`);
      }
    }
  }, [restaurant, resLoading, router, slug]);

  const isKdsMode = (restaurant?.kitchen_mode || 'KOT').toUpperCase() === 'KDS';
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLive, setIsLive] = useState(false);
  const [error, setError] = useState('');
  const [showSurveyTip, setShowSurveyTip] = useState(false);
  const [showBill, setShowBill] = useState(false);
  const [stages, setStages] = useState(isKdsMode ? DEFAULT_STAGES_KDS : DEFAULT_STAGES_KOT);
  const [loyaltySettings, setLoyaltySettings] = useState<any>(null);
  const [loyaltyEnabled, setLoyaltyEnabled] = useState(
    () => restaurant?.modules?.LOYALTY_PROGRAM !== false
  );

  useEffect(() => {
    if (restaurant?.modules?.LOYALTY_PROGRAM === false) {
      setLoyaltyEnabled(false);
      setLoyaltySettings(null);
      return;
    }
    if (!slug) return;
    fetch(`/api/admin/loyalty/settings?slug=${slug}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success && json.data) {
          setLoyaltySettings(json.data);
          setLoyaltyEnabled(json.data.is_enabled !== false && restaurant?.modules?.LOYALTY_PROGRAM !== false);
        }
      })
      .catch(() => {});
  }, [slug, restaurant?.modules?.LOYALTY_PROGRAM]);

  useEffect(() => {
    const isKds = (restaurant?.kitchen_mode || 'KOT').toUpperCase() === 'KDS';
    setStages(isKds ? DEFAULT_STAGES_KDS : DEFAULT_STAGES_KOT);
  }, [restaurant?.kitchen_mode]);

  useEffect(() => {
    if (!localStorage.getItem('hideSurveyTip_kdK8Jd')) {
      setShowSurveyTip(true);
    }
  }, []);

  const handleSurveyClick = () => {
    localStorage.setItem('hideSurveyTip_kdK8Jd', 'true');
    setShowSurveyTip(false);
  };

  const orderRef = useRef<Order | null>(null);
  useEffect(() => { orderRef.current = order; }, [order]);

  useEffect(() => {
    const fetchOrder = async (silent = false) => {
      try {
        const data = await orderService.getOrderById(id);
        if (data.success && data.data) {
          setOrder(data.data);
        } else if (!silent) {
          setError(data.error || 'Order not found');
          setOrder(null);
        }
      } catch (err) {
        console.error('❌ Failed to fetch order:', err);
        if (!silent) setError('Failed to load order');
      } finally {
        if (!silent) setLoading(false);
      }
    };

    fetchOrder();

    if (!pusherClient || !restaurant) return;
    const channelName = restaurant.pusher_channel;
    const channel = pusherClient.subscribe(channelName);

    channel.bind('pusher:subscription_succeeded', () => setIsLive(true));
    channel.bind('pusher:subscription_error', () => setIsLive(false));

    channel.bind('order_update', (data: any) => {
      const currentOrder = orderRef.current;
      const isOurOrder = data.order_id === id || (currentOrder?.id && data.order_id === currentOrder.id);

      if (isOurOrder) {
        if (data.new_status === 'READY' && currentOrder?.status !== 'READY') {
          try {
            new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3').play().catch(() => { });
          } catch { }
        }
        setOrder(prev => prev ? { ...prev, status: data.new_status || prev.status, is_paid: typeof data.is_paid === 'boolean' ? data.is_paid : prev.is_paid } : null);
        fetchOrder(true);
      }
    });

    channel.bind('queue_updated', (data: any) => {
      if (data.type === 'UPDATE' && data.queue) {
        const currentOrder = orderRef.current;
        const isOurOrder = (currentOrder?.ticket_number && data.queue.token_number === currentOrder.ticket_number) || (currentOrder?.id && data.queue.id === currentOrder.queue_id);

        if (isOurOrder) {
          if (data.queue.queue_status === 'READY' && currentOrder?.status !== 'READY') {
            try {
              new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3').play().catch(() => { });
            } catch { }
          }
          setOrder(prev => prev ? { ...prev, status: data.queue.queue_status || prev.status } : null);
          fetchOrder(true);
        }
      }
    });

    return () => {
      channel.unbind_all();
      pusherClient?.unsubscribe(channelName);
    };
  }, [id, restaurant]);

  if (loading) {
    return (
      <div style={{ background: 'var(--bg-gradient)', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="loader" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div style={{ background: 'var(--bg-gradient)', minHeight: '100vh' }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '16px 20px', background: 'white' }}>
          <button onClick={() => router.back()} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '4px' }}>
            <ChevronLeft size={24} color="var(--primary)" />
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: '64px', marginBottom: '16px', opacity: 0.5 }}>🔍</div>
          <h2 style={{ fontWeight: 800, marginBottom: '8px', fontSize: '24px' }}>Ticket Not Found</h2>
          <p style={{ color: '#6B6667', marginBottom: '32px' }}>{error || 'The requested ticket could not be found.'}</p>
          <Link prefetch={false} href={`/${slug}/menu`} className="btn btn-primary btn-lg" style={{ width: '100%', maxWidth: '300px' }}>Go to Menu →</Link>
        </div>

      </div>
    );
  }

  const stageIndex = getStageIndex(order.status, stages);
  const position = typeof order.queue_position === 'number' ? order.queue_position : 0;
  const displayPosition = position || 1;

  return (
    <div style={{ background: 'var(--bg-gradient)', minHeight: '100vh', paddingBottom: '40px' }}>
      {/* Header */}
      <header style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 16px',
        background: 'white',
        position: 'sticky',
        top: 0,
        zIndex: 20,
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
      }}>
        <button onClick={() => router.push(`/${slug}/menu`)} aria-label="Back to menu" style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}>
          <ChevronLeft size={24} color="var(--primary)" />
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Circle size={8} fill={isLive ? "#06A77D" : "#FFA500"} color={isLive ? "#06A77D" : "#FFA500"} />
          <span style={{ fontSize: '12px', fontWeight: 700, color: isLive ? '#06A77D' : '#FFA500', letterSpacing: '0.04em' }}>
            {isLive ? 'LIVE STATUS UPDATE' : 'CONNECTING...'}
          </span>
        </div>
        <div style={{ position: 'relative' }}>
          <a
            href="https://tally.so/r/kdK8Jd"
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleSurveyClick}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '32px',
              height: '32px',
              background: 'rgba(0,0,0,0.04)',
              borderRadius: '50%',
              color: 'var(--primary)',
              textDecoration: 'none',
              transition: 'opacity 0.2s'
            }}
            title="Help us get better"
          >
            <ClipboardEdit size={16} />
          </a>

          {showSurveyTip && (
            <div style={{
              position: 'absolute',
              top: '38px',
              right: '0',
              background: '#33322F',
              color: 'white',
              padding: '6px 10px',
              borderRadius: '8px',
              fontSize: '11px',
              fontWeight: 600,
              whiteSpace: 'nowrap',
              boxShadow: '0 4px 14px rgba(0,0,0,0.2)',
              zIndex: 50,
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <div style={{
                position: 'absolute',
                top: '-4px',
                right: '12px',
                width: '8px',
                height: '8px',
                background: '#33322F',
                transform: 'rotate(45deg)'
              }} />
              <span>Help us get better! 🚀</span>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleSurveyClick();
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#9CA3AF',
                  cursor: 'pointer',
                  padding: '2px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '14px',
                  lineHeight: 1
                }}
              >
                &times;
              </button>
            </div>
          )}
        </div>
      </header>

      <main style={{ maxWidth: '480px', margin: '0 auto', padding: '14px 16px 32px' }}>

        {/* Edit Order Info at Top */}
        <p style={{
          textAlign: 'center',
          color: '#9CA3AF',
          fontSize: '11.5px',
          margin: '0 auto 14px',
          fontWeight: 500,
          padding: '0 12px',
          lineHeight: 1.45
        }}>
          If you want to edit the order, please contact nearby staff.
        </p>

        {/* Ticket Card */}
        <div style={{
          background: 'white',
          borderRadius: '20px',
          padding: '22px 16px',
          textAlign: 'center',
          marginBottom: '14px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
          border: '1px solid rgba(0,0,0,0.02)'
        }}>
          <p style={{ fontSize: '11px', fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.06em', marginBottom: '4px' }}>
            YOUR TICKET NUMBER
          </p>
          <h1 style={{ fontSize: 'clamp(48px, 13vw, 64px)', fontWeight: 900, color: 'var(--primary)', lineHeight: 1.05, margin: '4px 0' }}>
            #{String(order.ticket_number).padStart(3, '0')}
          </h1>

          {/* Queue Position Sub-card — Only for PENDING / WAITING status */}
          {['PENDING', 'WAITING'].includes((order.status || '').trim().toUpperCase()) && (
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              background: 'rgba(0,0,0,0.03)',
              padding: '10px 18px',
              borderRadius: '14px',
              marginTop: '12px'
            }}>
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: '9.5px', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  QUEUE POSITION
                </p>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: '2px' }}>
                  <span style={{ fontSize: '24px', fontWeight: 800, color: '#33322F', lineHeight: 1.1 }}>
                    {formatOrdinal(displayPosition)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Table Number Badge — For PREPARING / READY / SEATED / PAID when table_number is available */}
          {!['PENDING', 'WAITING', 'CANCELLED', 'EXPIRED'].includes((order.status || '').trim().toUpperCase()) && order.table_number && (
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              background: '#ECFDF5',
              border: '1px solid #A7F3D0',
              padding: '8px 16px',
              borderRadius: '14px',
              marginTop: '12px'
            }}>
              <Utensils size={16} color="var(--primary)" />
              <div style={{ textAlign: 'center' }}>
                <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--primary)', letterSpacing: '0.04em' }}>
                  TABLE #{order.table_number}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Loyalty Points Earned / Minimum Spend Notification Card */}
        {loyaltyEnabled && restaurant?.modules?.LOYALTY_PROGRAM !== false && order && order.total_price > 0 && (() => {
          const minOrderAmount = Number(loyaltySettings?.min_order_amount || 0);
          const rate = Number(loyaltySettings?.points_earning_rate ?? 0.1);
          const isPunchMode = loyaltySettings?.loyalty_mode === 'PUNCH_CARD';
          const meetsMinSpend = minOrderAmount <= 0 || order.total_price >= minOrderAmount;
          const pointsEarned = Math.floor(order.total_price * rate);
          const spendDiff = Math.max(0, minOrderAmount - order.total_price);
          const isPaidOrClosed = order.is_paid || (order.status || '').toUpperCase() === 'CLOSED';

          if (meetsMinSpend) {
            return (
              <div style={{
                background: 'linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 100%)',
                borderRadius: '18px',
                padding: '12px 14px',
                marginBottom: '14px',
                border: '1px solid #6EE7B7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '10px',
                boxShadow: '0 4px 12px rgba(5, 150, 105, 0.08)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: '1 1 auto' }}>
                  <div style={{ background: '#059669', color: 'white', width: '36px', height: '36px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Gift size={20} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: '13px', color: '#065F46', lineHeight: 1.25 }}>
                      {isPaidOrClosed ? 'Loyalty Points Earned!' : 'Loyalty Points For This Order'}
                    </div>
                    <div style={{ fontSize: '11px', color: '#047857', marginTop: '2px', fontWeight: 600, lineHeight: 1.3 }}>
                      {isPaidOrClosed ? 'Credited to your CRM balance' : 'Will be credited upon payment completion'}
                    </div>
                  </div>
                </div>
                <div style={{ background: '#059669', color: 'white', padding: '6px 12px', borderRadius: '16px', fontWeight: 800, fontSize: '13.5px', flexShrink: 0, whiteSpace: 'nowrap' }}>
                  {isPunchMode ? '+1 Stamp' : `+${pointsEarned} pts`}
                </div>
              </div>
            );
          }

          // Does not meet minimum order spend requirement
          return (
            <div style={{
              background: 'linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%)',
              borderRadius: '18px',
              padding: '12px 14px',
              marginBottom: '14px',
              border: '1px solid #FCD34D',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '10px',
              boxShadow: '0 4px 12px rgba(217, 119, 6, 0.08)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: '1 1 auto' }}>
                <div style={{ background: '#D97706', color: 'white', width: '36px', height: '36px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Gift size={20} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: '13px', color: '#92400E', lineHeight: 1.25 }}>
                    Min. ₹{minOrderAmount} to Earn Points
                  </div>
                  <div style={{ fontSize: '11px', color: '#B45309', marginTop: '2px', fontWeight: 600, lineHeight: 1.3 }}>
                    Spend ₹{spendDiff.toFixed(0)} more on future orders to earn loyalty rewards ({rate} pt{rate === 1 ? '' : 's'}/₹1)
                  </div>
                </div>
              </div>
              <div style={{ background: '#D97706', color: 'white', padding: '6px 10px', borderRadius: '14px', fontWeight: 800, fontSize: '12px', flexShrink: 0, whiteSpace: 'nowrap' }}>
                Min ₹{minOrderAmount}
              </div>
            </div>
          );
        })()}

        {/* Notification Banner - For PENDING & WAITING statuses */}
        {['PENDING', 'WAITING'].includes((order.status || '').trim().toUpperCase()) && (
          <div style={{
            background: '#EEF6FF',
            borderRadius: '16px',
            padding: '12px 14px',
            display: 'flex',
            gap: '10px',
            alignItems: 'flex-start',
            marginBottom: '14px',
            border: '1px solid #DBEAFE'
          }}>
            <div style={{ padding: '2px', flexShrink: 0 }}>
              <Bell size={18} color="#FBBF24" fill="#FBBF24" />
            </div>
            <div>
              <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#1E40AF', marginBottom: '2px' }}>Please approach the counter</h4>
              <p style={{ fontSize: '11.5px', color: '#3B82F6', lineHeight: 1.35, fontWeight: 500 }}>
                Receive your table assignment and enjoy your visit.
              </p>
            </div>
          </div>
        )}

        {['CANCELLED', 'EXPIRED'].includes((order.status || '').trim().toUpperCase()) && (
          <div style={{
            background: '#FEF2F2',
            borderRadius: '16px',
            padding: '12px 14px',
            display: 'flex',
            gap: '10px',
            alignItems: 'flex-start',
            marginBottom: '14px',
            border: '1px solid #FCA5A5'
          }}>
            <div style={{ padding: '2px', flexShrink: 0 }}>
              <Info size={18} color="#EF4444" />
            </div>
            <div>
              <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#991B1B', marginBottom: '2px', textTransform: 'capitalize' }}>
                Order {order.status.toLowerCase()}
              </h4>
              <p style={{ fontSize: '11.5px', color: '#B91C1C', lineHeight: 1.35, fontWeight: 500 }}>
                This order is no longer active. Please contact staff for assistance.
              </p>
            </div>
          </div>
        )}

        {/* Queue Progress Card */}
        {!['CANCELLED', 'EXPIRED'].includes((order.status || '').trim().toUpperCase()) && (
          <div style={{
            background: 'white',
            borderRadius: '20px',
            padding: '18px 14px',
            marginBottom: '14px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <h3 style={{ fontWeight: 800, fontSize: '15px', color: '#33322F' }}>Queue Progress</h3>
            </div>

            <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              {/* Connecting Lines dynamically aligned with centers of first and last circles */}
              {(() => {
                const stepOffset = stages.length > 0 ? (100 / (stages.length * 2)) : 10;
                const span = 100 - (stepOffset * 2);
                const progressWidth = stages.length > 1 ? (stageIndex / (stages.length - 1)) * span : 0;
                return (
                  <>
                    <div style={{
                      position: 'absolute',
                      top: '18px',
                      left: `${stepOffset}%`,
                      right: `${stepOffset}%`,
                      height: '2px',
                      background: '#F3F4F6',
                      zIndex: 0
                    }} />
                    <div style={{
                      position: 'absolute',
                      top: '18px',
                      left: `${stepOffset}%`,
                      width: `${progressWidth}%`,
                      height: '2px',
                      background: 'var(--primary)',
                      zIndex: 0,
                      transition: 'width 0.5s ease'
                    }} />
                  </>
                );
              })()}

              {stages.map((stage, i) => {
                const Icon = stage.icon;
                const isTerminalCompleted = stage.key === 'CLOSED' || stage.key === 'PAID';
                const isCompleted = stageIndex > i || (stageIndex === i && isTerminalCompleted);
                const isCurrent = stageIndex === i && !isTerminalCompleted;
                const isPending = stageIndex < i;

                return (
                  <div key={stage.key} style={{ zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', flex: 1, minWidth: 0 }}>
                    <div style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      background: isPending ? 'white' : (isCurrent ? 'white' : 'var(--primary)'),
                      border: isPending ? '1px solid #F3F4F6' : (isCurrent ? '2px solid var(--primary)' : 'none'),
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: isPending ? '#D1D5DB' : (isCurrent ? 'var(--primary)' : 'white'),
                      boxShadow: isCurrent ? '0 0 0 4px rgba(0, 0, 0, 0.04)' : 'none',
                      transition: 'all 0.3s ease',
                      flexShrink: 0
                    }}>
                      {isCompleted ? <CheckCircle2 size={18} /> : <Icon size={18} strokeWidth={isCurrent ? 2.5 : 2} />}
                    </div>
                    <span style={{
                      fontSize: 'clamp(8px, 2.1vw, 9.5px)',
                      fontWeight: 800,
                      color: isPending ? '#9CA3AF' : 'var(--primary)',
                      letterSpacing: '0.01em',
                      textAlign: 'center',
                      lineHeight: 1.2,
                      wordBreak: 'break-word',
                      maxWidth: '100%'
                    }}>
                      {stage.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Order Details Card */}
        <div style={{
          background: 'white',
          borderRadius: '20px',
          padding: '18px 16px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
        }}>
          <h3 style={{ fontWeight: 800, fontSize: '15px', color: '#33322F', marginBottom: '16px' }}>Order Details</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {(order.items || []).map((item, idx) => (
              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <p style={{ fontWeight: 700, fontSize: '14px', color: '#33322F', wordBreak: 'break-word', lineHeight: 1.3 }}>{item.product_name}</p>
                  <p style={{ fontSize: '12px', color: '#9CA3AF', marginTop: '2px' }}>Quantity: {item.quantity}</p>
                </div>
                <span style={{ fontWeight: 700, fontSize: '14px', color: '#33322F', flexShrink: 0, whiteSpace: 'nowrap' }}>
                  {formatPrice(item.price_at_purchase * item.quantity)}
                </span>
              </div>
            ))}

            <div style={{ borderTop: '1px dashed #E5E7EB', margin: '4px 0' }} />

            {/* Subtotal */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '13.5px', color: '#6B6667', fontWeight: 500 }}>Subtotal</span>
              <span style={{ fontWeight: 700, fontSize: '13.5px', color: '#33322F' }}>
                {formatPrice(order.subtotal ?? (order.items || []).reduce((sum, item) => sum + item.price_at_purchase * item.quantity, 0))}
              </span>
            </div>

            {/* GST Breakdown for REGULAR */}
            {((order as any).gst_type === 'REGULAR' || (restaurant?.gst_type === 'REGULAR' && (order as any).gst_type !== 'NONE' && (order as any).gst_type !== 'COMPOSITION')) && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12.5px', color: '#6B6667', fontWeight: 500 }}>
                    CGST {((order as any).gst_rate || restaurant?.gst_rate || 0) / 2}%
                  </span>
                  <span style={{ fontWeight: 600, fontSize: '12.5px', color: '#4B5563' }}>
                    {formatPrice(Math.round(((order as any).gst_amount || 0) / 2 * 100) / 100)}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12.5px', color: '#6B6667', fontWeight: 500 }}>
                    SGST {((order as any).gst_rate || restaurant?.gst_rate || 0) / 2}%
                  </span>
                  <span style={{ fontWeight: 600, fontSize: '12.5px', color: '#4B5563' }}>
                    {formatPrice(Math.round(((order as any).gst_amount || 0) / 2 * 100) / 100)}
                  </span>
                </div>
                <div style={{ borderTop: '1px dashed #E5E7EB', margin: '2px 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '13.5px', color: '#33322F', fontWeight: 600 }}>
                    Total GST {((order as any).gst_rate || restaurant?.gst_rate || 0)}%
                  </span>
                  <span style={{ fontWeight: 700, fontSize: '13.5px', color: '#33322F' }}>
                    {formatPrice((order as any).gst_amount || 0)}
                  </span>
                </div>
              </>
            )}

            {order.discount_amount && Number(order.discount_amount) > 0 ? (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13.5px', color: '#16a34a', fontWeight: 600 }}>Discount</span>
                <span style={{ fontWeight: 700, fontSize: '13.5px', color: '#16a34a' }}>
                  -{formatPrice(order.discount_amount)}
                </span>
              </div>
            ) : null}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '13.5px', color: '#6B6667', fontWeight: 500 }}>Status</span>
              <OrderStatusBadge status={order.status} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '4px' }}>
              <span style={{ fontSize: '16px', fontWeight: 800, color: '#33322F' }}>Grand Total</span>
              <span style={{ fontSize: '17px', fontWeight: 900, color: 'var(--primary)' }}>
                {formatPrice(order.total_price)}
              </span>
            </div>
          </div>
        </div>

        {/* Print Bill Button — Only shown after payment */}
        {order.is_paid && (
          <div style={{ marginTop: '20px' }}>
            <button
              onClick={() => setShowBill(true)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                padding: '16px 24px',
                borderRadius: '16px',
                border: 'none',
                background: 'white',
                color: 'var(--primary)',
                fontSize: '15px',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 6px 24px rgba(0,0,0,0.08)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.03)';
              }}
            >
              <Receipt size={18} />
              Print Bill
            </button>
          </div>
        )}

      </main>

      {/* Bill Template Modal */}
      {showBill && order && restaurant && (
        <BillTemplate
          order={order}
          restaurant={{
            name: restaurant.name,
            logo_url: restaurant.logo_url,
            address: restaurant.address,
            phone: restaurant.phone,
            primary_color: restaurant.primary_color,
            gst_number: restaurant.gst_number,
          }}
          onClose={() => setShowBill(false)}
        />
      )}

    </div>
  );
}
