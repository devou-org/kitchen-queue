'use client';
import { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { Order } from '@/types';
import { formatPrice, formatDateTime } from '@/lib/format';
import { pusherClient } from '@/lib/pusher-client';

export default function AdminOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [currentTab, setCurrentTab] = useState<'ACTIVE' | 'REPORTS'>('ACTIVE');
  const [dateFrom, setDateFrom] = useState(new Date().toISOString().split('T')[0]);
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [modalLoading, setModalLoading] = useState(false);

  const fetchOrders = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const qs = new URLSearchParams({ page: page.toString(), per_page: '100' });
      if (statusFilter) qs.append('status', statusFilter);
      
      if (currentTab === 'REPORTS') {
        qs.append('date_from', dateFrom);
        qs.append('date_to', dateTo);
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

  // Base data fetch effect
  useEffect(() => {
    fetchOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, statusFilter, currentTab, dateFrom, dateTo]);

  // Real-time effect
  useEffect(() => {
    if (!pusherClient) {
      console.log('❌ Pusher client not available');
      return;
    }

    const channel = pusherClient.subscribe('queue-channel');

    // ✅ NEW ORDER EVENT
    channel.bind('new_order', (data: any) => {
      console.log('✅ Pusher event received: new_order', data);
      toast.success(`New order created: #${String(data.ticket_number).padStart(3, '0')}`);
      if (currentTab === 'ACTIVE') fetchOrders(true); // Silent refresh for active tab
    });

    // ✅ ORDER UPDATE EVENT (Status or Payment)
    channel.bind('order_update', (data: any) => {
      console.log('✅ Pusher event received: order_update', data);

      // Update the order in the list immediately
      setOrders(prev => prev.map(o => {
        if (o.id === data.order_id) {
          const updated = { ...o };
          if (data.new_status) updated.status = data.new_status;
          if (typeof data.is_paid === 'boolean') updated.is_paid = data.is_paid;
          return updated;
        }
        return o;
      }));

      // Update modal if the selected order is the one being updated
      setSelectedOrder(prev => {
        if (prev && prev.id === data.order_id) {
          const updated = { ...prev };
          if (data.new_status) updated.status = data.new_status;
          if (typeof data.is_paid === 'boolean') updated.is_paid = data.is_paid;
          return updated;
        }
        return prev;
      });

      // Show toast notification
      if (data.new_status) toast.success(`Order #${String(data.ticket_number).padStart(3, '0')} updated to ${data.new_status}`);

      // Silent refresh
      fetchOrders(true);
    });

    return () => {
      channel.unbind_all();
      channel.unsubscribe();
    };
  }, [currentTab]); // Reset on tab change to ensures correct fetch logic

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
        toast.success(`Order status updated to ${newStatus}`);
        setSelectedOrder(prev => prev ? { ...prev, status: newStatus as Order['status'] } : null);
      } else {
        toast.error(data.error || 'Failed to update');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setModalLoading(false);
    }
  };

  const handlePaidToggle = async (id: string, isPaid: boolean) => {
    setModalLoading(true);
    try {
      const res = await fetch(`/api/orders/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_paid: isPaid })
      });
      const data = await res.json();
      if (data.success) {
        toast.success(isPaid ? 'Marked as Paid' : 'Marked as Unpaid');
        setSelectedOrder(prev => prev ? { ...prev, is_paid: isPaid } : null);
      } else {
        toast.error(data.error || 'Failed to update payment');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setModalLoading(false);
    }
  };

  const exportStatementsCSV = () => {
    if (orders.length === 0) {
      toast.error('No data to export for these dates');
      return;
    }
    const headers = ['Ticket', 'Customer', 'Phone', 'Items', 'Total', 'Paid', 'Status', 'Date'];
    const rows = orders.map(order => [
      `#${String(order.ticket_number).padStart(3, '0')}`,
      `"${order.customer_name}"`,
      `"${order.phone}"`,
      `"${(order.items || []).map(i => `${i.product_name} (x${i.quantity})`).join('; ')}"`,
      order.total_price,
      order.is_paid ? 'PAID' : 'PENDING',
      order.status,
      `"${formatDateTime(order.created_at)}"`
    ]);

    const csvContent = headers.join(',') + "\n" + rows.map(e => e.join(',')).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Statements_${dateFrom}_to_${dateTo}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const activeStatuses = ['PENDING', 'PREPARING', 'READY'];
  const allStatuses = ['PENDING', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED'];

  // Filter logic: ACTIVE tab only shows pending/prep/ready. REPORTS tab shows all results from API (which are already date filtered)
  const filteredOrders = currentTab === 'ACTIVE' 
    ? orders.filter(o => activeStatuses.includes(o.status))
    : orders;

  const openOrderModal = (order: Order) => {
    setSelectedOrder(order);
  };

  const closeModal = () => {
    setSelectedOrder(null);
  };

  return (
    <div className="page-content-admin animate-fade-in" style={{ padding: '32px' }}>
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 800 }}>Orders Command Center</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Manage live fulfillment and download date-filtered financial statements.</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
        <button
          className={`btn ${currentTab === 'ACTIVE' ? 'btn-primary' : ''}`}
          style={currentTab !== 'ACTIVE' ? { background: 'var(--bg)', color: 'var(--text-primary)' } : {}}
          onClick={() => { setCurrentTab('ACTIVE'); setStatusFilter(''); setPage(1); }}
        >
          ● Active Orders
        </button>
        <button
          className={`btn ${currentTab === 'REPORTS' ? 'btn-primary' : ''}`}
          style={currentTab !== 'REPORTS' ? { background: 'var(--bg)', color: 'var(--text-primary)' } : {}}
          onClick={() => { setCurrentTab('REPORTS'); setStatusFilter(''); setPage(1); }}
        >
          📅 Export Statements
        </button>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '20px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'flex-end' }}>
            {currentTab === 'ACTIVE' ? (
              <div style={{ flex: 1, minWidth: '200px' }}>
                <label style={{ display: 'block', fontSize: '10px', fontWeight: 800, marginBottom: '6px', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Filter Active Status</label>
                <select 
                  className="input" 
                  value={statusFilter} 
                  onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                  style={{ height: '42px' }}
                >
                  <option value="">All Active Orders</option>
                  {activeStatuses.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'flex-end', width: '100%' }}>
                <div style={{ flex: '1', minWidth: '140px' }}>
                  <label style={{ display: 'block', fontSize: '10px', fontWeight: 800, marginBottom: '6px', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>From Date</label>
                  <input type="date" className="input" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ height: '42px' }} />
                </div>
                <div style={{ flex: '1', minWidth: '140px' }}>
                  <label style={{ display: 'block', fontSize: '10px', fontWeight: 800, marginBottom: '6px', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>To Date</label>
                  <input type="date" className="input" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ height: '42px' }} />
                </div>
                <div style={{ flex: '1', minWidth: '140px' }}>
                  <label style={{ display: 'block', fontSize: '10px', fontWeight: 800, marginBottom: '6px', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Status</label>
                  <select className="input" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ height: '42px' }}>
                    <option value="">All Statuses</option>
                    {allStatuses.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <button 
                  className="btn" 
                  onClick={exportStatementsCSV}
                  style={{ height: '42px', background: '#059669', color: 'white', padding: '0 24px' }}
                >
                  📥 Export Statements (CSV)
                </button>
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
                  <th>Paid</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map(order => (
                  <tr
                    key={order.id}
                    onClick={() => openOrderModal(order)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td>
                      <strong style={{ color: 'var(--primary)', fontSize: '16px' }}>
                        #{String(order.ticket_number).padStart(3, '0')}
                      </strong>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{formatDateTime(order.created_at)}</div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{order.customer_name}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{order.phone}</div>
                      {(order.party_size || 1) > 1 && <div style={{ fontSize: '12px', color: 'var(--info)' }}>Party of {order.party_size}</div>}
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
                    <td>
                      <span className={`badge badge-${order.status.toLowerCase()}`}>
                        {order.status}
                      </span>
                    </td>
                    <td>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={(e) => { e.stopPropagation(); openOrderModal(order); }}
                        style={{ minWidth: 'auto', fontSize: '12px', color: 'var(--primary)' }}
                      >
                        View →
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredOrders.length === 0 && (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: '60px', color: 'var(--text-secondary)' }}>No orders found in {currentTab}</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
            Showing {filteredOrders.length} records
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className="btn btn-secondary btn-sm"
              disabled={page === 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
            >← Prev</button>
            <button
              className="btn btn-secondary btn-sm"
              disabled={orders.length < 50}
              onClick={() => setPage(p => p + 1)}
            >Next →</button>
          </div>
        </div>
      </div>

      {/* ======== ORDER DETAIL MODAL / POPUP ======== */}
      {selectedOrder && (
        <div
          className="modal-backdrop"
          onClick={closeModal}
          style={{ alignItems: 'center' }}
        >
          <div
            className="modal-desktop"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '520px' }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                  <h2 style={{ fontSize: '24px', fontWeight: 900, color: 'var(--primary)' }}>
                    #{String(selectedOrder.ticket_number).padStart(3, '0')}
                  </h2>
                  <span className={`badge badge-${selectedOrder.status.toLowerCase()}`}>
                    {selectedOrder.status}
                  </span>
                </div>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                  {formatDateTime(selectedOrder.created_at)}
                </p>
              </div>
              <button
                onClick={closeModal}
                style={{
                  background: 'rgba(0,0,0,0.05)', border: 'none', cursor: 'pointer',
                  width: '32px', height: '32px', borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '16px', color: 'var(--text-secondary)',
                  transition: 'background 0.2s',
                }}
                onMouseOver={(e) => (e.currentTarget.style.background = 'rgba(0,0,0,0.1)')}
                onMouseOut={(e) => (e.currentTarget.style.background = 'rgba(0,0,0,0.05)')}
              >✕</button>
            </div>

            {/* Customer Info */}
            <div style={{
              background: '#F9FAFB', borderRadius: 'var(--radius-sm)',
              padding: '14px 16px', marginBottom: '20px',
              border: '1px solid var(--border)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <div>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '2px' }}>CUSTOMER</p>
                  <p style={{ fontWeight: 700 }}>{selectedOrder.customer_name}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '2px' }}>PHONE</p>
                  <p style={{ fontWeight: 600 }}>{selectedOrder.phone}</p>
                </div>
              </div>
              {(selectedOrder.party_size || 1) > 1 && (
                <p style={{ fontSize: '13px', color: 'var(--info)', fontWeight: 600 }}>
                  👥 Party of {selectedOrder.party_size}
                </p>
              )}
              {selectedOrder.notes && (
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '6px', fontStyle: 'italic' }}>
                  📝 {selectedOrder.notes}
                </p>
              )}
            </div>

            {/* Order Items */}
            <div style={{ marginBottom: '20px' }}>
              <p style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>
                ORDER ITEMS
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {(selectedOrder.items || []).map((item, idx) => (
                  <div key={idx} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '10px 12px', background: 'white', borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{
                        width: '28px', height: '28px', borderRadius: '50%',
                        background: 'rgba(255,107,53,0.1)', color: 'var(--primary)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '12px', fontWeight: 800,
                      }}>{item.quantity}</span>
                      <span style={{ fontWeight: 600, fontSize: '14px' }}>
                        {item.product_name || 'Item'}
                      </span>
                    </div>
                    <span style={{ fontWeight: 700, fontSize: '14px' }}>
                      {formatPrice(item.price_at_purchase * item.quantity)}
                    </span>
                  </div>
                ))}
              </div>
              <div style={{
                display: 'flex', justifyContent: 'space-between',
                padding: '12px 0', marginTop: '8px',
                borderTop: '2px dashed var(--border)',
                fontWeight: 800, fontSize: '16px',
              }}>
                <span>Total</span>
                <span style={{ color: 'var(--primary)' }}>{formatPrice(selectedOrder.total_price)}</span>
              </div>
            </div>

            {/* ===== ACTION CONTROLS ===== */}
            <div style={{
              background: '#F9FAFB', borderRadius: 'var(--radius-sm)',
              padding: '16px', border: '1px solid var(--border)',
            }}>
              {/* Mark as Paid */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div>
                  <p style={{ fontWeight: 700, fontSize: '14px', marginBottom: '2px' }}>Payment Status</p>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    {selectedOrder.is_paid ? 'This order has been paid' : 'Payment pending from customer'}
                  </p>
                </div>
                <button
                  className="btn btn-sm"
                  disabled={modalLoading}
                  onClick={() => handlePaidToggle(selectedOrder.id, !selectedOrder.is_paid)}
                  style={{
                    background: selectedOrder.is_paid ? 'rgba(5,150,105,0.1)' : 'var(--primary)',
                    color: selectedOrder.is_paid ? '#059669' : 'white',
                    border: selectedOrder.is_paid ? '1.5px solid #059669' : 'none',
                    fontWeight: 700, fontSize: '13px',
                    minWidth: '120px',
                  }}
                >
                  {selectedOrder.is_paid ? '✓ Paid' : '💰 Mark as Paid'}
                </button>
              </div>

              {/* Status Dropdown */}
              <div>
                <p style={{ fontWeight: 700, fontSize: '14px', marginBottom: '8px' }}>Order Status</p>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <select
                    className="select"
                    style={{ flex: 1, height: '40px', fontSize: '14px' }}
                    value={selectedOrder.status}
                    disabled={modalLoading}
                    onChange={(e) => handleStatusChange(selectedOrder.id, e.target.value)}
                  >
                    {allStatuses.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {modalLoading && (
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: '16px' }}>
                <div className="loader" style={{ width: 20, height: 20, borderWidth: 2 }} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}