'use client';
import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Order } from '@/types';
import { formatPrice, formatDateTime } from '@/lib/format';
import { pusherClient } from '@/lib/pusher-client';

export default function AdminOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [readySearch, setReadySearch] = useState('');
  const [page, setPage] = useState(1);
  const [mounted, setMounted] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [tempTableNumber, setTempTableNumber] = useState('');
  // Controls the green row-blink animation (auto-clears after 2.6s)
  const [flashedOrderIds, setFlashedOrderIds] = useState<Set<string>>(new Set());
  // Controls the persistent green ticket number (clears only when admin opens the modal)
  const [greenTicketIds, setGreenTicketIds] = useState<Set<string>>(new Set());

  const fetchOrders = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const today = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD in local time
      const qs = new URLSearchParams({
        page: page.toString(),
        per_page: '100',
        sort: 'ASC',
        date_from: today,
        date_to: today
      });
      if (statusFilter) {
        qs.append('status', statusFilter);
      } else {
        // Default to showing only PENDING items
        qs.append('status', 'PENDING');
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
  }, [page, statusFilter]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!pusherClient) return;
    const channel = pusherClient.subscribe('queue-channel');

    channel.bind('new_order', (data: any) => {
      toast.success(`New order created: #${String(data.ticket_number).padStart(3, '0')}`);
      fetchOrders(true);
    });

    channel.bind('order_update', (data: any) => {
      if (data.items_updated) {
        // Customer added items — re-fetch list
        fetchOrders(true);

        // Also refresh the open modal if it's showing this order
        const adminToken = document.cookie
          .split(';').map(c => c.trim())
          .find(c => c.startsWith('admin_token='))?.split('=')[1];

        fetch(`/api/orders/${data.order_id}`, {
          headers: adminToken ? { Authorization: `Bearer ${adminToken}` } : {},
        })
          .then(r => r.json())
          .then(res => {
            if (res.success && res.data) {
              setSelectedOrder(prev => prev && prev.id === data.order_id ? res.data : prev);
            }
          })
          .catch(() => { });

        // Flash the row green only when the admin is on a filter where item-updated
        // orders are visible (PENDING or PREPARING). Customers can only add items to
        // those statuses — so flashing on READY/PAID/CANCELLED would be a false positive.
        const isAddableFilter = statusFilter === '' || statusFilter === 'PREPARING';
        if (isAddableFilter) {
          setFlashedOrderIds(prev => { const next = new Set(prev); next.add(data.order_id); return next; });
          setTimeout(() => {
            setFlashedOrderIds(prev => { const next = new Set(prev); next.delete(data.order_id); return next; });
          }, 2600);

          // Keep ticket number green until admin acknowledges (opens the modal)
          setGreenTicketIds(prev => { const next = new Set(prev); next.add(data.order_id); return next; });
        }

        toast(
          `🛒 Customer added items to order #${String(data.ticket_number).padStart(3, '0')}`,
          { icon: '🟢', duration: 5000, style: { fontWeight: 700 } }
        );
        return;
      }

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
          if (statusFilter) return o.status === statusFilter;
          return o.status === 'PENDING';
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
    });

    return () => {
      channel.unbind_all();
      channel.unsubscribe();
    };
  }, [fetchOrders, statusFilter]); // fetchOrders is stable via useCallback — no stale closure

  const handleStatusChange = async (id: string, newStatus: string, tableNumber?: string) => {
    setModalLoading(true);
    try {
      const res = await fetch(`/api/orders/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: newStatus,
          table_number: tableNumber
        })
      });
      const data = await res.json();
      if (data.success) {
        // Success feedback handled by Pusher event to avoid duplicates
        // Update local state instantly for UI responsiveness
        setOrders(prev => {
          const isDefaultView = !statusFilter;
          return prev.map(o => o.id === id ? { ...o, status: newStatus as Order['status'], table_number: tableNumber ?? o.table_number } : o)
            .filter(o => {
              if (statusFilter) return o.status === statusFilter;
              return o.status === 'PENDING';
            });
        });
        setSelectedOrder(prev => prev ? { ...prev, status: newStatus as Order['status'], table_number: tableNumber ?? prev.table_number } : null);

        // Always close modal after successful update to streamline workflow
        setTimeout(closeModal, 400);
      } else {
        toast.error(data.error || 'Failed to update');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setModalLoading(false);
    }
  };

  const activeStatuses = ['PREPARING', 'READY', 'PAID', 'CANCELLED']; // Exclude PENDING as it's the default
  const allStatuses = ['PENDING', 'PREPARING', 'READY', 'PAID', 'CANCELLED'];

  const readySearchTerm = readySearch.trim().toLowerCase();
  const displayedOrders = statusFilter === 'READY' && readySearchTerm
    ? orders.filter(order => {
      const ticket = String(order.ticket_number).padStart(3, '0').toLowerCase();
      const customer = (order.customer_name || '').toLowerCase();
      const phone = (order.phone || '').toLowerCase();
      const table = (order.table_number || '').toLowerCase();
      return ticket.includes(readySearchTerm)
        || customer.includes(readySearchTerm)
        || phone.includes(readySearchTerm)
        || table.includes(readySearchTerm);
    })
    : orders;

  const openOrderModal = (order: Order) => {
    setSelectedOrder(order);
    setTempTableNumber(order.table_number || '');
    // Acknowledge: clear the green ticket highlight for this order
    setGreenTicketIds(prev => { const next = new Set(prev); next.delete(order.id); return next; });
  };
  const closeModal = () => {
    setSelectedOrder(null);
    setTempTableNumber('');
  };

  return (
    <div className="page-content-admin animate-fade-in" style={{ padding: '32px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 800 }}>Active Order Queue</h1>
        <p style={{ color: 'var(--text-secondary)' }}>Live fulfillment for PENDING & PREPARING orders. (READY orders are moved to pickup)</p>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '20px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'flex-end' }}>
            <div style={{ flex: 1, minWidth: '200px' }}>
              <label style={{ display: 'block', fontSize: '10px', fontWeight: 800, marginBottom: '6px', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Filter Status</label>
              <select
                className="input"
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setReadySearch('');
                  setPage(1);
                }}
                style={{ height: '42px' }}
              >
                <option value="">PENDING</option>
                {activeStatuses.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            {statusFilter === 'READY' && (
              <div style={{ flex: 1, minWidth: '220px' }}>
                <label style={{ display: 'block', fontSize: '10px', fontWeight: 800, marginBottom: '6px', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Search Ready Orders</label>
                <input
                  type="text"
                  className="input"
                  placeholder="Search ticket, customer, phone, table"
                  value={readySearch}
                  onChange={(e) => setReadySearch(e.target.value)}
                  style={{ height: '42px' }}
                />
              </div>
            )}
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
                  <th>Persons</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {displayedOrders.map(order => (
                  <tr
                    key={order.id}
                    onClick={() => openOrderModal(order)}
                    style={{ cursor: 'pointer' }}
                    className={flashedOrderIds.has(order.id) ? 'row-items-updated' : ''}
                  >
                    <td>
                      <strong style={{
                        color: greenTicketIds.has(order.id) ? '#16a34a' : 'var(--primary)',
                        fontSize: '16px',
                        transition: 'color 0.4s ease',
                      }}>#{String(order.ticket_number).padStart(3, '0')}</strong>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{formatDateTime(order.created_at)}</div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{order.customer_name}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{order.phone}</div>
                      {order.table_number && (
                        <div style={{
                          fontSize: '11px',
                          color: 'white',
                          background: 'var(--primary)',
                          display: 'inline-block',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          marginTop: '4px',
                          fontWeight: 700
                        }}>
                          🪑 TABLE {order.table_number}
                        </div>
                      )}
                    </td>
                    <td style={{ fontWeight: 600 }}>{formatPrice(order.total_price)}</td>
                    <td>
                      <span style={{
                        fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)',
                        background: 'rgba(0,0,0,0.05)', padding: '4px 10px', borderRadius: '4px'
                      }}>
                        👤 {order.party_size || 1} Party
                      </span>
                    </td>
                    <td><span className={`badge badge-${order.status.toLowerCase()}`}>{order.status}</span></td>
                    <td><button className="btn btn-ghost btn-sm" style={{ color: 'var(--primary)' }}>View / Edit →</button></td>
                  </tr>
                ))}
                {displayedOrders.length === 0 && (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: '60px', color: 'var(--text-secondary)' }}>No active orders found</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>{displayedOrders.length} orders found</span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-secondary btn-sm" disabled={page === 1} onClick={() => setPage(p => Math.max(1, p - 1))}>← Prev</button>
            <button className="btn btn-secondary btn-sm" disabled={orders.length < 100} onClick={() => setPage(p => p + 1)}>Next →</button>
          </div>
        </div>
      </div>

      {mounted && selectedOrder && createPortal(
        <div className="modal-backdrop" onClick={closeModal} style={{ alignItems: 'center' }}>
          <div className="modal-desktop" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', marginBottom: '16px' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                  <h2 style={{ fontSize: '24px', fontWeight: 900, color: 'var(--primary)' }}>#{String(selectedOrder.ticket_number).padStart(3, '0')}</h2>
                  <span className={`badge badge-${selectedOrder.status.toLowerCase()}`}>{selectedOrder.status}</span>
                  {selectedOrder.table_number && (
                    <span style={{
                      fontSize: '12px',
                      fontWeight: 800,
                      color: 'white',
                      background: 'var(--primary)',
                      padding: '4px 8px',
                      borderRadius: 'var(--radius-sm)'
                    }}>
                      🪑 TABLE {selectedOrder.table_number}
                    </span>
                  )}
                </div>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{formatDateTime(selectedOrder.created_at)}</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                <Link
                  href={`/admin/orders/${selectedOrder.id}/edit`}
                  className="btn btn-secondary btn-sm"
                  onClick={closeModal}
                  style={{
                    minHeight: '30px',
                    padding: '0 14px',
                    fontSize: '10px',
                    fontWeight: 800,
                    letterSpacing: '0.02em'
                  }}
                >
                  EDIT ORDER
                </Link>
                <button onClick={closeModal} className="modal-close-btn">✕</button>
              </div>
            </div>

            <div className="card" style={{ background: '#F9FAFB', padding: '12px 16px', marginBottom: '16px', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <div><p className="label">CUSTOMER</p><p style={{ fontWeight: 700 }}>{selectedOrder.customer_name}</p></div>
                <div style={{ textAlign: 'right' }}><p className="label">PHONE</p><p style={{ fontWeight: 600 }}>{selectedOrder.phone}</p></div>
              </div>
              <p style={{ fontSize: '13px', color: 'var(--info)', fontWeight: 600 }}>👥 {selectedOrder.party_size || 1} Party</p>
              {selectedOrder.notes && <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '6px', fontStyle: 'italic' }}>📝 {selectedOrder.notes}</p>}
            </div>

            <div style={{ marginBottom: '16px' }}>
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

            <div style={{ background: '#F9FAFB', padding: '12px 16px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
              <div>
                <p style={{ fontWeight: 700, fontSize: '14px', marginBottom: '8px' }}>Order Status</p>
                <select
                  className="select"
                  style={{ width: '100%' }}
                  value={selectedOrder.status}
                  disabled={modalLoading}
                  onChange={(e) => handleStatusChange(selectedOrder.id, e.target.value, tempTableNumber)}
                >
                  {allStatuses.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              {(selectedOrder.status === 'PREPARING' || selectedOrder.status === 'PENDING') && (
                <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
                  <p style={{ fontWeight: 700, fontSize: '14px', marginBottom: '8px' }}>Assign Table Number</p>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      className="input"
                      placeholder="e.g. T-01, VIP-2"
                      value={tempTableNumber}
                      onChange={(e) => setTempTableNumber(e.target.value.toUpperCase())}
                      style={{ flex: 1, textTransform: 'uppercase' }}
                    />
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => {
                        const nextStatus = selectedOrder.status === 'PENDING' ? 'PREPARING' : selectedOrder.status;
                        handleStatusChange(selectedOrder.id, nextStatus, tempTableNumber);
                      }}
                      disabled={modalLoading || !tempTableNumber}
                    >
                      Update Table
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}