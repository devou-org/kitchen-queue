'use client';
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Order } from '@/types';
import { formatPrice, formatDateTime } from '@/lib/format';

export default function AdminOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [currentTab, setCurrentTab] = useState<'ACTIVE' | 'HISTORY'>('ACTIVE');

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ page: page.toString(), per_page: '50' });
      if (statusFilter) qs.append('status', statusFilter);
      
      const ordersRes = await fetch(`/api/orders?${qs.toString()}`);
      const ordersData = await ordersRes.json();

      if (ordersData.success) {
        setOrders(ordersData.data);
      }
    } catch {
      toast.error('Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();

    const es = new EventSource('/api/queue/stream');
    es.onmessage = (e) => {
      const event = JSON.parse(e.data);
      if (event.type === 'new_order' || event.type === 'order_update') {
        fetchOrders();
      }
    };
    return () => es.close();
  }, [page, statusFilter]);

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/orders/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Order status updated to ${newStatus}`);
        fetchOrders();
      } else {
        toast.error(data.error || 'Failed to update');
      }
    } catch {
      toast.error('Network error');
    }
  };

  const handlePaidToggle = async (id: string, isPaid: boolean) => {
    try {
      const res = await fetch(`/api/orders/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_paid: isPaid })
      });
      const data = await res.json();
      if (data.success) {
        toast.success(isPaid ? 'Marked as Paid' : 'Marked as Unpaid');
        fetchOrders();
      } else {
        toast.error(data.error || 'Failed to update payment');
      }
    } catch {
      toast.error('Network error');
    }
  };

  const exportStatementsCSV = () => {
    const headers = ['Ticket', 'Customer', 'Phone', 'Items', 'Total', 'Paid', 'Status', 'Date'];
    const rows = filteredOrders.map(order => [
      `#${String(order.ticket_number).padStart(3, '0')}`,
      `"${order.customer_name}"`,
      `"${order.phone}"`,
      order.items?.length || 0,
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
    link.setAttribute("download", `Order_Statements_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const allStatuses = ['PENDING', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED'];

  // Filter based on Tab
  const tabStatuses = currentTab === 'ACTIVE' 
    ? ['PENDING', 'PREPARING', 'READY']
    : ['COMPLETED', 'CANCELLED'];

  const filteredOrders = orders.filter(
    order => tabStatuses.includes(order.status) && (!statusFilter || order.status === statusFilter)
  );

  return (
    <div className="page-content-admin animate-fade-in" style={{ padding: '32px' }}>
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 800 }}>Orders Command Center</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Manage live fulfillment, filter transactions, and download monthly statements.</p>
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
          className={`btn ${currentTab === 'HISTORY' ? 'btn-primary' : ''}`}
          style={currentTab !== 'HISTORY' ? { background: 'var(--bg)', color: 'var(--text-primary)' } : {}}
          onClick={() => { setCurrentTab('HISTORY'); setStatusFilter(''); setPage(1); }}
        >
          🕒 History & Statements
        </button>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <select 
            className="select" 
            value={statusFilter} 
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            style={{ maxWidth: '200px' }}
          >
            <option value="">All in {currentTab}</option>
            {tabStatuses.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          
          {currentTab === 'HISTORY' && (
            <button className="btn" style={{ background: '#059669', color: 'white' }} onClick={exportStatementsCSV}>
              📥 Download Statement (CSV)
            </button>
          )}
        </div>

        <div className="table-wrapper" style={{ border: 'none', borderRadius: 0, overflowX: 'auto', minHeight: '400px' }}>
          {loading ? (
            <div style={{ padding: '60px', display: 'flex', justifyContent: 'center' }}><div className="loader"/></div>
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
                  <tr key={order.id}>
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
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 600, color: order.is_paid ? '#059669' : 'var(--text-secondary)' }}>
                        <input 
                          type="checkbox" 
                          checked={order.is_paid} 
                          onChange={(e) => handlePaidToggle(order.id, e.target.checked)}
                          style={{ accentColor: '#059669', width: '16px', height: '16px', cursor: 'pointer' }}
                        />
                        {order.is_paid ? 'PAID' : 'PENDING'}
                      </label>
                    </td>
                    <td>
                      <span className={`badge badge-${order.status.toLowerCase()}`}>
                        {order.status}
                      </span>
                    </td>
                    <td>
                      <select 
                        className="select" 
                        style={{ height: '32px', padding: '0 10px', fontSize: '13px', minWidth: '130px' }}
                        value={order.status}
                        onChange={(e) => handleStatusChange(order.id, e.target.value)}
                      >
                        {allStatuses.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
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
    </div>
  );
}
