'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import { pusherClient } from '@/lib/pusher-client';
import { useRestaurant } from '@/hooks/useRestaurant';

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
      if (data.success) {
        setAllStatuses(data.data);
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
    if (statusFilter && q.queue_status !== statusFilter) return false;
    if (!statusFilter && !['WAITING'].includes(q.queue_status)) return false; // Default to active waitlist
    
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
                <option value="">WAITING (Active)</option>
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
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayedQueues.map((q) => (
                  <tr key={q.id}>
                    <td style={{ fontWeight: 800, color: 'var(--primary)', fontSize: '16px' }}>#{String(q.token_number).padStart(3, '0')}</td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{q.user_name}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{q.user_phone}</div>
                    </td>
                    <td>
                      <span style={{
                        fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)',
                        background: 'rgba(0,0,0,0.05)', padding: '4px 10px', borderRadius: '4px'
                      }}>
                        👤 {q.party_size} Party
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${q.queue_status === 'WAITING' ? 'badge-pending' : q.queue_status === 'SEATED' ? 'badge-ready' : 'badge-paid'}`}>
                        {q.queue_status}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', alignItems: 'center' }}>
                        <select 
                          className="input" 
                          style={{ height: '32px', padding: '0 8px', fontSize: '12px', minWidth: '120px' }}
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
                  <tr><td colSpan={5} style={{ textAlign: 'center', padding: '60px', color: 'var(--text-secondary)' }}>No entries match your filters.</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
