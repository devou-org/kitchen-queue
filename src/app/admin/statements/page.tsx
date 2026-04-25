'use client';
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Order } from '@/types';
import { formatPrice, formatDateTime } from '@/lib/format';

export default function AdminStatements() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFrom, setDateFrom] = useState(new Date().toISOString().split('T')[0]);
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);
  const [page, setPage] = useState(1);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const fetchOrders = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const qs = new URLSearchParams({ 
        page: page.toString(), 
        per_page: '200',
        date_from: dateFrom,
        date_to: dateTo,
        sort: 'DESC'
      });
      if (statusFilter) qs.append('status', statusFilter);

      const res = await fetch(`/api/orders?${qs.toString()}`);
      const data = await res.json();

      if (data.success) {
        setOrders(data.data);
      }
    } catch {
      toast.error('Failed to load statements');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFrom, dateTo, statusFilter, page]);

  const exportCSV = () => {
    if (orders.length === 0) {
      toast.error('No data to export');
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

  const totalRevenue = orders
    .filter(o => o.status !== 'CANCELLED')
    .reduce((sum, o) => sum + Number(o.total_price), 0);
  
  const totalPaidRevenue = orders
    .filter(o => o.status=="PAID")
    .reduce((sum, o) => sum + Number(o.total_price), 0);

  const orderCount = orders.length;
  const paidCount = orders.filter(o => o.status === 'PAID').length;
  const allStatuses = ['PENDING', 'READY', 'PAID', 'CANCELLED'];

  const [expiring, setExpiring] = useState(false);
  const handleExpireOldOrders = async () => {
    if (!window.confirm('Are you sure you want to expire all unfulfilled orders from PREVIOUS days? This will restore their stock items back to inventory.')) return;
    
    setExpiring(true);
    try {
      const res = await fetch('/api/cron/expire-orders');
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message || 'Expired orders successfully');
        fetchOrders(true);
      } else {
        toast.error(data.error || 'Failed to expire orders');
      }
    } catch {
      toast.error('Network error while expiring orders');
    } finally {
      setExpiring(false);
    }
  };

  return (
    <>
      <div className="page-content-admin animate-fade-in" style={{ padding: '32px' }}>
        <div style={{ marginBottom: '32px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: 800 }}>Financial Statements</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Analyze revenue and historical orders. Click any record to view or edit details.</p>
        </div>

        {/* ... (rest of the content remains inside the animated container) */}
        
        {/* I will truncate some parts here but keep the structure */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '32px' }}>
          {/* Summary Cards */}
          <div className="card" style={{ padding: '24px', borderLeft: '4px solid var(--primary)' }}>
            <p className="label" style={{ marginBottom: '8px' }}>Total Revenue</p>
            <h2 style={{ fontSize: '28px', fontWeight: 900, color: 'var(--text-primary)' }}>{formatPrice(totalRevenue)}</h2>
            <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>Exclude cancelled orders</p>
          </div>
          <div className="card" style={{ padding: '24px', borderLeft: '4px solid #059669' }}>
            <p className="label" style={{ marginBottom: '8px' }}>Gross Paid</p>
            <h2 style={{ fontSize: '28px', fontWeight: 900, color: '#059669' }}>{formatPrice(totalPaidRevenue)}</h2>
            <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>Actual collected amount</p>
          </div>
          <div className="card" style={{ padding: '24px', borderLeft: '4px solid var(--info)' }}>
            <p className="label" style={{ marginBottom: '8px' }}>Total Orders</p>
            <h2 style={{ fontSize: '28px', fontWeight: 900, color: 'var(--text-primary)' }}>{orderCount}</h2>
            <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>Received in period</p>
          </div>
          <div className="card" style={{ padding: '24px', borderLeft: '4px solid #6366F1' }}>
            <p className="label" style={{ marginBottom: '8px' }}>Fulfillment</p>
            <h2 style={{ fontSize: '28px', fontWeight: 900, color: '#6366F1' }}>{paidCount}</h2>
            <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>Paid status</p>
          </div>
        </div>

        <div className="card" style={{ padding: '20px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'flex-end' }}>
            <div style={{ flex: '1', minWidth: '140px' }}>
              <label className="label">From Date</label>
              <input type="date" className="input" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ height: '42px' }} />
            </div>
            <div style={{ flex: '1', minWidth: '140px' }}>
              <label className="label">To Date</label>
              <input type="date" className="input" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ height: '42px' }} />
            </div>
            <div style={{ flex: '1', minWidth: '140px' }}>
              <label className="label">Status</label>
              <select className="input" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ height: '42px' }}>
                <option value="">All Statuses</option>
                {allStatuses.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button className="btn" onClick={exportCSV} style={{ height: '42px', background: '#059669', color: 'white', padding: '0 24px' }}>📥 Export Statements (CSV)</button>
              <button 
                className="btn btn-secondary" 
                onClick={handleExpireOldOrders} 
                disabled={expiring}
                style={{ height: '42px', padding: '0 20px', color: 'var(--warning)', borderColor: 'var(--warning)' }}
              >
                {expiring ? 'Expiring...' : '🕖 Expire Old Orders'}
              </button>
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-wrapper" style={{ border: 'none', borderRadius: 0, overflowX: 'auto' }}>
            {loading ? (
              <div style={{ padding: '60px', display: 'flex', justifyContent: 'center' }}><div className="loader" /></div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Ticket</th>
                    <th>Customer</th>
                    <th>Amount</th>
                    <th>Paid</th>
                    <th>Status</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map(order => (
                    <tr key={order.id} onClick={() => setSelectedOrder(order)} style={{ cursor: 'pointer' }}>
                      <td><strong>#{String(order.ticket_number).padStart(3, '0')}</strong></td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{order.customer_name}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{order.phone}</div>
                      </td>
                      <td style={{ fontWeight: 600 }}>{formatPrice(order.total_price)}</td>
                      <td>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: '4px',
                          fontSize: '11px', fontWeight: 700,
                          color: order.status=="PAID"  ? '#059669' : 'var(--warning)',
                          background: order.status=="PAID"  ? 'rgba(5,150,105,0.1)' : 'rgba(255,165,0,0.1)',
                          padding: '2px 8px', borderRadius: 'var(--radius-full)',
                        }}>
                          {order.status=="PAID" ? '✓ PAID' : '⏳ PENDING'}
                        </span>
                      </td>
                      <td><span className={`badge badge-${order.status.toLowerCase()}`}>{order.status}</span></td>
                      <td><div style={{ fontSize: '12px' }}>{formatDateTime(order.created_at).split(',')[0]}</div></td>
                    </tr>
                  ))}
                  {orders.length === 0 && (
                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: '60px', color: 'var(--text-secondary)' }}>No records found for this period</td></tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
          
          <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Showing {orders.length} records in this period</span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn btn-secondary btn-sm" disabled={page === 1} onClick={() => setPage(p => Math.max(1, p - 1))}>← Prev</button>
              <button className="btn btn-secondary btn-sm" disabled={orders.length < 200} onClick={() => setPage(p => p + 1)}>Next →</button>
            </div>
          </div>
        </div>
      </div>

      {selectedOrder && (
        <div className="modal-backdrop" onClick={() => setSelectedOrder(null)} style={{ display: 'flex' }}>
          <div className="modal-desktop" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px', marginTop: '60px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                  <h2 style={{ fontSize: '24px', fontWeight: 900, color: 'var(--primary)' }}>#{String(selectedOrder.ticket_number).padStart(3, '0')}</h2>
                  <span className={`badge badge-${selectedOrder.status.toLowerCase()}`}>{selectedOrder.status}</span>
                </div>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{formatDateTime(selectedOrder.created_at)}</p>
              </div>
              <button onClick={() => setSelectedOrder(null)} className="modal-close-btn">✕</button>
            </div>

            <div className="card" style={{ background: '#F9FAFB', padding: '14px 16px', marginBottom: '20px', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <div><p className="label">CUSTOMER</p><p style={{ fontWeight: 700 }}>{selectedOrder.customer_name}</p></div>
                <div style={{ textAlign: 'right' }}><p className="label">PHONE</p><p style={{ fontWeight: 600 }}>{selectedOrder.phone}</p></div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', paddingTop: '8px', borderTop: '1px solid rgba(0,0,0,0.05)' }}>
                <div><p className="label">TABLE</p><p style={{ fontWeight: 700 }}>{selectedOrder.table_number || 'N/A'}</p></div>
                <div style={{ textAlign: 'right' }}><p className="label">PAYMENT</p><p style={{ fontWeight: 700, color: selectedOrder.is_paid ? '#059669' : 'var(--warning)' }}>{selectedOrder.is_paid ? 'PAID' : 'PENDING'}</p></div>
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <p className="label">ORDER ITEMS</p>
              <div style={{ maxHeight: '30vh', overflowY: 'auto', marginBottom: '12px' }}>
                {selectedOrder.items?.map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', background: 'white', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><span className="qty-badge">{item.quantity}</span><span style={{ fontWeight: 600 }}>{item.product_name}</span></div>
                    <span style={{ fontWeight: 700 }}>{formatPrice(item.price_at_purchase * item.quantity)}</span>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderTop: '2px dashed var(--border)', fontWeight: 800, fontSize: '18px' }}>
                <span>Total Amount</span><span style={{ color: 'var(--primary)' }}>{formatPrice(selectedOrder.total_price)}</span>
              </div>
            </div>
            
            <div style={{ textAlign: 'center' }}>
              <button onClick={() => setSelectedOrder(null)} className="btn btn-secondary" style={{ width: '100%' }}>Close Summary</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
