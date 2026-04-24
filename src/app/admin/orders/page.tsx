'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Order } from '@/types';
import { formatPrice, formatDateTime } from '@/lib/format';
import { pusherClient } from '@/lib/pusher-client';
import { orderService } from '@/app/services/orders.api';
import { adminService } from '@/app/services/admin.api';

interface OrderUpdateLog {
  id: string;
  order_id: string;
  ticket_number: number;
  table_number?: string;
  status: string;
  timestamp: string;
  message: string;
  items?: { product_name: string; quantity: number }[];
}

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
  const ordersRef = useRef<Order[]>([]);

  // Kitchen Snapshot States
  const [showKitchenSnapshot, setShowKitchenSnapshot] = useState(false);
  const [kitchenSnapshotLoading, setKitchenSnapshotLoading] = useState(false);
  const [kitchenSnapshot, setKitchenSnapshot] = useState<any[]>([]);

  // Live Updates Log
  const [recentUpdates, setRecentUpdates] = useState<OrderUpdateLog[]>([]);

  const dismissUpdate = (id: string) => {
    setRecentUpdates(prev => prev.filter(u => u.id !== id));
  };

  const loadKitchenSnapshot = async () => {
    setShowKitchenSnapshot(true);
    setKitchenSnapshotLoading(true);
    try {
      const res = await adminService.getKitchenSnapshot();
      if (res.success && res.data) {
        setKitchenSnapshot(res.data);
      } else {
        toast.error('Failed to load kitchen snapshot');
      }
    } catch {
      toast.error('Error loading kitchen snapshot');
    } finally {
      setKitchenSnapshotLoading(false);
    }
  };

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
        status: statusFilter || 'PENDING'
      });

      if (data.success && data.data) {
        setOrders(data.data);
        ordersRef.current = data.data;
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
    }, 400); // 400ms buffer to batch multiple updates
  }, [fetchOrders]);

  useEffect(() => {
    if (!pusherClient) return;
    const channel = pusherClient.subscribe('queue-channel');

    channel.bind('new_order', (data: any) => {
      toast.success(`New order created: #${String(data.ticket_number).padStart(3, '0')}`);
      fetchOrdersDebounced(true);
    });

    channel.bind('order_update', (data: any) => {
      // 1. PATCH LOCAL STATE (The "incremental" way)
      // This makes the UI update INSTANTLY without a network request
      setOrders(prev => {
        const orderIndex = prev.findIndex(o => o.id === data.order_id);
        if (orderIndex === -1) return prev; // Not in current filter, ignore

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
          // If statusFilter is empty, we are in the default "PENDING" view
          const currentFilter = statusFilter || 'PENDING';
          if (currentFilter !== 'ALL') {
             return o.status === currentFilter;
          }
          return true;
        });
      });

      // 2. HIGHLIGHT & LOG ADDITIONS
      // Only log and highlight if items were actually added to an existing order
      if (data.items_updated && data.added_items) {
        // Trigger blink for item additions
        if (data.order_id) {
          setFlashedOrderIds(prev => { const next = new Set(prev); next.add(data.order_id); return next; });
          setTimeout(() => {
            setFlashedOrderIds(prev => { const next = new Set(prev); next.delete(data.order_id); return next; });
          }, 2600);
          setGreenTicketIds(prev => { const next = new Set(prev); next.add(data.order_id); return next; });
        }

        const newUpdate: OrderUpdateLog = {
          id: Math.random().toString(),
          order_id: data.order_id,
          ticket_number: data.ticket_number,
          table_number: data.table_number,
          status: data.new_status || 'PREPARING',
          timestamp: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
          message: `New items added`,
          items: data.added_items
        };
        
        // FCFS: Add to the end, oldest stays at index 0
        setRecentUpdates(up => [...up, newUpdate].slice(-10));
        
        toast(
          `🛒 Customer added items to order #${String(data.ticket_number).padStart(3, '0')}`,
          { icon: '🟢', duration: 5000, style: { fontWeight: 700 } }
        );
        
        // Full background refresh to get accurate totals/item list
        fetchOrdersDebounced(true);
      } else if (!data.items_updated) {
        // Just a status/payment change? Local patch above is enough, 
        // no need to re-fetch unless you want absolute safety.
      }

      // Sync Modal if open
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
        setSelectedOrder((prev): Order | null => prev ? { ...prev, status: newStatus as Order['status'], table_number: tableNumber ?? prev.table_number } : null);

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

  const activeStatuses = ['PREPARING', 'READY', 'PAID', 'CANCELLED', 'EXPIRED']; // Exclude PENDING as it's the default
  const allStatuses = ['PENDING', 'PREPARING', 'READY', 'PAID', 'CANCELLED', 'EXPIRED'];

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
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 800 }}>Active Order Queue</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Live fulfillment for PENDING & PREPARING orders. (READY orders are moved to pickup)</p>
        </div>
        <button className="btn btn-primary" onClick={loadKitchenSnapshot} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>🍳</span> Kitchen Snapshot
        </button>
      </div>

      {recentUpdates.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: 'var(--success)' }}></span>
            <h2 style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Live Additions</h2>
          </div>
          <div className="live-updates-container">
            {recentUpdates.map(update => (
              <div 
                key={update.id} 
                className="card live-update-card animate-fade-in" 
                style={{ 
                  padding: '16px', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  justifyContent: 'space-between', 
                  borderLeft: '4px solid var(--success)', 
                  position: 'relative'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '8px', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                    <div style={{ fontSize: '24px', fontWeight: 900, color: 'var(--primary)' }}>#{String(update.ticket_number).padStart(3, '0')}</div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                        <span className={`badge badge-${update.status.toLowerCase()}`}>{update.status}</span>
                        {update.table_number && (
                          <span style={{ fontSize: '10px', fontWeight: 800, color: 'white', background: 'var(--primary)', padding: '2px 6px', borderRadius: '4px' }}>🪑 T-{update.table_number}</span>
                        )}
                      </div>
                      <p style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>{update.message}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => dismissUpdate(update.id)} 
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '18px', padding: '0 4px', lineHeight: 1 }}
                  >
                    ✕
                  </button>
                </div>

                {update.items && update.items.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '8px' }}>
                    {update.items.map((item, idx) => (
                      <div key={idx} style={{ background: 'rgba(0,0,0,0.04)', padding: '2px 4px', borderRadius: '4px', fontSize: '10px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        <span style={{ color: 'var(--primary)' }}>{item.quantity}x</span> {item.product_name}
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid rgba(0,0,0,0.03)', paddingTop: '8px' }}>
                  <div style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: 700 }}>{update.timestamp}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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

      {mounted && showKitchenSnapshot && createPortal(
        <div className="modal-backdrop" onClick={() => setShowKitchenSnapshot(false)} style={{ alignItems: 'center', zIndex: 1000 }}>
          <div className="modal-desktop" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '700px', width: '95%', padding: '24px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '24px', background: 'rgba(151,19,69,0.1)', width: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '12px' }}>🍳</span>
                <div>
                  <h2 style={{ fontSize: '20px', fontWeight: 900, color: 'var(--primary)', lineHeight: 1.1 }}>Kitchen Snapshot <span style={{ color: 'var(--text-secondary)', fontSize: '14px', fontWeight: 600 }}>(Live)</span></h2>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>Today's consolidated demand vs available stock.</p>
                </div>
              </div>
              <button onClick={() => setShowKitchenSnapshot(false)} style={{ background: 'none', border: 'none', fontSize: '24px', color: 'var(--text-secondary)', cursor: 'pointer', padding: '8px' }}>✕</button>
            </div>

            {kitchenSnapshotLoading ? (
              <div style={{ padding: '60px', display: 'flex', justifyContent: 'center' }}><div className="loader" /></div>
            ) : (
              <div style={{ marginTop: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', padding: '0 12px 12px', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ flex: 1, fontSize: '11px', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>ITEM</span>
                  <div style={{ display: 'flex', gap: '24px', textAlign: 'center', width: '220px' }}>
                    <span style={{ flex: 1, fontSize: '10px', fontWeight: 800, color: '#D97706', textTransform: 'uppercase' }}>Pending</span>
                    <span style={{ flex: 1, fontSize: '10px', fontWeight: 800, color: '#2563EB', textTransform: 'uppercase' }}>Preparing</span>
                    <span style={{ flex: 1, fontSize: '10px', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Stock</span>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {kitchenSnapshot.map((item, idx) => {
                    const pending = Number(item.pending_qty) || 0;
                    const preparing = Number(item.preparing_qty) || 0;
                    const stock = Number(item.current_stock) || 0;
                    const isLowStock = stock < (pending + preparing);
                    
                    return (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', padding: '12px 12px', borderBottom: '1px solid #F3F4F6' }}>
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '16px' }}>
                          {item.image_url ? (
                            <img src={item.image_url} alt={item.product_name} style={{ width: 44, height: 44, borderRadius: 10, objectFit: 'cover', background: '#F3F4F6' }} />
                          ) : (
                            <div style={{ width: 44, height: 44, borderRadius: 10, background: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🍽️</div>
                          )}
                          <div>
                            <p style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)', lineHeight: 1.2 }}>{item.product_name}</p>
                            {isLowStock && <p style={{ fontSize: '10px', color: '#DC2626', fontWeight: 700, marginTop: '2px' }}>⚠️ LOW</p>}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '24px', textAlign: 'center', width: '220px', alignItems: 'center' }}>
                          <span style={{ flex: 1, fontSize: '18px', fontWeight: 900, color: pending > 0 ? '#D97706' : '#E5E7EB' }}>{pending}</span>
                          <span style={{ flex: 1, fontSize: '18px', fontWeight: 900, color: '#2563EB' }}>{preparing}</span>
                          <span style={{ flex: 1, fontSize: '16px', fontWeight: 700, color: isLowStock ? '#DC2626' : 'var(--text-secondary)' }}>{stock}</span>
                        </div>
                      </div>
                    );
                  })}
                  {kitchenSnapshot.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-secondary)', fontSize: '14px' }}>No active demand to display</div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}