'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Order } from '@/types';
import { formatPrice } from '@/lib/format';

import { pusherClient } from '@/lib/pusher-client';
import { useRestaurant } from '@/hooks/useRestaurant';
import { orderService } from '@/app/services/orders.api';

import { useParams, useRouter } from 'next/navigation';

export default function OrderStatusPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLive, setIsLive] = useState(false);
  const { slug } = useParams();
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

  const fetchOrders = async (pageNum = 1, silent = false) => {
    try {
      const userStr = localStorage.getItem('user');
      if (!userStr) { 
        if (restaurant?.id) {
          const queueTicket = localStorage.getItem(`queue_ticket_${restaurant.id}`);
          if (queueTicket) {
            try {
              const parsed = JSON.parse(queueTicket);
              if (parsed.tokenNumber && parsed.expiresAt > Date.now()) {
                router.replace(`/${slug}/order-status/${parsed.tokenNumber}`);
                return;
              }
            } catch (e) {}
          }
        }
        if (!silent) setLoading(false); 
        return; 
      }
      const user = JSON.parse(userStr);
      const res = await orderService.getHistory(user.phone, pageNum, 20);
      
      if (res.success && res.data) {
        if (pageNum === 1) {
          setOrders(res.data);
        } else {
          setOrders(prev => {
            const existingIds = new Set(prev.map(o => o.id));
            const newOrders = res.data!.filter(o => !existingIds.has(o.id));
            return [...prev, ...newOrders];
          });
        }
        // @ts-ignore - totalPages added to api response
        setTotalPages(res.totalPages || 1);
        setPage(pageNum);
      } else if (!silent && pageNum === 1) {
        setOrders([]);
      }
    } catch (err) {
      console.error('Failed to fetch orders:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders(1);
    if (!pusherClient || !restaurant) return;
    const channelName = restaurant.pusher_channel;
    const channel = pusherClient.subscribe(channelName);
    setIsLive(true);
    channel.bind('order_update', () => fetchOrders(1, true));
    channel.bind('new_order', () => fetchOrders(1, true));
    channel.bind('pusher:subscription_succeeded', () => setIsLive(true));
    channel.bind('pusher:subscription_error', () => setIsLive(false));
    return () => { channel.unbind_all(); channel.unsubscribe(); };
  }, [restaurant]);

  const Header = () => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', background: 'white', borderBottom: '1px solid rgba(0,0,0,0.05)', position: 'sticky', top: 0, zIndex: 10 }}>
      {restaurant?.primary_color && (
        <style dangerouslySetInnerHTML={{ __html: `
          :root {
            --primary: ${restaurant.primary_color};
            --primary-dark: ${restaurant.primary_color};
          }
        `}} />
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <Link href={`/${slug}/menu`} style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '10px', color: 'inherit' }}>
          {restaurant?.logo_url ? (
            <img src={restaurant.logo_url} alt={restaurant.name || 'Logo'} style={{ width: '30px', height: '30px', borderRadius: '6px', objectFit: 'cover' }} />
          ) : (
            <div style={{
              width: '30px', height: '30px', borderRadius: '6px',
              backgroundColor: restaurant?.primary_color || 'var(--primary)',
              color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 800, fontSize: '13px'
            }}>
              {restaurant?.name ? restaurant.name.charAt(0).toUpperCase() : '🌿'}
            </div>
          )}
          <span style={{ fontWeight: 800, fontSize: '16px' }}>{restaurant?.name || 'Loading...'}</span>
        </Link>
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
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '16px', background: 'var(--bg-gradient)' }}>
        <div className="loader" style={{ width: 44, height: 44, borderWidth: 4 }} />
        <p style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Loading your orders...</p>
      </div>
    );
  }

  // Group orders by date
  const groupOrdersByDate = () => {
    const groups: Record<string, Order[]> = {};
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
    const yesterdayDate = new Date();
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(yesterdayDate);

    orders.forEach(order => {
      const orderDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(order.created_at));
      
      let label = orderDate;
      if (orderDate === today) label = 'Today';
      else if (orderDate === yesterday) label = 'Yesterday';
      else {
        label = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(orderDate));
      }

      if (!groups[label]) groups[label] = [];
      groups[label].push(order);
    });

    return groups;
  };

  const groupedOrders = groupOrdersByDate();

  return (
    <div style={{ background: 'var(--bg-gradient)', minHeight: '100vh', paddingBottom: '100px' }}>
      <Header />

      <div style={{ maxWidth: '480px', margin: '0 auto', padding: '20px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
          <div>
            <h2 style={{ fontSize: '22px', fontWeight: 900, lineHeight: 1 }}>My Orders</h2>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>Updates in real-time — no need to refresh</p>
          </div>
          <span style={{
            background: 'var(--primary)', color: 'white',
            fontSize: '13px', fontWeight: 800,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            minWidth: '28px', height: '28px', borderRadius: '50%',
          }}>
            {orders.length}
          </span>
        </div>

        {orders.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 24px', textAlign: 'center' }}>
            <div style={{ width: '100px', height: '100px', borderRadius: '50%', background: 'rgba(151,19,69,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '48px', marginBottom: '24px' }}>
              🍽️
            </div>
            <h2 style={{ fontWeight: 800, fontSize: '22px', marginBottom: '8px' }}>No Orders Found</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '32px', maxWidth: '260px', lineHeight: 1.6 }}>
              You haven't placed any orders yet.
            </p>
            <Link prefetch={false} href={`/${slug}/menu`} className="btn btn-primary btn-lg" style={{ width: '100%', maxWidth: '280px' }}>
              Browse Menu →
            </Link>
          </div>
        ) : (
          Object.entries(groupedOrders).map(([dateLabel, dateOrders]) => (
            <div key={dateLabel} style={{ marginBottom: '24px' }}>
              <div style={{
                position: 'sticky', top: '58px', zIndex: 5,
                background: 'var(--bg-gradient)', padding: '8px 0',
                marginBottom: '12px'
              }}>
                <h3 style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {dateLabel}
                </h3>
              </div>
              
              {dateOrders.map(order => (
                <Link prefetch={false} key={order.id} href={`/${slug}/order-status/${order.id}`} style={{
                  display: 'flex', flexDirection: 'column',
                  background: 'white',
                  border: '1px solid rgba(0,0,0,0.05)',
                  borderRadius: '12px',
                  overflow: 'hidden',
                  marginBottom: '12px',
                  boxShadow: '0 2px 10px rgba(0,0,0,0.02)',
                  textDecoration: 'none',
                  color: 'inherit',
                  padding: '16px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                    <div>
                      <p style={{ fontWeight: 800, fontSize: '16px' }}>Ticket #{String(order.ticket_number).padStart(3, '0')}</p>
                      <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                        {new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: 'numeric', hour12: true }).format(new Date(order.created_at))}
                      </p>
                    </div>
                    <span style={{ 
                      fontSize: '11px', fontWeight: 800, padding: '4px 8px', borderRadius: '4px', letterSpacing: '0.05em',
                      backgroundColor: order.status === 'READY' ? '#ecfdf5' : order.status === 'PENDING' ? '#fffbeb' : '#f8fafc',
                      color: order.status === 'READY' ? '#059669' : order.status === 'PENDING' ? '#d97706' : 'var(--text-secondary)',
                      border: '1px solid',
                      borderColor: order.status === 'READY' ? '#a7f3d0' : order.status === 'PENDING' ? '#fde68a' : 'rgba(0,0,0,0.05)',
                    }}>
                      {order.status}
                    </span>
                  </div>
                  
                  {order.total_price != null && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                        {/* @ts-ignore */}
                        {order.item_count || order.items?.length || 0} item{((order.item_count || order.items?.length || 0) !== 1) ? 's' : ''}
                      </p>
                      <p style={{ fontWeight: 800, color: 'var(--primary)', fontSize: '15px' }}>
                        {formatPrice(order.total_price)}
                      </p>
                    </div>
                  )}
                </Link>
              ))}
            </div>
          ))
        )}

        {page < totalPages && (
          <button 
            onClick={() => fetchOrders(page + 1)}
            style={{
              width: '100%',
              padding: '14px',
              background: 'white',
              border: '1px solid var(--border)',
              borderRadius: '12px',
              color: 'var(--text-primary)',
              fontWeight: 800,
              fontSize: '14px',
              cursor: 'pointer',
              marginTop: '8px',
              boxShadow: '0 2px 5px rgba(0,0,0,0.02)'
            }}
          >
            Load Older Orders
          </button>
        )}
      </div>
    </div>
  );
}