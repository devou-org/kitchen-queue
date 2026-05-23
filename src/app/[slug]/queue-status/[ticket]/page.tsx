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
import { useRestaurant } from '@/hooks/useRestaurant';

type QueueState = {
  type: string;
  queue_number: number;
  last_served_number: number;
  timestamp: string;
};

const ICONS: Record<string, any> = {
  'WAITING': Search,
  'PENDING': CheckCircle2,
  'PREPARING': Search,
  'READY': Utensils,
  'PAID': CircleDollarSign,
  'SEATED': Utensils,
};

export default function QueueStatusTicketPage({ params }: { params: Promise<{ slug: string; ticket: string }> }) {
  const { slug, ticket } = use(params);
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

  const [ticketData, setTicketData] = useState<any>(null);
  const [stages, setStages] = useState<any[]>([]);
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

  const ticketRef = useRef<any>(null);
  useEffect(() => { ticketRef.current = ticketData; }, [ticketData]);

  useEffect(() => {
    const fetchTicketAndStatuses = async (silent = false) => {
      if (!restaurant) return;
      try {
        const [ticketRes, statusesRes] = await Promise.all([
          fetch(`/api/queue/ticket?restaurantId=${restaurant.id}&tokenNumber=${ticket}`),
          fetch(`/api/queue/statuses`, { headers: { 'x-restaurant-slug': (Array.isArray(slug) ? slug[0] : slug) || '' } })
        ]);

        const ticketResult = await ticketRes.json();
        if (ticketResult.success && ticketResult.data) {
          setTicketData(ticketResult.data);
        } else if (!silent) {
          setError(ticketResult.error || 'Ticket not found');
          setTicketData(null);
        }

        const statusesResult = await statusesRes.json();
        if (statusesResult.success && statusesResult.data) {
           const formattedStages = statusesResult.data.map((s: any) => ({
             key: s.possible_queue_status,
             label: s.possible_queue_status,
             icon: ICONS[s.possible_queue_status] || Search
           }));
           setStages(formattedStages);
        }

      } catch (err) {
        console.error('❌ Failed to fetch data:', err);
        if (!silent) setError('Failed to load data');
      } finally {
        if (!silent) setLoading(false);
      }
    };

    fetchTicketAndStatuses();

    if (!pusherClient || !restaurant) return;
    const channelName = restaurant.pusher_channel;
    const channel = pusherClient.subscribe(channelName);

    channel.bind('pusher:subscription_succeeded', () => setIsLive(true));
    channel.bind('pusher:subscription_error', () => setIsLive(false));

    channel.bind('queue_updated', (data: any) => {
      if (data.type === 'UPDATE' && data.queue) {
        const currentTicketInt = parseInt(ticket);
        const currentTicket = ticketRef.current;
        const isOurTicket = data.queue.token_number === currentTicketInt;
        
        if (isOurTicket) {
          if (data.queue.queue_status === 'READY' && currentTicket?.queue_status !== 'READY') {
            try {
              new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3').play().catch(() => { });
            } catch { }
          }
          setTicketData((prev: any) => prev ? { ...prev, queue_status: data.queue.queue_status || prev.queue_status } : null);
          fetchTicketAndStatuses(true);
        }
      } else if (data.type === 'JOIN') {
         fetchTicketAndStatuses(true);
      }
    });



    return () => {
      channel.unbind_all();
      pusherClient?.unsubscribe(channelName);
    };
  }, [ticket, restaurant]);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '16px', background: 'var(--bg-gradient)' }}>
        <div className="loader" style={{ width: 40, height: 40, borderWidth: 4 }} />
        <p style={{ color: '#6B6667' }}>Fetching ticket #{ticket}...</p>
      </div>
    );
  }

  if (error || !ticketData) {
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
        <BottomNav />
      </div>
    );
  }

  const stageIndex = stages.findIndex(s => s.key === (ticketData.queue_status || 'WAITING'));
  const currentStageIndex = stageIndex !== -1 ? stageIndex : 0;
  const position = typeof ticketData.position === 'number' ? ticketData.position : 0;
  const displayPosition = position || 1;

  return (
    <div style={{ background: 'var(--bg-gradient)', minHeight: '100vh', paddingBottom: '120px' }}>
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
          <ChevronLeft size={24} color="var(--primary)" />
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
          <h1 style={{ fontSize: '72px', fontWeight: 900, color: 'var(--primary)', lineHeight: 1, margin: '8px 0' }}>
            #{String(ticketData.token_number).padStart(3, '0')}
          </h1>

          {/* Queue Position Sub-card */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            background: 'rgba(0,0,0,0.03)',
            padding: '12px 24px',
            borderRadius: '16px',
            marginTop: '16px'
          }}>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: '10px', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                QUEUE POSITION
              </p>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: '4px' }}>
                <span style={{ fontSize: '28px', fontWeight: 800, color: '#33322F' }}>
                  {formatOrdinal(displayPosition)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Notification Banner - Only for PENDING/WAITING status */}
        {(ticketData.queue_status === 'WAITING' || ticketData.queue_status === 'PENDING') && (
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
              width: stages.length > 1 ? `${(currentStageIndex / (stages.length - 1)) * 80}%` : '0%',
              height: '2px',
              background: 'var(--primary)',
              zIndex: 0,
              transition: 'width 0.5s ease'
            }} />

            {stages.map((stage, i) => {
              const Icon = stage.icon;
              const isCompleted = currentStageIndex > i || (currentStageIndex === i && i === stages.length - 1);
              const isCurrent = currentStageIndex === i && i !== stages.length - 1;
              const isPending = currentStageIndex < i;

              return (
                <div key={stage.key} style={{ zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', flex: 1 }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    background: isPending ? 'white' : (isCurrent ? 'white' : 'var(--primary)'),
                    border: isPending ? '1px solid #F3F4F6' : (isCurrent ? '2px solid var(--primary)' : 'none'),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: isPending ? '#D1D5DB' : (isCurrent ? 'var(--primary)' : 'white'),
                    boxShadow: isCurrent ? '0 0 0 4px rgba(0, 0, 0, 0.04)' : 'none',
                    transition: 'all 0.3s ease'
                  }}>
                    {isCompleted ? <CheckCircle2 size={20} /> : <Icon size={20} strokeWidth={isCurrent ? 2.5 : 2} />}
                  </div>
                  <span style={{
                    fontSize: '9px',
                    fontWeight: 800,
                    color: isPending ? '#9CA3AF' : 'var(--primary)',
                    letterSpacing: '0.02em'
                  }}>
                    {stage.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Waitlist Details Card */}
        <div style={{
          background: 'white',
          borderRadius: '24px',
          padding: '24px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
        }}>
          <h3 style={{ fontWeight: 800, fontSize: '17px', color: '#33322F', marginBottom: '20px' }}>Waitlist Details</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '14px', color: '#6B6667', fontWeight: 500 }}>Name</span>
              <span style={{ fontWeight: 800, fontSize: '14px', color: '#33322F' }}>
                {ticketData.user_name || '-'}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '14px', color: '#6B6667', fontWeight: 500 }}>Party Size</span>
              <span style={{ fontWeight: 800, fontSize: '14px', color: '#33322F' }}>
                👤 {ticketData.party_size}
              </span>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '14px', color: '#6B6667', fontWeight: 500 }}>Joined At</span>
              <span style={{ fontWeight: 800, fontSize: '14px', color: '#33322F' }}>
                {new Date(ticketData.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>

            <div style={{ borderTop: '1px dashed #E5E7EB', margin: '8px 0' }} />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '14px', color: '#6B6667', fontWeight: 500 }}>Status</span>
              <span style={{ fontWeight: 800, fontSize: '14px', color: '#EC7951', textTransform: 'uppercase' }}>
                {ticketData.queue_status}
              </span>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '14px', color: '#6B6667', fontWeight: 500 }}>Current Position</span>
              <span style={{ fontWeight: 800, fontSize: '14px', color: '#33322F' }}>
                {displayPosition}
              </span>
            </div>

          </div>
        </div>

      </main>

      <BottomNav />
    </div>
  );
}
