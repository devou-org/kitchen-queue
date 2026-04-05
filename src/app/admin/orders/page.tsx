'use client';
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Order } from '@/types';
import { formatPrice, formatDateTime } from '@/lib/format';
import { pusherClient } from '@/lib/pusher-client';

export default function AdminOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [modalLoading, setModalLoading] = useState(false);

  const fetchOrders = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const qs = new URLSearchParams({
        page: page.toString(),
        per_page: '100',
        sort: 'ASC'
      });
      if (statusFilter) {
        qs.append('status', statusFilter);
      } else {
        // Strictly only show PENDING items by default as requested
        qs.append('status_in', 'PENDING');
      }

      const ordersRes = await fetch(`/api/orders?${qs.toString()}`);
      const ordersData = await ordersRes.json();

      if (ordersData.success) {
        setOrders(ordersData.data);
      }
    } catch {
      toast.error('Failed to load orders');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, statusFilter]);

  useEffect(() => {
    if (!pusherClient) return;
    const channel = pusherClient.subscribe('queue-channel');

    channel.bind('new_order', (data: any) => {
      toast.success(`New order created: #${String(data.ticket_number).padStart(3, '0')}`);
      fetchOrders(true);
    });

    channel.bind('order_update', (data: any) => {
      // If order is updated to READY or PAID, it should be removed from the local state list if 
      // we are in the default view (no status filter)
      setOrders(prev => {
        const isDefaultView = !statusFilter;
        return prev.map(o => {
          if (o.id === data.order_id) {
            const updated = { ...o };
            if (data.new_status) updated.status = data.new_status;
            if (typeof data.is_paid === 'boolean') updated.is_paid = data.is_paid;
            return updated;
          }
          return o;
        }).filter(o => {
          if (isDefaultView) {
            return o.status === 'PENDING';
          }
          if (statusFilter) {
            return o.status === statusFilter;
          }
          return true;
        });
      });

      setSelectedOrder(prev => {
        if (prev && prev.id === data.order_id) {
          const updated = { ...prev };
          if (data.new_status) updated.status = data.new_status;
          if (typeof data.is_paid === 'boolean') updated.is_paid = data.is_paid;
          return updated;
        }
        return prev;
      });

      if (data.new_status) toast.success(`Order #${String(data.ticket_number).padStart(3, '0')} updated to ${data.new_status}`);
      // Refresh after a small delay to ensure DB sync if needed, though local state is updated
      setTimeout(() => fetchOrders(true), 500);
    });

    return () => {
      channel.unbind_all();
      channel.unsubscribe();
    };
  }, [statusFilter]); // Depend on statusFilter to correctly remove orders in pusher handler

  const handleStatusChange = async (id: string, newStatus: string) => {
    setModalLoading(true);
    try {
      const res = await fetch(`/api/orders/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      const data = await res.json();
      if (data.success) {
        // Success feedback handled by Pusher event to avoid duplicates
        // Update local state instantly for UI responsiveness
        setOrders(prev => {
          const isDefaultView = !statusFilter;
          return prev.map(o => o.id === id ? { ...o, status: newStatus as Order['status'] } : o)
            .filter(o => {
              if (isDefaultView) return o.status === 'PENDING';
              if (statusFilter) return o.status === statusFilter;
              return true;
            });
        });
        setSelectedOrder(prev => prev ? { ...prev, status: newStatus as Order['status'] } : null);

        // If it was removed from view, close modal
        if (!statusFilter && newStatus !== 'PENDING') {
          setTimeout(closeModal, 500);
        }
      } else {
        toast.error(data.error || 'Failed to update');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setModalLoading(false);
    }
  };

  const activeStatuses = ['READY', 'PAID', 'CANCELLED']; // Exclude PENDING as it's the default
  const allStatuses = ['PENDING', 'READY', 'PAID', 'CANCELLED'];

  const openOrderModal = (order: Order) => setSelectedOrder(order);
  const closeModal = () => setSelectedOrder(null);

  return (
    <div className="page-content-admin animate-fade-in" style={{ padding: '32px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 800 }}>Active Order Queue</h1>
        <p style={{ color: 'var(--text-secondary)' }}>Live fulfillment for PENDING orders. (READY orders are moved to pickup)</p>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '20px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'flex-end' }}>
            <div style={{ flex: 1, minWidth: '200px' }}>
              <label style={{ display: 'block', fontSize: '10px', fontWeight: 800, marginBottom: '6px', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Filter Status</label>
              <select
                className="input"
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                style={{ height: '42px' }}
              >
                <option value="">PENDING</option>
                {activeStatuses.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
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
                  <th>Ticket</th>
                  <th>Customer</th>
                  <th>Subtotal</th>
                  <th>Paid</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {orders.map(order => (
                  <tr key={order.id} onClick={() => openOrderModal(order)} style={{ cursor: 'pointer' }}>
                    <td>
                      <strong style={{ color: 'var(--primary)', fontSize: '16px' }}>#{String(order.ticket_number).padStart(3, '0')}</strong>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{formatDateTime(order.created_at)}</div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{order.customer_name}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{order.phone}</div>
                    </td>
                    <td style={{ fontWeight: 600 }}>{formatPrice(order.total_price)}</td>
                    <td>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: '4px',
                        fontSize: '12px', fontWeight: 700,
                        color: order.is_paid ? '#059669' : 'var(--warning)',
                        background: order.is_paid ? 'rgba(5,150,105,0.1)' : 'rgba(255,165,0,0.1)',
                        padding: '3px 10px', borderRadius: 'var(--radius-full)',
                      }}>
                        {order.is_paid ? '✓ PAID' : '⏳ PENDING'}
                      </span>
                    </td>
                    <td><span className={`badge badge-${order.status.toLowerCase()}`}>{order.status}</span></td>
                    <td><button className="btn btn-ghost btn-sm" style={{ color: 'var(--primary)' }}>View →</button></td>
                  </tr>
                ))}
                {orders.length === 0 && (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: '60px', color: 'var(--text-secondary)' }}>No active orders found</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>{orders.length} orders found</span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-secondary btn-sm" disabled={page === 1} onClick={() => setPage(p => Math.max(1, p - 1))}>← Prev</button>
            <button className="btn btn-secondary btn-sm" disabled={orders.length < 100} onClick={() => setPage(p => p + 1)}>Next →</button>
          </div>
        </div>
      </div>

      {selectedOrder && (
        <div className="modal-backdrop" onClick={closeModal} style={{ alignItems: 'center' }}>
          <div className="modal-desktop" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                  <h2 style={{ fontSize: '24px', fontWeight: 900, color: 'var(--primary)' }}>#{String(selectedOrder.ticket_number).padStart(3, '0')}</h2>
                  <span className={`badge badge-${selectedOrder.status.toLowerCase()}`}>{selectedOrder.status}</span>
                </div>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{formatDateTime(selectedOrder.created_at)}</p>
              </div>
              <button onClick={closeModal} className="modal-close-btn">✕</button>
            </div>

            <div className="card" style={{ background: '#F9FAFB', padding: '14px 16px', marginBottom: '20px', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <div><p className="label">CUSTOMER</p><p style={{ fontWeight: 700 }}>{selectedOrder.customer_name}</p></div>
                <div style={{ textAlign: 'right' }}><p className="label">PHONE</p><p style={{ fontWeight: 600 }}>{selectedOrder.phone}</p></div>
              </div>
              {(selectedOrder.party_size || 1) > 1 && <p style={{ fontSize: '13px', color: 'var(--info)', fontWeight: 600 }}>👥 Party of {selectedOrder.party_size}</p>}
              {selectedOrder.notes && <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '6px', fontStyle: 'italic' }}>📝 {selectedOrder.notes}</p>}
            </div>

            <div style={{ marginBottom: '20px' }}>
              <p className="label">ORDER ITEMS</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {(selectedOrder.items || []).map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'white', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span className="qty-badge">{item.quantity}</span>
                      <span style={{ fontWeight: 600, fontSize: '14px' }}>{item.product_name}</span>
                    </div>
                    <span style={{ fontWeight: 700, fontSize: '14px' }}>{formatPrice(item.price_at_purchase * item.quantity)}</span>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', marginTop: '8px', borderTop: '2px dashed var(--border)', fontWeight: 800, fontSize: '18px' }}>
                <span>Total</span><span style={{ color: 'var(--primary)' }}>{formatPrice(selectedOrder.total_price)}</span>
              </div>
            </div>

            <div style={{ background: '#F9FAFB', padding: '16px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
              <div>
                <p style={{ fontWeight: 700, fontSize: '14px', marginBottom: '8px' }}>Order Status</p>
                <select className="select" style={{ width: '100%' }} value={selectedOrder.status} disabled={modalLoading} onChange={(e) => handleStatusChange(selectedOrder.id, e.target.value)}>
                  {allStatuses.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}