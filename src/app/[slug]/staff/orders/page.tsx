'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { Order } from '@/types';
import { formatPrice, formatDateTime, getCurrentBusinessDate } from '@/lib/format';
import { pusherClient } from '@/lib/pusher-client';
import { orderService } from '@/app/services/orders.api';
import { useRestaurant } from '@/hooks/useRestaurant';
import { User, Users, StickyNote } from 'lucide-react';
import OrderTypeBadge from '@/components/modules/orders/OrderTypeBadge';
import { AdminContentWrapper } from '@/components/AdminContentWrapper';
import { AdminPageHeader } from '@/components/AdminPageHeader';

export default function StaffOrders() {
  const { slug } = useParams();
  const { restaurant } = useRestaurant();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('PENDING');
  const [page, setPage] = useState(1);
  const [mounted, setMounted] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [tempStatus, setTempStatus] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [tempTableNumber, setTempTableNumber] = useState('');
  const [tables, setTables] = useState<any[]>([]);
  const ordersRef = useRef<Order[]>([]);

  useEffect(() => {
    if (!slug) return;
    const currentSlug = Array.isArray(slug) ? slug[0] : slug;
    fetch('/api/tables', {
      headers: { 'x-restaurant-slug': currentSlug || '' }
    })
      .then(res => res.json())
      .then(data => {
        if (data.success && Array.isArray(data.tables)) {
          setTables(data.tables);
        }
      })
      .catch(() => {});
  }, [slug]);

  const fetchOrders = useCallback(async (silent = false) => {
    if (!restaurant) return;
    if (!silent && ordersRef.current.length === 0) setLoading(true);
    try {
      const bDate = getCurrentBusinessDate(restaurant.timezone, restaurant.rollover_time);
      const data = await orderService.getOrders({
        page,
        per_page: 100,
        sort: 'ASC',
        date_from: bDate,
        date_to: bDate,
        status: statusFilter
      });

      if (data.success && data.data) {
        setOrders(data.data);
        ordersRef.current = data.data;
      }
    } catch {
      toast.error('Failed to load orders');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, restaurant]);

  const fetchDebounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (fetchDebounceRef.current) clearTimeout(fetchDebounceRef.current);
    fetchDebounceRef.current = setTimeout(() => {
      fetchOrders();
    }, 100);
    return () => {
      if (fetchDebounceRef.current) clearTimeout(fetchDebounceRef.current);
    };
  }, [fetchOrders]);

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
    setMounted(true);
    if (!pusherClient || !restaurant) return;

    const channelName = restaurant.pusher_channel || `queue-channel-${restaurant.id}`;
    const channel = pusherClient.subscribe(channelName);

    const handleNewOrder = (data: any) => {
      if (data.restaurant_id !== restaurant.id) return;
      toast(`🔔 New order #${String(data.ticket_number).padStart(3, '0')}`, { icon: '🛒', duration: 4000 });
      fetchOrdersDebounced();
    };

    const handleOrderUpdate = (data: any) => {
      if (data.restaurant_id !== restaurant.id) return;

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
    };

    channel.bind('new_order', handleNewOrder);
    channel.bind('order_update', handleOrderUpdate);

    return () => {
      if (fetchDebounceRef.current) clearTimeout(fetchDebounceRef.current);
      channel.unbind('new_order', handleNewOrder);
      channel.unbind('order_update', handleOrderUpdate);
    };
  }, [fetchOrdersDebounced, statusFilter, restaurant]);

  const handleStatusChange = async (id: string, newStatus: string, tableNumber?: string, pMethod?: string) => {
    setModalLoading(true);
    try {
      const data = await orderService.updateOrder(id, {
        status: newStatus,
        table_number: tableNumber,
        payment_method: pMethod || undefined
      });
      if (data.success) {
        setOrders(prev => {
          return prev.map(o => o.id === id ? { ...o, status: newStatus as Order['status'], table_number: tableNumber ?? o.table_number, payment_method: pMethod ?? o.payment_method } : o)
            .filter(o => {
              if (statusFilter) return o.status === statusFilter;
              return o.status === 'PENDING';
            });
        });
        setSelectedOrder((prev): Order | null => prev ? { ...prev, status: newStatus as Order['status'], table_number: tableNumber ?? prev.table_number, payment_method: pMethod ?? prev.payment_method } : null);
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

  const allStatuses = ['PENDING', 'PREPARING', 'READY', 'PAID', 'CANCELLED'];

  const openOrderModal = (order: Order) => {
    setSelectedOrder(order);
    setTempStatus(order.status);
    setPaymentMethod(order.payment_method || '');
    setTempTableNumber(order.table_number || '');
  };
  const closeModal = () => {
    setSelectedOrder(null);
    setTempTableNumber('');
    setPaymentMethod('');
    setTempStatus('');
  };

  return (
    <AdminContentWrapper>
      <AdminPageHeader
        title="Live Orders"
        description="Manage and track active orders coming from staff and tables."
      />

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', background: '#F9FAFB' }}>
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
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <strong style={{ color: 'var(--primary)', fontSize: '15px' }}>#{String(order.ticket_number).padStart(3, '0')}</strong>
                        <OrderTypeBadge type={order.order_type} />
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{formatDateTime(order.created_at)}</div>
                      {order.staff_name && (
                        <div style={{ fontSize: '10px', color: 'white', background: '#64748b', display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 6px', borderRadius: '4px', marginTop: '4px', fontWeight: 700 }}>
                          <User size={12} /> {order.staff_name.split(' ')[0]}
                        </div>
                      )}
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
                  <OrderTypeBadge type={selectedOrder.order_type} />
                  <span className={`badge badge-${selectedOrder.status.toLowerCase()}`}>{selectedOrder.status}</span>
                  {selectedOrder.table_number && (
                    <span style={{ fontSize: '12px', fontWeight: 800, color: 'white', background: 'var(--primary)', padding: '4px 8px', borderRadius: '4px' }}>
                      🪑 TABLE {selectedOrder.table_number}
                    </span>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Link prefetch={false} href={`/${slug}/staff/orders/${selectedOrder.id}/edit`} className="btn btn-secondary btn-sm" style={{ padding: '0 12px', height: '32px', fontSize: '12px' }}>
                  EDIT
                </Link>
                <button onClick={closeModal} className="modal-close-btn">✕</button>
              </div>
            </div>

            <div className="card" style={{ background: '#F9FAFB', padding: '12px 16px', marginBottom: '16px', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <div><p className="label">CUSTOMER</p><p style={{ fontWeight: 700 }}>{selectedOrder.customer_name}</p></div>
                {selectedOrder.staff_name && (
                  <div style={{ textAlign: 'center' }}><p className="label">TAKEN BY</p><p style={{ fontWeight: 600, color: 'var(--primary)' }}>{selectedOrder.staff_name.split(' ')[0]}</p></div>
                )}
                <div style={{ textAlign: 'right' }}><p className="label">PHONE</p><p style={{ fontWeight: 600 }}>{selectedOrder.phone}</p></div>
              </div>
              {selectedOrder.notes && <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '6px', fontStyle: 'italic', display: 'flex', alignItems: 'flex-start', gap: '6px' }}><StickyNote size={14} style={{ marginTop: '2px', flexShrink: 0 }} /> <span>{selectedOrder.notes}</span></p>}
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

              {(selectedOrder.gst_amount && Number(selectedOrder.gst_amount) > 0) ? (
                <div style={{ marginTop: '8px', borderTop: '2px dashed var(--border)', paddingTop: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    <span>Subtotal</span>
                    <span>{formatPrice(selectedOrder.subtotal || (selectedOrder.total_price - selectedOrder.gst_amount))}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    <span>GST ({selectedOrder.gst_rate || 5}%)</span>
                    <span>{formatPrice(selectedOrder.gst_amount)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '4px', fontWeight: 800, fontSize: '18px' }}>
                    <span>Total</span>
                    <span style={{ color: 'var(--primary)' }}>{formatPrice(selectedOrder.total_price)}</span>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', marginTop: '8px', borderTop: '2px dashed var(--border)', fontWeight: 800, fontSize: '18px' }}>
                  <span>Total</span><span style={{ color: 'var(--primary)' }}>{formatPrice(selectedOrder.total_price)}</span>
                </div>
              )}
            </div>

            <div style={{ background: '#F9FAFB', padding: '12px 16px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
              <div>
                <p style={{ fontWeight: 700, fontSize: '14px', marginBottom: '8px' }}>Update Status</p>
                <select
                  className="input"
                  value={tempStatus}
                  onChange={(e) => {
                    const newStatus = e.target.value;
                    setTempStatus(newStatus);
                    if (newStatus !== 'PAID') {
                      handleStatusChange(selectedOrder.id, newStatus, tempTableNumber, paymentMethod);
                    }
                  }}
                  style={{ width: '100%', height: '42px', fontWeight: 700 }}
                  disabled={modalLoading}
                >
                  {allStatuses.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              {tempStatus === 'PAID' && (
                <div style={{ marginTop: '12px', padding: '12px', background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
                  <p style={{ fontWeight: 700, fontSize: '12px', marginBottom: '8px', color: 'var(--text-secondary)' }}>Select Payment Method</p>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <select
                      className="select"
                      style={{ flex: 1, height: '42px', fontWeight: 600 }}
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                    >
                      <option value="">Choose Method</option>
                      <option value="UPI">UPI</option>
                      <option value="CASH">Cash</option>
                      <option value="CARD">Card</option>
                    </select>
                    <button 
                      className="btn btn-primary"
                      disabled={modalLoading || !paymentMethod}
                      onClick={() => handleStatusChange(selectedOrder.id, 'PAID', tempTableNumber, paymentMethod)}
                    >
                      Confirm Paid
                    </button>
                  </div>
                </div>
              )}

              {(tempStatus === 'PREPARING' || tempStatus === 'PENDING') && (
                <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
                  <p style={{ fontWeight: 700, fontSize: '14px', marginBottom: '8px' }}>Assign Table Number</p>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <select
                      className="select"
                      value={tempTableNumber}
                      onChange={(e) => setTempTableNumber(e.target.value)}
                      style={{ flex: 1, height: '42px', fontWeight: 600 }}
                    >
                      <option value="">-- Select Table --</option>
                      {tables.map((t: any) => {
                        const cap = Number(t.capacity) || 0;
                        const activeOrds = t.active_orders || [];
                        const seated = activeOrds.reduce((sum: number, o: any) => {
                          if (o.order_type === 'TAKEAWAY' || o.order_type === 'DELIVERY') return sum;
                          return sum + (Number(o.party_size) || 1);
                        }, 0);
                        const remaining = cap > 0 ? Math.max(0, cap - seated) : 0;
                        const isOccupied = t.status === 'OCCUPIED';
                        const isFull = isOccupied && (cap > 0 ? remaining === 0 : true);
                        const statusLabel = isFull 
                          ? `🔴 Occupied (0/${cap})` 
                          : isOccupied 
                            ? `🟠 Occupied (${remaining}/${cap})` 
                            : '🟢 Available';
                        return (
                          <option key={t.id} value={t.table_number}>
                            Table {t.table_number} {(!isOccupied && t.capacity) ? `(${t.capacity} seats)` : ''} {statusLabel}
                          </option>
                        );
                      })}
                      {tempTableNumber && !tables.some((t: any) => t.table_number === tempTableNumber) && (
                        <option value={tempTableNumber}>Table {tempTableNumber}</option>
                      )}
                    </select>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => handleStatusChange(selectedOrder.id, tempStatus, tempTableNumber, paymentMethod)}
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
    </AdminContentWrapper>
  );
}
