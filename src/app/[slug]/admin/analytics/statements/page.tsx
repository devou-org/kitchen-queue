'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { Order } from '@/types';
import { formatPrice, formatDateTime, getCurrentBusinessDate } from '@/lib/format';
import { AdminContentWrapper } from '@/components/AdminContentWrapper';
import { AdminPageHeader } from '@/components/AdminPageHeader';
import { AnalyticsNav } from '@/components/modules/analytics/AnalyticsNav';
import { Download, Clock, Receipt } from 'lucide-react';
import { orderService } from '@/app/services/orders.api';
import { useRestaurant } from '@/hooks/useRestaurant';
import BillTemplate from '@/components/BillTemplate';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { Pagination } from '@/components/ui/Pagination';

export default function AdminAnalyticsStatementsPage() {
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
        payment_method: paymentMethodFilter || undefined,
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
    const rows = orders.map((order) => [
      `#${String(order.ticket_number).padStart(3, '0')}`,
      `"${order.customer_name}"`,
      `"${order.phone}"`,
      `"${(order.items || []).map((i) => `${i.product_name} (x${i.quantity})`).join('; ')}"`,
      order.total_price,
      order.is_paid ? `PAID${order.payment_method ? ` (${order.payment_method})` : ''}` : 'PENDING',
      order.status,
      `"${formatDateTime(order.created_at)}"`,
    ]);

    const csvContent = headers.join(',') + '\n' + rows.map((e) => e.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Statements_${dateFrom}_to_${dateTo}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const {
    totalRevenue,
    totalPaidRevenue,
    orderCount,
    paidCount,
    totalRegularSubtotal,
    totalRegularGst,
    totalCompositionRevenue,
    totalCompositionGst,
    totalNoneRevenue,
  } = stats as any;

  const actualRevenue =
    (totalRegularSubtotal || 0) + (totalCompositionRevenue || 0) + (totalNoneRevenue || 0) || totalRevenue;
  const gstCollected = totalRegularGst || 0;
  const gstPayable = totalCompositionGst || 0;
  const netRevenue = actualRevenue - gstPayable;

  const allStatuses = ['PENDING', 'PREPARING', 'READY', 'PAID', 'CANCELLED'];

  const [expiring, setExpiring] = useState(false);
  const handleExpireOldOrders = async () => {
    if (
      !window.confirm(
        'Are you sure you want to expire all unfulfilled orders from PREVIOUS days? This will restore their stock items back to inventory.'
      )
    )
      return;

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
          title="Analytics"
          subtitle="Financial statements, GST breakdowns, collections ledgers, and order audits."
        />

        {/* Header Sub Buttons (AnalyticsNav) */}
        <AnalyticsNav />

        {/* Date Range Filter */}
        <div
          className="card"
          style={{
            marginBottom: '20px',
            display: 'flex',
            gap: '16px',
            alignItems: 'flex-end',
            flexWrap: 'wrap',
            borderRadius: '12px',
          }}
        >
          <div>
            <label className="label">From</label>
            <input
              type="date"
              className="input"
              value={dateFrom}
              max={dateTo}
              onChange={(e) => setDateFrom(e.target.value)}
              style={{ width: '160px' }}
            />
          </div>
          <div>
            <label className="label">To</label>
            <input
              type="date"
              className="input"
              value={dateTo}
              min={dateFrom}
              onChange={(e) => setDateTo(e.target.value)}
              style={{ width: '160px' }}
            />
          </div>
          <div style={{ minWidth: '160px' }}>
            <label className="label">Status</label>
            <CustomSelect
              value={statusFilter}
              onChange={(val) => setStatusFilter(val)}
              options={[
                { value: '', label: 'All Statuses' },
                ...allStatuses.map((s) => ({ value: s, label: s })),
              ]}
              style={{ width: '160px' }}
            />
          </div>
          <div style={{ minWidth: '140px' }}>
            <label className="label">Payment</label>
            <CustomSelect
              value={paymentMethodFilter}
              onChange={(val) => setPaymentMethodFilter(val)}
              options={[
                { value: '', label: 'All Methods' },
                { value: 'UPI', label: 'UPI' },
                { value: 'CASH', label: 'Cash' },
                { value: 'CARD', label: 'Card' },
              ]}
              style={{ width: '140px' }}
            />
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', flex: 1, justifyContent: 'flex-end' }}>
            <button
              className="btn btn-ghost"
              onClick={exportCSV}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                color: '#059669',
                background: 'rgba(5, 150, 105, 0.1)',
              }}
            >
              <Download size={16} /> Export (CSV)
            </button>
            <button
              className="btn btn-ghost"
              onClick={handleExpireOldOrders}
              disabled={expiring}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                color: '#DC2626',
                background: 'rgba(220, 38, 38, 0.1)',
              }}
            >
              <Clock size={16} /> {expiring ? 'Expiring...' : 'Expire Old'}
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '16px',
            marginBottom: '24px',
          }}
        >
          <div className="stat-card" style={{ borderLeftColor: 'var(--text-primary)' }}>
            <p className="stat-label">Total Revenue</p>
            <h3 className="stat-value" style={{ color: 'var(--text-primary)' }}>
              {formatPrice(totalRevenue)}
            </h3>
            <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>Revenue + GST</p>
          </div>
          <div className="stat-card">
            <p className="stat-label">Net Revenue</p>
            <h3 className="stat-value" style={{ color: 'var(--primary)' }}>
              {formatPrice(restaurant?.gst_type === 'COMPOSITION' ? netRevenue : actualRevenue)}
            </h3>
            <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              {restaurant?.gst_type === 'COMPOSITION'
                ? 'After GST Payable Deduction'
                : 'Excluding Cancelled'}
            </p>
          </div>

          {restaurant?.gst_type === 'REGULAR' && (
            <div className="stat-card" style={{ borderLeftColor: '#059669' }}>
              <p className="stat-label">GST Collected</p>
              <h3 className="stat-value" style={{ color: '#059669' }}>
                {formatPrice(gstCollected)}
              </h3>
              <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                On behalf of Govt
              </p>
            </div>
          )}

          {restaurant?.gst_type === 'COMPOSITION' && (
            <div className="stat-card" style={{ borderLeftColor: '#EAB308' }}>
              <p className="stat-label">GST Payable</p>
              <h3 className="stat-value" style={{ color: '#EAB308' }}>
                {formatPrice(gstPayable)}
              </h3>
              <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Deducted from Revenue
              </p>
            </div>
          )}

          {restaurant?.gst_type === 'NONE' && (
            <div className="stat-card" style={{ borderLeftColor: '#6B7280' }}>
              <p className="stat-label">GST</p>
              <h3 className="stat-value" style={{ color: '#6B7280' }}>
                {formatPrice(0)}
              </h3>
              <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                No GST applicable
              </p>
            </div>
          )}
        </div>

        {/* Collections & Orders Count Cards */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '16px',
            marginBottom: '24px',
          }}
        >
          <div className="stat-card" style={{ borderLeftColor: '#059669' }}>
            <p className="stat-label">Gross Paid</p>
            <h3 className="stat-value" style={{ color: '#059669' }}>
              {formatPrice(totalPaidRevenue)}
            </h3>
            <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Actual collected amount
            </p>
          </div>
          <div className="stat-card" style={{ borderLeftColor: 'var(--text-primary)' }}>
            <p className="stat-label">Total Orders</p>
            <h3 className="stat-value" style={{ color: 'var(--text-primary)' }}>
              {orderCount}
            </h3>
            <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Received in period
            </p>
          </div>
          <div className="stat-card" style={{ borderLeftColor: '#6366F1' }}>
            <p className="stat-label">Fulfillment</p>
            <h3 className="stat-value" style={{ color: '#6366F1' }}>
              {paidCount}
            </h3>
            <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Paid status
            </p>
          </div>
        </div>

        {/* Orders Table */}
        <div className="card" style={{ padding: 0, overflow: 'hidden', borderRadius: '12px' }}>
          <div className="table-wrapper" style={{ border: 'none', borderRadius: 0, overflowX: 'auto' }}>
            {loading ? (
              <div style={{ padding: '60px', display: 'flex', justifyContent: 'center' }}>
                <div className="loader" style={{ width: 40, height: 40, borderWidth: 4 }} />
              </div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Ticket</th>
                    <th>Customer</th>
                    <th>Items</th>
                    <th style={{ textAlign: 'right' }}>Total</th>
                    <th style={{ textAlign: 'center' }}>Payment</th>
                    <th style={{ textAlign: 'center' }}>Status</th>
                    <th>Date & Time</th>
                    <th style={{ textAlign: 'center' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr
                      key={order.id}
                      onClick={() => {
                        setSelectedOrder(order);
                        setShowBill(false);
                      }}
                      style={{ cursor: 'pointer' }}
                    >
                      <td style={{ fontWeight: 800, color: 'var(--primary)' }}>
                        #{String(order.ticket_number).padStart(3, '0')}
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{order.customer_name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{order.phone}</div>
                      </td>
                      <td>
                        <div style={{ maxWidth: '300px', fontSize: '12px' }}>
                          {(order.items || []).map((i) => `${i.product_name} (x${i.quantity})`).join(', ')}
                        </div>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>
                        {formatPrice(order.total_price)}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {order.is_paid ? (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: 700,
                              background: '#ECFDF5',
                              color: '#059669',
                            }}
                          >
                            PAID {order.payment_method ? `(${order.payment_method})` : ''}
                          </span>
                        ) : (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: 700,
                              background: '#FEF2F2',
                              color: '#DC2626',
                            }}
                          >
                            PENDING
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span
                          className={`badge ${
                            order.status === 'PAID'
                              ? 'badge-available'
                              : order.status === 'CANCELLED'
                              ? 'badge-out-of-stock'
                              : 'badge-low-stock'
                          }`}
                        >
                          {order.status}
                        </span>
                      </td>
                      <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                        {formatDateTime(order.created_at)}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          className="btn-ghost"
                          style={{
                            padding: '6px 10px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '12px',
                            cursor: 'pointer',
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedOrder(order);
                            setShowBill(true);
                          }}
                        >
                          <Receipt size={14} /> Bill
                        </button>
                      </td>
                    </tr>
                  ))}
                  {orders.length === 0 && (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                        No statements or orders found matching the filter criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
          {!loading && orders.length >= 200 && (
            <div style={{ padding: '16px', borderTop: '1px solid var(--border)' }}>
              <Pagination
                currentPage={page}
                totalPages={Math.ceil(orders.length / 50)}
                onPageChange={(p) => setPage(p)}
                pageSize={50}
                totalRecords={orders.length}
              />
            </div>
          )}
        </div>
      </AdminContentWrapper>

      {/* Order Summary Modal */}
      {selectedOrder && !showBill && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '20px',
          }}
          onClick={() => setSelectedOrder(null)}
        >
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: '18px',
              maxWidth: '460px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '24px',
              position: 'relative',
              boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h2 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--primary, #EA580C)', margin: 0 }}>
                  #{String(selectedOrder.ticket_number).padStart(3, '0')}
                </h2>
                <span
                  className={`badge ${
                    selectedOrder.status === 'PAID'
                      ? 'badge-available'
                      : selectedOrder.status === 'CANCELLED'
                      ? 'badge-out-of-stock'
                      : 'badge-low-stock'
                  }`}
                  style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase' }}
                >
                  {selectedOrder.status}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                style={{
                  cursor: 'pointer',
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--text-secondary, #64748B)',
                  fontSize: '20px',
                  lineHeight: 1,
                  padding: '4px',
                }}
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: '13px', color: 'var(--text-secondary, #64748B)', margin: '0 0 18px 0', fontWeight: 400 }}>
              {formatDateTime(selectedOrder.created_at)}
            </p>

            {/* Info Box */}
            <div
              style={{
                backgroundColor: '#F8FAFC',
                borderRadius: '18px',
                padding: '16px',
                border: '1px solid #F1F5F9',
                marginBottom: '20px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <p style={{ fontSize: '11px', fontWeight: 600, color: '#64748B', margin: '0 0 3px 0', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    CUSTOMER
                  </p>
                  <p style={{ fontWeight: 600, fontSize: '14px', color: '#0F172A', margin: 0 }}>
                    {selectedOrder.customer_name || 'Takeaway Customer'}
                  </p>
                </div>
                {selectedOrder.staff_name && (
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: '11px', fontWeight: 600, color: '#64748B', margin: '0 0 3px 0', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      TAKEN BY
                    </p>
                    <p style={{ fontWeight: 600, fontSize: '14px', color: 'var(--primary, #EA580C)', margin: 0 }}>
                      {selectedOrder.staff_name.split(' ')[0]}
                    </p>
                  </div>
                )}
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: '11px', fontWeight: 600, color: '#64748B', margin: '0 0 3px 0', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    PHONE
                  </p>
                  <p style={{ fontWeight: 500, fontSize: '14px', color: '#0F172A', margin: 0 }}>
                    {selectedOrder.phone || 'N/A'}
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '10px', borderTop: '1px solid #E2E8F0' }}>
                <div>
                  <p style={{ fontSize: '11px', fontWeight: 600, color: '#64748B', margin: '0 0 3px 0', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    TABLE
                  </p>
                  <p style={{ fontWeight: 600, fontSize: '14px', color: '#0F172A', margin: 0 }}>
                    {selectedOrder.table_number || 'N/A'}
                  </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: '11px', fontWeight: 600, color: '#64748B', margin: '0 0 3px 0', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    PAYMENT
                  </p>
                  <p
                    style={{
                      fontWeight: 600,
                      fontSize: '14px',
                      color: (selectedOrder.status === 'PAID' || selectedOrder.is_paid) ? '#059669' : 'var(--primary, #EA580C)',
                      margin: 0,
                    }}
                  >
                    {(selectedOrder.status === 'PAID' || selectedOrder.is_paid)
                      ? (selectedOrder.payment_method ? `PAID (${selectedOrder.payment_method})` : 'PAID')
                      : 'PENDING'}
                  </p>
                </div>
              </div>
            </div>

            {/* Order Items */}
            <div style={{ marginBottom: '20px' }}>
              <p style={{ fontSize: '11px', fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 10px 0' }}>
                ORDER ITEMS
              </p>
              <div style={{ maxHeight: '220px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {(selectedOrder.items || []).map((item: any, idx: number) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '10px 14px',
                      backgroundColor: '#FFFFFF',
                      borderRadius: '18px',
                      border: '1px solid #E2E8F0',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontWeight: 500, color: 'var(--text-secondary, #64748B)', minWidth: '16px' }}>
                        {item.quantity}
                      </span>
                      <span style={{ fontWeight: 500, color: '#0F172A', fontSize: '13px' }}>
                        {item.product_name || item.name}
                      </span>
                    </div>
                    <span style={{ fontWeight: 600, color: '#0F172A', fontSize: '14px' }}>
                      {formatPrice((item.price_at_purchase || item.price || 0) * (item.quantity || 1))}
                    </span>
                  </div>
                ))}
              </div>

              {/* Total Amount */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingTop: '14px',
                  marginTop: '12px',
                  borderTop: '2px dotted #CBD5E1',
                }}
              >
                <span style={{ fontWeight: 600, fontSize: '15px', color: '#0F172A' }}>Total Amount</span>
                <span style={{ fontWeight: 700, fontSize: '17px', color: 'var(--primary, #EA580C)' }}>
                  {formatPrice(selectedOrder.total_price)}
                </span>
              </div>
            </div>

            {/* Bottom Action Buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {(selectedOrder.status === 'PAID' || selectedOrder.is_paid) && (
                <button
                  type="button"
                  onClick={() => setShowBill(true)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    padding: '11px',
                    borderRadius: '18px',
                    backgroundColor: '#FFFFFF',
                    color: 'var(--primary, #EA580C)',
                    border: '1px solid #E2E8F0',
                    fontWeight: 600,
                    fontSize: '13px',
                    cursor: 'pointer',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                  }}
                >
                  <Receipt size={16} /> Print Bill
                </button>
              )}
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                style={{
                  width: '100%',
                  padding: '11px',
                  borderRadius: '18px',
                  border: '1.5px solid var(--primary, #EA580C)',
                  backgroundColor: '#FFFFFF',
                  color: 'var(--primary, #EA580C)',
                  fontWeight: 600,
                  fontSize: '14px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                Close Summary
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bill Modal */}
      {showBill && selectedOrder && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '20px',
          }}
          onClick={() => setShowBill(false)}
        >
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: '12px',
              maxWidth: '420px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '20px',
              position: 'relative',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 800, margin: 0 }}>Tax Invoice / Bill</h3>
              <button
                className="btn-ghost"
                onClick={() => setShowBill(false)}
                style={{ fontSize: '20px', cursor: 'pointer', border: 'none', background: 'transparent' }}
              >
                ✕
              </button>
            </div>
            {restaurant && (
              <BillTemplate
                order={selectedOrder}
                restaurant={restaurant}
                onClose={() => setShowBill(false)}
              />
            )}
          </div>
        </div>
      )}
    </>
  );
}

