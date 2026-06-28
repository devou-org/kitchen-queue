'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import { pusherClient } from '@/lib/pusher-client';
import { useRestaurant } from '@/hooks/useRestaurant';
import { Users } from 'lucide-react';

export default function AdminQueueManager({ restaurantId }: { restaurantId: string }) {
  const [queues, setQueues] = useState<any[]>([]);
  const [allStatuses, setAllStatuses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const { restaurant } = useRestaurant();
  
  const fetchQueues = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch(`/api/admin/queue?restaurantId=${restaurantId}`);
      const data = await res.json();
      if (data.success) {
        setQueues(data.data);
      }
    } catch (err) {
      toast.error('Error loading queues');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [restaurantId]);

  const fetchStatuses = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/queue/status?restaurantId=${restaurantId}`);
      const data = await res.json();
      if (data.success && data.data.length > 0) {
        setAllStatuses(data.data);
        setStatusFilter(prev => prev ? prev : data.data[0].possible_queue_status);
      }
    } catch (err) {}
  }, [restaurantId]);

  useEffect(() => {
    fetchQueues();
    fetchStatuses();
  }, [fetchQueues, fetchStatuses]);

  useEffect(() => {
    if (!pusherClient || !restaurant) return;
    const channelName = restaurant.pusher_channel;
    const channel = pusherClient.subscribe(channelName);

    channel.bind('queue_updated', (data: any) => {
      const { type, queue } = data;
      if (type === 'JOIN') {
        toast.success(`New waitlist entry: #${queue.token_number}`);
        fetchQueues(true);
      } else if (type === 'UPDATE') {
        setQueues(prev => prev.map(q => q.id === queue.id ? { ...q, queue_status_id: queue.queue_status_id, queue_status: queue.queue_status || q.queue_status } : q));
        fetchQueues(true); // Fetch to get the proper status name if not provided
      }
    });

    return () => {
      channel.unbind('queue_updated');
      channel.unsubscribe();
    };
  }, [restaurant, fetchQueues]);

  const handleUpdateStatus = async (queueId: string, status: string) => {
    try {
       const res = await fetch(`/api/admin/queue/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ queueId, statusEnum: status, restaurantId })
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Status updated to ${status}`);
        fetchQueues(true);
      } else {
        toast.error(data.error || 'Failed to update status');
      }
    } catch (err) {
      toast.error('Error updating status');
    }
  };

  const displayedQueues = queues.filter(q => {
    // If only queue management is active, show WALK_IN. If online ordering is active, show ORDER.
    const targetQueueType = (restaurant?.modules?.ONLINE_ORDERING === false) ? 'WALK_IN' : 'ORDER';
    if (q.queue_type !== targetQueueType) return false;

    if (statusFilter && q.queue_status !== statusFilter) return false;
    if (!statusFilter && ['CANCELLED'].includes(q.queue_status)) return false; // Default to active (not cancelled)
    
    if (search) {
      const term = search.toLowerCase();
      return (q.user_name || '').toLowerCase().includes(term) || 
             (q.user_phone || '').toLowerCase().includes(term) || 
             String(q.token_number).includes(term);
    }
    return true;
  });

  return (
    <div className="page-content-admin animate-fade-in" style={{ padding: '32px' }}>
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 800 }}>Queue Management</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Live waitlist for your restaurant.</p>
        </div>
        <button 
          onClick={() => window.open(`/${restaurant?.slug || restaurantId}/queue-board`, '_blank')}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px',
            padding: '10px 16px', background: 'var(--primary)', color: 'white',
            borderRadius: '8px', fontWeight: 700, fontSize: '13px',
            border: 'none', cursor: 'pointer', textDecoration: 'none',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
            <polyline points="15 3 21 3 21 9"></polyline>
            <line x1="10" y1="14" x2="21" y2="3"></line>
          </svg>
          Open Public Screen
        </button>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '20px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'flex-end' }}>
            <div style={{ flex: 1, minWidth: '200px' }}>
              <label style={{ display: 'block', fontSize: '10px', fontWeight: 800, marginBottom: '6px', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Filter Status</label>
              <select
                className="select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{ height: '42px' }}
              >
                <option value="" disabled>Select Status</option>
                {allStatuses.map(s => <option key={s.id} value={s.possible_queue_status}>{s.possible_queue_status}</option>)}
              </select>
            </div>
            <div style={{ flex: 1, minWidth: '220px' }}>
              <label style={{ display: 'block', fontSize: '10px', fontWeight: 800, marginBottom: '6px', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Search Waitlist</label>
              <input
                type="text"
                className="input"
                placeholder="Search token, name, phone"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ height: '42px' }}
              />
            </div>
          </div>
        </div>

        <div className="table-wrapper" style={{ border: 'none', borderRadius: 0, overflowX: 'auto', minHeight: '400px' }}>
          {loading ? (
            <div style={{ padding: '60px', display: 'flex', justifyContent: 'center' }}><div className="loader" /></div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Token</th>
                  <th>Name & Phone</th>
                  <th>Party Size</th>
                  <th>Time Joined</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayedQueues.map((q) => (
                  <tr key={q.id}>
                    <td>
                      <strong style={{ fontWeight: 600, display: 'block' }}>#{String(q.token_number).padStart(3, '0')}</strong>
                    </td>
                    <td>
                      <div>
                        <strong style={{ fontWeight: 600, display: 'block' }}>{q.user_name || 'Guest'}</strong>
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {q.user_phone || 'No phone'}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontWeight: 700, fontSize: '15px' }}>{q.party_size}</span>
                        <span style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}><Users size={16} /></span>
                      </div>
                    </td>
                    <td style={{ fontWeight: 600 }}>
                      {new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: 'numeric', hour12: true }).format(new Date(q.created_at))}
                    </td>
                    <td>
                      <span className={`badge ${q.queue_status === 'WAITING' ? 'badge-pending' : q.queue_status === 'SEATED' ? 'badge-ready' : 'badge-paid'}`} style={{ margin: 0 }}>
                        {q.queue_status}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                        <select 
                          className="input" 
                          style={{ height: '32px', padding: '0 28px 0 12px', fontSize: '13px', minWidth: '130px', borderRadius: '6px' }}
                          value={q.queue_status}
                          onChange={(e) => handleUpdateStatus(q.id, e.target.value)}
                        >
                          {allStatuses.map(s => <option key={s.id} value={s.possible_queue_status}>{s.possible_queue_status}</option>)}
                        </select>
                      </div>
                    </td>
                  </tr>
                ))}
                {displayedQueues.length === 0 && (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: '60px', color: 'var(--text-secondary)' }}>No entries match your filters.</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
