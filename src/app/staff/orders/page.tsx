'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Order } from '@/types';
import { formatPrice, formatDateTime } from '@/lib/format';
import { pusherClient } from '@/lib/pusher-client';
import { orderService } from '@/app/services/orders.api';

export default function StaffOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('PREPARING');
  const [page, setPage] = useState(1);
  const [mounted, setMounted] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [tempTableNumber, setTempTableNumber] = useState('');

  const fetchOrders = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
      
      const data = await orderService.getOrders({
        page,
        per_page: 100,
        sort: 'ASC',
        date_from: today,
        date_to: today,
        status: statusFilter
      });

      if (data.success && data.data) {
        setOrders(data.data);
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

  const fetchDebounceRef = useRef<NodeJS.Timeout | null>(null);

  const fetchOrdersDebounced = useCallback((silent = false) => {
    if (fetchDebounceRef.current) {
      clearTimeout(fetchDebounceRef.current);
    }
    fetchDebounceRef.current = setTimeout(() => {
      fetchOrders(silent);
      fetchDebounceRef.current = null;
    }, 400);
  }, [fetchOrders]);

  useEffect(() => {
    if (!pusherClient) return;
    const channel = pusherClient.subscribe('queue-channel');

    channel.bind('new_order', (data: any) => {
      fetchOrdersDebounced(true);
    });

    channel.bind('order_update', (data: any) => {
      setOrders(prev => {
        const orderIndex = prev.findIndex(o => o.id === data.order_id);
        if (orderIndex === -1) return prev;

        return prev.map(o => {
          if (o.id === data.order_id) {
            return {
              ...o,
              status: data.new_status || o.status,
              table_number: data.table_number || o.table_number,
              is_paid: typeof data.is_paid === 'boolean' ? data.is_paid : o.is_paid,
            };
          }
          return o;
        }).filter(o => {
          if (statusFilter !== 'ALL') {
             return o.status === statusFilter;
          }
          return true;
        });
      });

      if (data.order_id) {
        orderService.getOrderById(data.order_id).then(res => {
          if (res.success && res.data) {
            const updated: Order = res.data;
            setSelectedOrder(prev => (prev?.id === data.order_id) ? updated : prev);
          }
        }).catch(() => {});
      }
    });

    return () => {
      if (fetchDebounceRef.current) clearTimeout(fetchDebounceRef.current);
      channel.unbind_all();
      channel.unsubscribe();
    };
  }, [fetchOrdersDebounced, statusFilter]);

  const handleStatusChange = async (id: string, newStatus: string, tableNumber?: string) => {
    setModalLoading(true);
    try {
      const data = await orderService.updateOrder(id, {
        status: newStatus,
        table_number: tableNumber
      });
      if (data.success) {
        setOrders(prev => {
          return prev.map(o => o.id === id ? { ...o, status: newStatus as Order['status'], table_number: tableNumber ?? o.table_number } : o)
            .filter(o => {
              if (statusFilter) return o.status === statusFilter;
              return o.status === 'PREPARING';
            });
        });
        setSelectedOrder((prev): Order | null => prev ? { ...prev, status: newStatus as Order['status'], table_number: tableNumber ?? prev.table_number } : null);
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

  const allStatuses = ['PREPARING', 'READY', 'PAID', 'CANCELLED'];

  const openOrderModal = (order: Order) => {
    setSelectedOrder(order);
    setTempTableNumber(order.table_number || '');
  };
  const closeModal = () => {
    setSelectedOrder(null);
    setTempTableNumber('');
  };

  return (
    <div className="animate-fade-in" style={{ padding: '16px', maxWidth: '1000px', margin: '0 auto' }}>
      <div style={{ marginBottom: '16px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 800 }}>Orders</h1>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px', borderBottom: '1px solid var(--border)' }}>
          <select
            className="input"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            style={{ width: '100%', height: '42px' }}
          >
            {allStatuses.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div className="table-wrapper" style={{ border: 'none', borderRadius: 0, overflowX: 'auto', minHeight: '300px' }}>
          {loading ? (
            <div style={{ padding: '40px', display: 'flex', justifyContent: 'center' }}><div className="loader" /></div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Ticket</th>
                  <th>Customer</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {orders.map(order => (
                  <tr key={order.id} onClick={() => openOrderModal(order)} style={{ cursor: 'pointer' }}>
                    <td>
                      <strong style={{ color: 'var(--primary)', fontSize: '15px' }}>#{String(order.ticket_number).padStart(3, '0')}</strong>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{formatDateTime(order.created_at)}</div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{order.customer_name}</div>
                      {order.table_number && (
                        <div style={{ fontSize: '10px', color: 'white', background: 'var(--primary)', display: 'inline-block', padding: '2px 6px', borderRadius: '4px', marginTop: '4px', fontWeight: 700 }}>
                          🪑 T-{order.table_number}
                        </div>
                      )}
                    </td>
                    <td><span className={`badge badge-${order.status.toLowerCase()}`}>{order.status}</span></td>
                    <td><button className="btn btn-ghost btn-sm" style={{ color: 'var(--primary)' }}>View</button></td>
                  </tr>
                ))}
                {orders.length === 0 && (
                  <tr><td colSpan={4} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>No orders found</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {mounted && selectedOrder && createPortal(
        <div className="modal-backdrop" onClick={closeModal} style={{ alignItems: 'flex-end', padding: 0 }}>
          <div className="modal-desktop" onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: '600px', padding: '24px', borderBottomLeftRadius: 0, borderBottomRightRadius: 0, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px', flexWrap: 'wrap' }}>
                  <h2 style={{ fontSize: '20px', fontWeight: 900, color: 'var(--primary)' }}>#{String(selectedOrder.ticket_number).padStart(3, '0')}</h2>
                  <span className={`badge badge-${selectedOrder.status.toLowerCase()}`}>{selectedOrder.status}</span>
                  {selectedOrder.table_number && (
                    <span style={{ fontSize: '12px', fontWeight: 800, color: 'white', background: 'var(--primary)', padding: '4px 8px', borderRadius: '4px' }}>
                      🪑 TABLE {selectedOrder.table_number}
                    </span>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Link prefetch={false} href={`/staff/orders/${selectedOrder.id}/edit`} className="btn btn-secondary btn-sm" style={{ padding: '0 12px', height: '32px', fontSize: '12px' }}>
                  EDIT
                </Link>
                <button onClick={closeModal} className="modal-close-btn">✕</button>
              </div>
            </div>

            <div className="card" style={{ background: '#F9FAFB', padding: '12px 16px', marginBottom: '16px', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <div><p className="label">CUSTOMER</p><p style={{ fontWeight: 700 }}>{selectedOrder.customer_name}</p></div>
                <div style={{ textAlign: 'right' }}><p className="label">PHONE</p><p style={{ fontWeight: 600 }}>{selectedOrder.phone}</p></div>
              </div>
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
                <p style={{ fontWeight: 700, fontSize: '14px', marginBottom: '8px' }}>Update Status</p>
                <select
                  className="input"
                  value={selectedOrder.status}
                  onChange={(e) => handleStatusChange(selectedOrder.id, e.target.value, tempTableNumber)}
                  style={{ width: '100%', height: '42px', fontWeight: 700 }}
                  disabled={modalLoading}
                >
                  {allStatuses.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              {(selectedOrder.status === 'PREPARING') && (
                <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
                  <p style={{ fontWeight: 700, fontSize: '14px', marginBottom: '8px' }}>Assign Table Number</p>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      className="input"
                      value={tempTableNumber}
                      onChange={(e) => setTempTableNumber(e.target.value.toUpperCase())}
                      style={{ flex: 1, textTransform: 'uppercase' }}
                    />
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => handleStatusChange(selectedOrder.id, selectedOrder.status, tempTableNumber)}
                      disabled={modalLoading || !tempTableNumber}
                    >
                      Save Table
                    </button>
                  </div>
                </div>
              )}
            </div>

            <button 
              onClick={closeModal}
              className="btn btn-ghost"
              style={{ width: '100%', marginTop: '16px' }}
            >
              Close
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
