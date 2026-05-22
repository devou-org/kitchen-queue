'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useRestaurant } from '@/hooks/useRestaurant';
import { pusherClient } from '@/lib/pusher-client';
import BottomNav from '@/components/BottomNav';

export default function QueueTicketPage() {
  const params = useParams();
  const slug = params?.slug as string;
  const tokenNumber = params?.tokenNumber as string;
  const router = useRouter();

  const { restaurant, loading: restaurantLoading } = useRestaurant();
  const [ticket, setTicket] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchTicket = useCallback(async (silent = false) => {
    if (!restaurant) return;
    if (!silent) setLoading(true);
    try {
      const res = await fetch(`/api/queue/ticket?restaurantId=${restaurant.id}&tokenNumber=${tokenNumber}`);
      const data = await res.json();
      if (data.success) {
        setTicket(data.data);
      } else {
        setError(data.error || 'Ticket not found');
      }
    } catch (err) {
      setError('Error fetching ticket');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [restaurant, tokenNumber]);

  useEffect(() => {
    fetchTicket();
  }, [fetchTicket]);

  useEffect(() => {
    if (!pusherClient || !restaurant || !ticket) return;
    const channelName = restaurant.pusher_channel;
    const channel = pusherClient.subscribe(channelName);

    channel.bind('queue_updated', (data: any) => {
      const { type, queue } = data;
      // If our ticket is updated, or someone else's ticket is updated (which might change our position)
      if (type === 'UPDATE' && queue.id === ticket.id) {
        fetchTicket(true); 
      } else if (type === 'UPDATE' || type === 'JOIN') {
        // Just fetch silently to update position in line if anything in the queue changes
        fetchTicket(true);
      }
    });

    return () => {
      channel.unbind('queue_updated');
      channel.unsubscribe();
    };
  }, [restaurant, ticket, fetchTicket]);

  if (restaurantLoading || loading) {
    return (
      <div style={{ background: '#f8fafc', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p>Loading Ticket...</p>
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div style={{ background: '#f8fafc', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <h2 className="text-xl font-bold text-gray-700">{error || 'Ticket not found'}</h2>
        <button onClick={() => router.push(`/${slug}/queue`)} className="mt-4 text-indigo-600 underline">Join Queue Instead</button>
      </div>
    );
  }

  return (
    <div style={{ background: 'var(--bg, #f8fafc)', minHeight: '100vh' }}>
      {restaurant?.primary_color && (
        <style dangerouslySetInnerHTML={{ __html: `
          :root {
            --primary: ${restaurant.primary_color};
            --primary-dark: ${restaurant.primary_color};
          }
        `}} />
      )}
      
      {/* Header */}
      <div className="page-header" style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        padding: '12px 16px', borderBottom: '1px solid #e2e8f0',
        backgroundColor: '#ffffff', height: '57px', boxSizing: 'border-box'
      }}>
        <button onClick={() => router.push(`/${slug}/queue`)} style={{ background: 'none', border: 'none', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', padding: 0 }}>
          <span style={{ fontWeight: 800, fontSize: '18px', color: 'var(--text-primary, #0f172a)' }}>
            ← Back
          </span>
        </button>
      </div>

      <div style={{ padding: '24px 16px', maxWidth: '480px', margin: '0 auto', paddingBottom: '100px' }}>
        <div style={{
          padding: '40px 32px',
          backgroundColor: '#ffffff',
          borderRadius: '24px',
          boxShadow: '0 20px 40px -15px rgba(0,0,0,0.08)',
          border: '1px solid #f1f5f9',
          textAlign: 'center',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '8px', backgroundColor: 'var(--primary)' }} />
          
          <h2 style={{ fontSize: '32px', fontWeight: 900, color: '#0f172a', marginBottom: '8px', letterSpacing: '-0.03em' }}>Live Ticket</h2>
          
          <div style={{ marginBottom: '24px' }}>
             <span className={`badge ${ticket.queue_status === 'WAITING' ? 'badge-pending' : ticket.queue_status === 'SEATED' ? 'badge-ready' : 'badge-paid'}`} style={{ fontSize: '14px', padding: '6px 12px' }}>
                {ticket.queue_status || 'WAITING'}
             </span>
          </div>

          <p style={{ color: '#64748b', fontWeight: 600, fontSize: '15px', marginBottom: '8px' }}>Your token number is</p>
          <div style={{ fontSize: '80px', fontWeight: 900, color: 'var(--primary)', lineHeight: 1, marginBottom: '32px', letterSpacing: '-0.04em' }}>
            #{ticket.token_number}
          </div>
          
          <div style={{ backgroundColor: '#f8fafc', borderRadius: '16px', padding: '20px', border: '1px solid #f1f5f9', marginBottom: '24px' }}>
            <p style={{ color: '#64748b', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>Current Position</p>
            <p style={{ fontSize: '32px', fontWeight: 900, color: '#0f172a' }}>{ticket.position || 1}</p>
          </div>

          <div style={{ textAlign: 'left', marginTop: '32px', paddingTop: '24px', borderTop: '1px dashed #cbd5e1' }}>
             <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                <span style={{ color: '#64748b', fontWeight: 600, fontSize: '14px' }}>Name</span>
                <span style={{ color: '#0f172a', fontWeight: 800, fontSize: '14px' }}>{ticket.user_name}</span>
             </div>
             <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                <span style={{ color: '#64748b', fontWeight: 600, fontSize: '14px' }}>Party Size</span>
                <span style={{ color: '#0f172a', fontWeight: 800, fontSize: '14px' }}>👤 {ticket.party_size}</span>
             </div>
             <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                <span style={{ color: '#64748b', fontWeight: 600, fontSize: '14px' }}>Joined</span>
                <span style={{ color: '#0f172a', fontWeight: 800, fontSize: '14px' }}>{new Date(ticket.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
             </div>
          </div>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
