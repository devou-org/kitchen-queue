'use client';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { Order } from '@/types';
import { formatPrice, formatDateTime, getCurrentBusinessDate } from '@/lib/format';
import { AdminContentWrapper } from '@/components/AdminContentWrapper';
import { AdminPageHeader } from '@/components/AdminPageHeader';
import { Download, Clock, User, Hourglass, Check, Receipt } from 'lucide-react';
import { orderService } from '@/app/services/orders.api';
import { useRestaurant } from '@/hooks/useRestaurant';
import BillTemplate from '@/components/BillTemplate';

export default function AdminStatements() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showBill, setShowBill] = useState(false);
  const [stats, setStats] = useState({ totalRevenue: 0, totalPaidRevenue: 0, orderCount: 0, paidCount: 0 });

  const { slug } = useParams();
  const { restaurant } = useRestaurant();

  useEffect(() => {
    if (restaurant && !dateFrom && !dateTo) {
      const bDate = getCurrentBusinessDate(restaurant.timezone, restaurant.rollover_time);
      setDateFrom(bDate);
      setDateTo(bDate);
    }
  }, [restaurant, dateFrom, dateTo]);

  const fetchOrders = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await orderService.getOrders({
        page,
        per_page: 200,
        sort: 'DESC',
        date_from: dateFrom,
        date_to: dateTo,
        status: statusFilter || undefined,
        payment_method: paymentMethodFilter || undefined
      });

      if (res.success) {
        setOrders(res.data || []);
        if ((res as any).stats) {
          setStats((res as any).stats);
        }
      }
    } catch {
      toast.error('Failed to load statements');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    if (dateFrom && dateTo) {
      fetchOrders();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFrom, dateTo, statusFilter, paymentMethodFilter, page]);

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
      order.is_paid ? `PAID${order.payment_method ? ` (${order.payment_method})` : ''}` : 'PENDING',
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

  const { totalRevenue, totalPaidRevenue, orderCount, paidCount, totalRegularSubtotal, totalRegularGst, totalCompositionRevenue, totalCompositionGst, totalNoneRevenue } = stats as any;

  const actualRevenue = (totalRegularSubtotal || 0) + (totalCompositionRevenue || 0) + (totalNoneRevenue || 0) || totalRevenue;
  const gstCollected = totalRegularGst || 0;
  const gstPayable = totalCompositionGst || 0;
  const netRevenue = actualRevenue - gstPayable;

  const allStatuses = ['PENDING', 'PREPARING', 'READY', 'PAID', 'CANCELLED'];

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
      <AdminContentWrapper>
        <AdminPageHeader
          title="Financial Statements"
          description="Analyze revenue and historical orders. Click any record to view or edit details."
        />

        {/* Date Range Filter */}
        <div className="card" style={{ marginBottom: '20px', display: 'flex', gap: '16px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div>
            <label className="label">From</label>
            <input type="date" className="input" value={dateFrom} max={dateTo} onChange={e => setDateFrom(e.target.value)} style={{ width: '160px' }} />
          </div>
          <div>
            <label className="label">To</label>
            <input type="date" className="input" value={dateTo} min={dateFrom} onChange={e => setDateTo(e.target.value)} style={{ width: '160px' }} />
          </div>
          <div>
            <label className="label">Status</label>
            <select className="select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ width: '160px' }}>
              <option value="">All Statuses</option>
              {allStatuses.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Payment</label>
            <select className="select" value={paymentMethodFilter} onChange={e => setPaymentMethodFilter(e.target.value)} style={{ width: '140px' }}>
              <option value="">All Methods</option>
              <option value="UPI">UPI</option>
              <option value="CASH">Cash</option>
              <option value="CARD">Card</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', flex: 1, justifyContent: 'flex-end' }}>
            <button className="btn btn-ghost" onClick={exportCSV} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: '#059669', background: 'rgba(5, 150, 105, 0.1)' }}>
              <Download size={16} /> Export (CSV)
            </button>
            <button
              className="btn btn-ghost"
              onClick={handleExpireOldOrders}
              disabled={expiring}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: '#DC2626', background: 'rgba(220, 38, 38, 0.1)' }}
            >
              <Clock size={16} /> {expiring ? 'Expiring...' : 'Expire Old'}
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          <div className="stat-card" style={{ borderLeftColor: 'var(--text-primary)' }}>
            <p className="stat-label">Total Revenue</p>
            <h3 className="stat-value" style={{ color: 'var(--text-primary)' }}>{formatPrice(totalRevenue)}</h3>
            <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>Revenue + GST</p>
          </div>
          <div className="stat-card">
            <p className="stat-label">Net Revenue</p>
            <h3 className="stat-value" style={{ color: 'var(--primary)' }}>{formatPrice(restaurant?.gst_type === 'COMPOSITION' ? netRevenue : actualRevenue)}</h3>
            <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>{restaurant?.gst_type === 'COMPOSITION' ? 'After GST Payable Deduction' : 'Excluding Cancelled'}</p>
          </div>

          {restaurant?.gst_type === 'REGULAR' && (
            <div className="stat-card" style={{ borderLeftColor: '#059669' }}>
              <p className="stat-label">GST Collected</p>
              <h3 className="stat-value" style={{ color: '#059669' }}>{formatPrice(gstCollected)}</h3>
              <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>On behalf of Govt</p>
            </div>
          )}

          {restaurant?.gst_type === 'COMPOSITION' && (
            <div className="stat-card" style={{ borderLeftColor: '#EAB308' }}>
              <p className="stat-label">GST Payable</p>
              <h3 className="stat-value" style={{ color: '#EAB308' }}>{formatPrice(gstPayable)}</h3>
              <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>Deducted from Revenue</p>
            </div>
          )}

          {restaurant?.gst_type === 'NONE' && (
            <div className="stat-card" style={{ borderLeftColor: '#6B7280' }}>
              <p className="stat-label">GST</p>
              <h3 className="stat-value" style={{ color: '#6B7280' }}>{formatPrice(0)}</h3>
              <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>No GST applicable</p>
            </div>
          )}

          {/* <div className="stat-card" style={{ borderLeftColor: 'var(--text-primary)' }}>
            <p className="stat-label">Net Revenue</p>
            <h3 className="stat-value" style={{ color: 'var(--text-primary)' }}>{formatPrice(netRevenue)}</h3>
            <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>Final retained earnings</p>
          </div> */}


        </div>

        {/* Summary Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          {/* <div className="stat-card">
            <p className="stat-label">Total Revenue</p>
            <h3 className="stat-value" style={{ color: 'var(--primary)' }}>{formatPrice(totalRevenue)}</h3>
            <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>Exclude cancelled orders</p>
          </div> */}
          <div className="stat-card" style={{ borderLeftColor: '#059669' }}>
            <p className="stat-label">Gross Paid</p>
            <h3 className="stat-value" style={{ color: '#059669' }}>{formatPrice(totalPaidRevenue)}</h3>
            <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>Actual collected amount</p>
          </div>
          <div className="stat-card" style={{ borderLeftColor: 'var(--text-primary)' }}>
            <p className="stat-label">Total Orders</p>
            <h3 className="stat-value" style={{ color: 'var(--text-primary)' }}>{orderCount}</h3>
            <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>Received in period</p>
          </div>
          <div className="stat-card" style={{ borderLeftColor: '#6366F1' }}>
            <p className="stat-label">Fulfillment</p>
            <h3 className="stat-value" style={{ color: '#6366F1' }}>{paidCount}</h3>
            <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>Paid status</p>
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
                        {order.staff_name && (
                          <div style={{ fontSize: '10px', color: 'white', background: '#64748b', display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 6px', borderRadius: '4px', marginTop: '4px', fontWeight: 700 }}>
                            <User size={12} /> {order.staff_name.split(' ')[0]}
                          </div>
                        )}
                      </td>
                      <td style={{ fontWeight: 600 }}>{formatPrice(order.total_price)}</td>
                      <td>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: '4px',
                          fontSize: '11px', fontWeight: 700,
                          color: order.status == "PAID" ? '#059669' : 'var(--warning)',
                          background: order.status == "PAID" ? 'rgba(5,150,105,0.1)' : 'rgba(255,165,0,0.1)',
                          padding: '2px 8px', borderRadius: 'var(--radius-full)',
                        }}>
                          {order.status == "PAID" ? <><Check size={12} strokeWidth={3} /> PAID {order.payment_method ? `(${order.payment_method})` : ''}</> : <><Hourglass size={12} strokeWidth={2.5} /> PENDING</>}
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

          <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
            <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Showing {orders.length} records in this period</span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn btn-secondary btn-sm" disabled={page === 1} onClick={() => setPage(p => Math.max(1, p - 1))}>← Prev</button>
              <button className="btn btn-secondary btn-sm" disabled={orders.length < 200} onClick={() => setPage(p => p + 1)}>Next →</button>
            </div>
          </div>
        </div>
      </AdminContentWrapper>

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
                {selectedOrder.staff_name && (
                  <div style={{ textAlign: 'center' }}><p className="label">TAKEN BY</p><p style={{ fontWeight: 600, color: 'var(--primary)' }}>{selectedOrder.staff_name.split(' ')[0]}</p></div>
                )}
                <div style={{ textAlign: 'right' }}><p className="label">PHONE</p><p style={{ fontWeight: 600 }}>{selectedOrder.phone}</p></div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', paddingTop: '8px', borderTop: '1px solid rgba(0,0,0,0.05)' }}>
                <div><p className="label">TABLE</p><p style={{ fontWeight: 700 }}>{selectedOrder.table_number || 'N/A'}</p></div>
                <div style={{ textAlign: 'right' }}>
                  <p className="label">PAYMENT</p>
                  <p style={{ fontWeight: 700, color: (selectedOrder.status === 'PAID' || selectedOrder.is_paid) ? '#059669' : 'var(--warning)' }}>
                    {(selectedOrder.status === 'PAID' || selectedOrder.is_paid) ? `PAID ${selectedOrder.payment_method ? `(${selectedOrder.payment_method})` : ''}` : 'PENDING'}
                  </p>
                </div>
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
            <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {(selectedOrder.status === 'PAID' || selectedOrder.is_paid) && (
                <button
                  onClick={() => setShowBill(true)}
                  className="btn"
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px',
                    padding: '12px',
                    background: 'white',
                    color: 'var(--primary)',
                    border: '1px solid var(--border)',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                  }}
                >
                  <Receipt size={18} />
                  Print Bill
                </button>
              )}
              <button onClick={() => setSelectedOrder(null)} className="btn btn-secondary" style={{ width: '100%' }}>Close Summary</button>
            </div>
          </div>
        </div>
      )}

      {/* Bill Template Modal */}
      {showBill && selectedOrder && restaurant && (
        <BillTemplate
          order={selectedOrder}
          restaurant={{
            name: restaurant.name,
            logo_url: restaurant.logo_url,
            address: restaurant.address,
            phone: restaurant.phone,
            primary_color: restaurant.primary_color,
            gst_number: restaurant.gst_number,
          }}
          onClose={() => setShowBill(false)}
        />
      )}
    </>
  );
}
