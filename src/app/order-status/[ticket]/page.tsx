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
  ClipboardEdit
} from 'lucide-react';
import { formatPrice, formatOrdinal } from '@/lib/format';
import { Order } from '@/types';
import BottomNav from '@/components/BottomNav';
import { pusherClient } from '@/lib/pusher-client';
import { orderService } from '@/app/services/orders.api';

type QueueState = {
  type: string;
  queue_number: number;
  last_served_number: number;
  timestamp: string;
};

const STAGES = [
  { key: 'PENDING', label: 'CHECK-IN', icon: CheckCircle2 },
  { key: 'PREPARING', label: 'PREPARING', icon: Search },
  { key: 'READY', label: 'READY', icon: Utensils },
  { key: 'PAID', label: 'PAID', icon: CircleDollarSign },
];

function getStageIndex(status: string) {
  if (status === 'PENDING') return 0;
  if (status === 'PREPARING') return 1;
  if (status === 'READY') return 2;
  if (status === 'PAID') return 3;
  return -1; // cancelled
}

export default function OrderStatusTicketPage({ params }: { params: Promise<{ ticket: string }> }) {
  const { ticket } = use(params);
  const router = useRouter();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLive, setIsLive] = useState(false);
  const [error, setError] = useState('');
  const [showSurveyTip, setShowSurveyTip] = useState(false);

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
        const data = await orderService.getOrderByTicket(ticket);
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

    if (!pusherClient) return;
    const channel = pusherClient.subscribe('queue-channel');

    channel.bind('pusher:subscription_succeeded', () => setIsLive(true));
    channel.bind('pusher:subscription_error', () => setIsLive(false));

    channel.bind('order_update', (data: any) => {
      const currentTicketInt = parseInt(ticket);
      const currentOrder = orderRef.current;
      const isOurOrder = data.ticket_number === currentTicketInt || (currentOrder?.id && data.order_id === currentOrder.id);

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

    return () => {
      channel.unbind_all();
      pusherClient?.unsubscribe('queue-channel');
    };
  }, [ticket]);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '16px', background: '#FDF9FA' }}>
        <div className="loader" style={{ width: 40, height: 40, borderWidth: 4 }} />
        <p style={{ color: '#6B6667' }}>Fetching ticket #{ticket}...</p>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div style={{ background: '#FDF9FA', minHeight: '100vh' }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '16px 20px', background: 'white' }}>
          <button onClick={() => router.back()} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '4px' }}>
            <ChevronLeft size={24} color="#800020" />
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: '64px', marginBottom: '16px', opacity: 0.5 }}>🔍</div>
          <h2 style={{ fontWeight: 800, marginBottom: '8px', fontSize: '24px' }}>Ticket Not Found</h2>
          <p style={{ color: '#6B6667', marginBottom: '32px' }}>{error || 'The requested ticket could not be found.'}</p>
          <Link prefetch={false} href="/menu" className="btn btn-primary btn-lg" style={{ width: '100%', maxWidth: '300px' }}>Go to Menu →</Link>
        </div>
        <BottomNav />
      </div>
    );
  }

  const stageIndex = getStageIndex(order.status);
  const position = typeof order.queue_position === 'number' ? order.queue_position : 0;
  const displayPosition = position || 1;

  return (
    <div style={{ background: '#FDF9FA', minHeight: '100vh', paddingBottom: '120px' }}>
      {/* Header */}
      <header style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 20px',
        background: 'white',
        position: 'sticky',
        top: 0,
        zIndex: 10
      }}>
        <button onClick={() => router.back()} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}>
          <ChevronLeft size={24} color="#800020" />
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Circle size={8} fill={isLive ? "#06A77D" : "#FFA500"} color={isLive ? "#06A77D" : "#FFA500"} />
          <span style={{ fontSize: '13px', fontWeight: 700, color: isLive ? '#06A77D' : '#FFA500', letterSpacing: '0.02em' }}>
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
              background: '#FFF5F7',
              borderRadius: '50%',
              color: '#800020',
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
              top: '40px',
              right: '0',
              background: '#33322F',
              color: 'white',
              padding: '8px 12px',
              borderRadius: '8px',
              fontSize: '11px',
              fontWeight: 600,
              whiteSpace: 'nowrap',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
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
              <span> Help us get better! 🚀</span>
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

      <main style={{ maxWidth: '480px', margin: '0 auto', padding: '20px 16px' }}>

        {/* Edit Order Info at Top */}
        <p style={{
          textAlign: 'center',
          color: '#9CA3AF',
          fontSize: '12px',
          marginBottom: '24px',
          fontWeight: 500,
          padding: '0 20px',
          lineHeight: 1.5
        }}>
          If you want to edit the order, please contact nearby staff.
        </p>

        {/* Ticket Card */}
        <div style={{
          background: 'white',
          borderRadius: '24px',
          padding: '32px 24px',
          textAlign: 'center',
          marginBottom: '20px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
          border: '1px solid rgba(0,0,0,0.02)'
        }}>
          <p style={{ fontSize: '13px', fontWeight: 600, color: '#9CA3AF', letterSpacing: '0.05em', marginBottom: '8px' }}>
            YOUR TICKET NUMBER
          </p>
          <h1 style={{ fontSize: '72px', fontWeight: 900, color: '#800020', lineHeight: 1, margin: '8px 0' }}>
            #{String(order.ticket_number).padStart(3, '0')}
          </h1>

          {/* Queue Position Sub-card - Only for PENDING status */}
          {order.status === 'PENDING' && (
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              background: '#FFF5F7',
              padding: '12px 24px',
              borderRadius: '16px',
              marginTop: '16px'
            }}>
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: '10px', fontWeight: 800, color: '#800020', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  QUEUE POSITION
                </p>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: '4px' }}>
                  <span style={{ fontSize: '28px', fontWeight: 800, color: '#33322F' }}>
                    {formatOrdinal(displayPosition)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Notification Banner - Only for PENDING status */}
        {order.status === 'PENDING' && (
          <div style={{
            background: '#EEF6FF',
            borderRadius: '18px',
            padding: '16px',
            display: 'flex',
            gap: '12px',
            alignItems: 'flex-start',
            marginBottom: '20px',
            border: '1px solid #DBEAFE'
          }}>
            <div style={{ padding: '4px' }}>
              <Bell size={20} color="#FBBF24" fill="#FBBF24" />
            </div>
            <div>
              <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#1E40AF', marginBottom: '2px' }}>Please approach the counter</h4>
              <p style={{ fontSize: '12px', color: '#3B82F6', lineHeight: 1.4, fontWeight: 500 }}>
                Receive your table assignment and enjoy your visit.
              </p>
            </div>
          </div>
        )}

        {/* Queue Progress Card */}
        <div style={{
          background: 'white',
          borderRadius: '24px',
          padding: '24px',
          marginBottom: '20px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <h3 style={{ fontWeight: 800, fontSize: '17px', color: '#33322F' }}>Queue Progress</h3>
            <span style={{
              fontSize: '11px',
              fontWeight: 700,
              background: '#FFF1F2',
              color: '#800020',
              padding: '4px 10px',
              borderRadius: '99px'
            }}>Active</span>
          </div>

          <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            {/* Connecting Lines */}
            <div style={{
              position: 'absolute',
              top: '20px',
              left: '10%',
              right: '10%',
              height: '2px',
              background: '#F3F4F6',
              zIndex: 0
            }} />
            <div style={{
              position: 'absolute',
              top: '20px',
              left: '10%',
              width: `${(stageIndex / (STAGES.length - 1)) * 80}%`,
              height: '2px',
              background: '#800020',
              zIndex: 0,
              transition: 'width 0.5s ease'
            }} />

            {STAGES.map((stage, i) => {
              const Icon = stage.icon;
              const isCompleted = stageIndex > i;
              const isCurrent = stageIndex === i;
              const isPending = stageIndex < i;

              return (
                <div key={stage.key} style={{ zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', flex: 1 }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    background: isPending ? 'white' : (isCurrent ? 'white' : '#800020'),
                    border: isPending ? '1px solid #F3F4F6' : (isCurrent ? '2px solid #800020' : 'none'),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: isPending ? '#D1D5DB' : (isCurrent ? '#800020' : 'white'),
                    boxShadow: isCurrent ? '0 0 0 4px rgba(128, 0, 32, 0.05)' : 'none',
                    transition: 'all 0.3s ease'
                  }}>
                    {isCompleted ? <CheckCircle2 size={20} /> : <Icon size={20} strokeWidth={isCurrent ? 2.5 : 2} />}
                  </div>
                  <span style={{
                    fontSize: '9px',
                    fontWeight: 800,
                    color: isPending ? '#9CA3AF' : '#800020',
                    letterSpacing: '0.02em'
                  }}>
                    {stage.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Order Details Card */}
        <div style={{
          background: 'white',
          borderRadius: '24px',
          padding: '24px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
        }}>
          <h3 style={{ fontWeight: 800, fontSize: '17px', color: '#33322F', marginBottom: '20px' }}>Order Details</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {(order.items || []).map((item, idx) => (
              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <p style={{ fontWeight: 700, fontSize: '15px', color: '#33322F' }}>{item.product_name}</p>
                  <p style={{ fontSize: '13px', color: '#9CA3AF', marginTop: '2px' }}>Quantity: {item.quantity}</p>
                </div>
                <span style={{ fontWeight: 700, fontSize: '15px', color: '#33322F' }}>
                  {formatPrice(item.price_at_purchase * item.quantity)}
                </span>
              </div>
            ))}

            <div style={{ borderTop: '1px dashed #E5E7EB', margin: '8px 0' }} />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '14px', color: '#6B6667', fontWeight: 500 }}>Status</span>
              <span style={{ fontWeight: 800, fontSize: '14px', color: '#EC7951', textTransform: 'uppercase' }}>
                {order.status}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '18px', fontWeight: 800, color: '#33322F' }}>Total</span>
              <span style={{ fontSize: '18px', fontWeight: 900, color: '#800020' }}>
                {formatPrice(order.total_price)}
              </span>
            </div>
          </div>
        </div>

      </main>

      <BottomNav />
    </div>
  );
}
