'use client';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useRestaurant } from '@/hooks/useRestaurant';
import { pusherClient } from '@/lib/pusher-client';
import { Users } from 'lucide-react';

export default function QueueBoardPage() {
  const { slug } = useParams();
  const { restaurant, loading: resLoading } = useRestaurant();
  const [queues, setQueues] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLive, setIsLive] = useState(false);

  const fetchQueues = async (silent = false) => {
    if (!restaurant) return;
    if (!silent) setLoading(true);
    try {
      const res = await fetch(`/api/admin/queue?restaurantId=${restaurant.id}`);
      const data = await res.json();
      if (data.success) {
        setQueues(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch queues', err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    if (restaurant) {
      fetchQueues();
    }
  }, [restaurant]);

  useEffect(() => {
    if (!pusherClient || !restaurant) return;
    const channelName = restaurant.pusher_channel;
    const channel = pusherClient.subscribe(channelName);
    setIsLive(true);

    channel.bind('queue_updated', () => fetchQueues(true));
    channel.bind('pusher:subscription_succeeded', () => setIsLive(true));
    channel.bind('pusher:subscription_error', () => setIsLive(false));

    return () => { channel.unbind_all(); channel.unsubscribe(); };
  }, [restaurant]);

  if (resLoading || loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-gradient)' }}>
        <div className="loader" style={{ width: 44, height: 44, borderWidth: 4 }} />
      </div>
    );
  }

  const activeQueues = queues.filter(q => {
    // If only queue management is active, show WALK_IN. If online ordering is active, show ORDER.
    const targetQueueType = (restaurant?.modules?.ONLINE_ORDERING === false) ? 'WALK_IN' : 'ORDER';
    if (q.queue_type !== targetQueueType) return false;

    return !['CANCELLED', 'SEATED'].includes(q.queue_status);
  });

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-gradient)', padding: '40px', fontFamily: "'Inter', sans-serif" }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {restaurant?.logo_url ? (
            <img src={restaurant.logo_url} alt={restaurant.name} style={{ width: '48px', height: '48px', borderRadius: '10px', objectFit: 'cover' }} />
          ) : (
            <div style={{ width: '48px', height: '48px', borderRadius: '10px', background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', fontWeight: 800 }}>
              {restaurant?.name?.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: 900, margin: 0, lineHeight: 1.2 }}>{restaurant?.name}</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', margin: '2px 0 0 0' }}>Live Waitlist</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: isLive ? 'rgba(6,167,125,0.1)' : 'rgba(255,165,0,0.1)', padding: '6px 12px', borderRadius: '99px' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: isLive ? 'var(--success)' : 'var(--warning)', display: 'inline-block', animation: isLive ? 'pulse 2s infinite' : 'none' }} />
          <span style={{ fontSize: '12px', fontWeight: 800, color: isLive ? 'var(--success)' : 'var(--warning)' }}>{isLive ? 'LIVE' : 'CONNECTING'}</span>
        </div>
      </div>

      {activeQueues.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '100px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: '64px', marginBottom: '24px' }}>🍽️</div>
          <h2 style={{ fontSize: '28px', fontWeight: 800 }}>No Active Queue</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '18px' }}>Walk right in!</p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto', paddingBottom: '16px', margin: '0 -20px', padding: '0 20px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', minWidth: '550px' }}>
            {/* Header Row */}
            <div style={{
              display: 'flex', gap: '12px', justifyContent: 'space-between',
              padding: '0 20px', color: '#9ca3af', fontSize: '12px', fontWeight: 800, letterSpacing: '0.05em'
            }}>
              <div style={{ flex: '1 1 80px' }}>TICKET</div>
              <div style={{ flex: '2 1 140px' }}>NAME</div>
              <div style={{ flex: '1 1 100px' }}>PERSONS</div>
              <div style={{ flex: '1 1 100px', textAlign: 'right' }}>JOINED AT</div>
            </div>

            {activeQueues.map(q => (
              <div key={q.id} style={{
                background: 'white', padding: '16px 20px', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.05)',
                boxShadow: '0 4px 16px rgba(0,0,0,0.03)', display: 'flex',
                gap: '12px', alignItems: 'center', justifyContent: 'space-between'
              }}>
                <div style={{ flex: '1 1 80px', fontSize: '22px', fontWeight: 900, color: 'var(--text-primary)', lineHeight: 1 }}>
                  #{String(q.token_number).padStart(3, '0')}
                </div>

                <div style={{ flex: '2 1 140px', fontSize: '15px', fontWeight: 700, color: 'var(--primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {q.user_name || 'Guest'}
                </div>

                <div style={{ flex: '1 1 100px', fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Users size={16} /> {q.party_size}
                </div>

                <div style={{ flex: '1 1 100px', fontSize: '14px', color: 'var(--text-secondary)', fontWeight: 600, textAlign: 'right' }}>
                  {new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: 'numeric', hour12: true }).format(new Date(q.created_at))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
