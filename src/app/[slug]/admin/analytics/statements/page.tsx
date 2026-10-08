'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { Order } from '@/types';
import { formatPrice, formatDateTime, getCurrentBusinessDate } from '@/lib/format';
import { AdminContentWrapper } from '@/components/AdminContentWrapper';
import { AdminPageHeader } from '@/components/AdminPageHeader';
import { AnalyticsNav } from '@/components/modules/analytics/AnalyticsNav';
import { Download, Clock, Receipt, Search, X, MoveHorizontal } from 'lucide-react';
import { orderService } from '@/app/services/orders.api';
import { useRestaurant } from '@/hooks/useRestaurant';
import BillTemplate from '@/components/BillTemplate';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { Pagination } from '@/components/ui/Pagination';
import { LayoutMaximizeToggle } from '@/components/LayoutMaximizeToggle';

export default function AdminAnalyticsStatementsPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
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
        'Are you sure you want to process unfulfilled orders from PREVIOUS days? Paid orders will be marked CLOSED, and unpaid orders will be marked EXPIRED (restoring their stock items back to inventory).'
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

  const filteredOrders = orders.filter((order) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const ticket = String(order.ticket_number || '').toLowerCase();
    const customer = (order.customer_name || '').toLowerCase();
    const phone = (order.phone || '').toLowerCase();
    const items = (order.items || []).map((i) => i.product_name).join(' ').toLowerCase();
    return ticket.includes(q) || customer.includes(q) || phone.includes(q) || items.includes(q);
  });

  return (
    <>
      <AdminContentWrapper fullWidth style={{ paddingTop: 0, paddingLeft: 0, paddingRight: 0, maxWidth: '100%' }}>
        <style>{`
          .analytics-page-header,
          .analytics-page-header.admin-page-header-container {
            height: 68px !important;
            min-height: 68px !important;
            display: flex !important;
            align-items: stretch !important;
            margin: 0 !important;
            padding: 0 20px 0 0 !important;
            border-bottom: 1px solid var(--border) !important;
            background: #FFFFFF !important;
            box-sizing: border-box !important;
            position: relative !important;
          }

          .analytics-page-header .admin-page-header-container {
            height: 68px !important;
            min-height: 68px !important;
            display: flex !important;
            align-items: stretch !important;
            margin: 0 !important;
            padding: 0 !important;
            gap: 12px !important;
            width: 100% !important;
          }

          .analytics-page-header .admin-header-left,
          .analytics-page-header .admin-header-search {
            height: 68px !important;
            display: flex !important;
            align-items: stretch !important;
            flex-wrap: nowrap !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          .analytics-toolbar {
            display: flex !important;
            flex-wrap: nowrap !important;
            align-items: stretch !important;
            justify-content: space-between !important;
            gap: 12px !important;
            width: 100% !important;
            height: 68px !important;
            min-width: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          .analytics-tabs-wrapper {
            display: flex !important;
            align-items: stretch !important;
            height: 68px !important;
            min-height: 68px !important;
            padding-top: 10px !important;
            padding-right: 0 !important;
            padding-bottom: 0 !important;
            padding-left: 0 !important;
            box-sizing: border-box !important;
            flex-shrink: 0 !important;
            margin: 0 !important;
          }

          .statements-filter-bar {
            background: #FFFFFF;
            border-bottom: 1px solid var(--border);
            padding: 12px 24px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            flex-wrap: wrap;
            width: 100%;
            box-sizing: border-box;
          }

          .analytics-filters {
            display: flex !important;
            flex-wrap: nowrap !important;
            align-items: center !important;
            gap: 8px !important;
            min-width: 0 !important;
          }

          .analytics-actions {
            display: flex !important;
            flex-wrap: nowrap !important;
            align-items: center !important;
            gap: 8px !important;
            margin-left: auto !important;
            flex-shrink: 0 !important;
            height: 68px !important;
          }

          .statements-kpi-grid {
            display: grid !important;
            grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
            gap: 12px !important;
          }

          @media (min-width: 1400px) {
            .statements-kpi-grid {
              grid-template-columns: repeat(6, minmax(0, 1fr)) !important;
            }
          }

          .statements-scroll-hint {
            display: none !important;
          }

          @media (max-width: 768px) {
            .analytics-page-header,
            .analytics-page-header.admin-page-header-container {
              height: auto !important;
              min-height: auto !important;
              padding: 0 !important;
              margin: 0 !important;
              display: flex !important;
              flex-direction: column !important;
              align-items: stretch !important;
              border-bottom: 1px solid var(--border) !important;
              background: #FFFFFF !important;
            }

            .analytics-page-header .admin-page-header-container,
            .analytics-page-header .admin-header-left,
            .analytics-page-header .admin-header-search {
              height: auto !important;
              min-height: auto !important;
              width: 100% !important;
              display: flex !important;
              flex-direction: column !important;
              align-items: stretch !important;
              padding: 0 !important;
              margin: 0 !important;
            }

            .analytics-toolbar {
              flex-direction: column !important;
              align-items: stretch !important;
              gap: 0 !important;
              height: auto !important;
              min-height: auto !important;
              width: 100% !important;
              padding: 0 !important;
              margin: 0 !important;
            }

            .analytics-tabs-wrapper {
              width: 100% !important;
              height: 44px !important;
              min-height: 44px !important;
              padding: 0 !important;
              border-bottom: 1px solid var(--border) !important;
              box-sizing: border-box !important;
              background: #FFFFFF !important;
            }

            .analytics-actions {
              width: 100% !important;
              height: auto !important;
              min-height: auto !important;
              margin-left: 0 !important;
              padding: 10px 14px !important;
              background: #F8FAFC !important;
              border-bottom: 1px solid var(--border) !important;
              box-sizing: border-box !important;
              display: flex !important;
              align-items: center !important;
            }

            .analytics-filters {
              width: 100% !important;
              display: grid !important;
              grid-template-columns: 1fr 1fr !important;
              gap: 8px !important;
              align-items: center !important;
            }

            .analytics-date-field {
              display: flex !important;
              align-items: center !important;
              gap: 6px !important;
              width: 100% !important;
              min-width: 0 !important;
            }

            .analytics-date-input {
              width: 100% !important;
              min-width: 0 !important;
              height: 36px !important;
              box-sizing: border-box !important;
              padding: 0 8px !important;
              font-size: 12px !important;
            }

            .analytics-maximize-wrapper {
              display: none !important;
            }

            /* Secondary Filter Bar on Mobile */
            .statements-filter-bar {
              flex-direction: column !important;
              align-items: stretch !important;
              gap: 10px !important;
              padding: 12px 14px !important;
            }

            .statements-search-control {
              width: 100% !important;
              max-width: 100% !important;
              min-width: 0 !important;
            }

            .statements-filter-controls {
              display: flex !important;
              flex-direction: column !important;
              gap: 8px !important;
              width: 100% !important;
            }

            .statements-dropdowns-row {
              display: grid !important;
              grid-template-columns: 1fr 1fr !important;
              gap: 8px !important;
              width: 100% !important;
            }

            .statements-dropdowns-row > div {
              width: 100% !important;
              min-width: 0 !important;
            }

            .statements-buttons-row {
              display: grid !important;
              grid-template-columns: 1fr 1fr !important;
              gap: 8px !important;
              width: 100% !important;
            }

            .statements-buttons-row > button {
              width: 100% !important;
              justify-content: center !important;
            }

            /* KPI Cards on Mobile */
            .statements-kpi-container {
              padding: 12px 14px !important;
            }

            .statements-kpi-grid {
              grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
              gap: 8px !important;
              margin-bottom: 0 !important;
            }

            .statements-kpi-grid .stat-card {
              padding: 10px 12px !important;
              min-width: 0 !important;
            }

            .statements-kpi-grid .stat-label {
              font-size: 11px !important;
              margin-bottom: 4px !important;
            }

            .statements-kpi-grid .stat-value {
              font-size: 16px !important;
              line-height: 1.2 !important;
              white-space: nowrap !important;
              overflow: hidden !important;
              text-overflow: ellipsis !important;
            }

            .statements-kpi-grid .stat-card p:last-child {
              font-size: 10px !important;
              white-space: nowrap !important;
              overflow: hidden !important;
              text-overflow: ellipsis !important;
              margin-top: 2px !important;
            }

            .statements-scroll-hint {
              display: flex !important;
              align-items: center;
              gap: 6px;
              padding: 8px 14px;
              font-size: 11px;
              color: #64748B;
              background: #F8FAFC;
              border-bottom: 1px solid var(--border);
            }

            .statements-table {
              min-width: 760px !important;
            }
          }
        `}</style>
        <AdminPageHeader
          className="analytics-page-header"
          style={{ paddingTop: 0, marginBottom: 0 }}
          hideMaximize={true}
          search={
            <div className="analytics-toolbar">
              {/* 1. Left Side (Starting): Tabs */}
              <div className="analytics-tabs-wrapper">
                <AnalyticsNav inHeader={true} />
              </div>

              {/* 2. Right Side: Date Range Pickers & Maximize */}
              <div className="analytics-actions">
                <div className="analytics-filters">
                  <div className="analytics-date-field">
                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748B', whiteSpace: 'nowrap' }}>From</span>
                    <input
                      type="date"
                      value={dateFrom}
                      max={dateTo}
                      onChange={(e) => setDateFrom(e.target.value)}
                      className="analytics-date-input"
                      style={{
                        height: '38px',
                        width: '130px',
                        padding: '0 8px',
                        fontSize: '12px',
                        borderRadius: '8px',
                        background: 'white',
                        border: '1px solid var(--border)',
                        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
                        outline: 'none',
                        color: 'var(--text-primary)',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                  <div className="analytics-date-field">
                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748B', whiteSpace: 'nowrap' }}>To</span>
                    <input
                      type="date"
                      value={dateTo}
                      min={dateFrom}
                      onChange={(e) => setDateTo(e.target.value)}
                      className="analytics-date-input"
                      style={{
                        height: '38px',
                        width: '130px',
                        padding: '0 8px',
                        fontSize: '12px',
                        borderRadius: '8px',
                        background: 'white',
                        border: '1px solid var(--border)',
                        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
                        outline: 'none',
                        color: 'var(--text-primary)',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                </div>

                {/* Left Border Separator */}
                <div className="analytics-maximize-wrapper" style={{ borderLeft: '1px solid #E2E8F0', paddingLeft: '8px', display: 'flex', alignItems: 'center', height: '32px' }}>
                  <LayoutMaximizeToggle />
                </div>
              </div>
            </div>
          }
        />

        {/* Secondary Header: Search Bar & Filters */}
        <div className="statements-filter-bar">
          {/* Search Bar */}
          <div className="statements-search-control" style={{ position: 'relative', width: '100%', maxWidth: '320px', minWidth: '220px' }}>
            <Search
              size={15}
              style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#94A3B8',
                pointerEvents: 'none',
              }}
            />
            <input
              type="text"
              placeholder="Search ticket, customer, phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                height: '38px',
                paddingLeft: '34px',
                paddingRight: searchQuery ? '30px' : '10px',
                fontSize: '13px',
                borderRadius: '8px',
                background: '#FFFFFF',
                border: '1px solid var(--border)',
                width: '100%',
                boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
                outline: 'none',
                color: 'var(--text-primary)',
                boxSizing: 'border-box',
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                style={{
                  position: 'absolute',
                  right: '8px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#94A3B8',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Filters & Actions */}
          <div className="statements-filter-controls" style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <div className="statements-dropdowns-row" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '140px' }}>
                <CustomSelect
                  value={statusFilter}
                  onChange={(val) => setStatusFilter(val)}
                  options={[
                    { value: '', label: 'All Statuses' },
                    ...allStatuses.map((s) => ({ value: s, label: s })),
                  ]}
                  buttonStyle={{ height: '38px', fontSize: '12px', padding: '0 10px', width: '100%' }}
                  style={{ width: '100%' }}
                />
              </div>
              <div style={{ width: '135px' }}>
                <CustomSelect
                  value={paymentMethodFilter}
                  onChange={(val) => setPaymentMethodFilter(val)}
                  options={[
                    { value: '', label: 'All Methods' },
                    { value: 'UPI', label: 'UPI' },
                    { value: 'CASH', label: 'Cash' },
                    { value: 'CARD', label: 'Card' },
                  ]}
                  buttonStyle={{ height: '38px', fontSize: '12px', padding: '0 10px', width: '100%' }}
                  style={{ width: '100%' }}
                />
              </div>
            </div>

            <div className="statements-buttons-row" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                onClick={exportCSV}
                style={{
                  height: '38px',
                  padding: '0 14px',
                  borderRadius: '8px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#059669',
                  background: 'rgba(5, 150, 105, 0.08)',
                  border: '1px solid rgba(5, 150, 105, 0.25)',
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                <Download size={14} /> <span>Export (CSV)</span>
              </button>
              <button
                type="button"
                onClick={handleExpireOldOrders}
                disabled={expiring}
                style={{
                  height: '38px',
                  padding: '0 14px',
                  borderRadius: '8px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#DC2626',
                  background: 'rgba(220, 38, 38, 0.08)',
                  border: '1px solid rgba(220, 38, 38, 0.25)',
                  whiteSpace: 'nowrap',
                  cursor: expiring ? 'not-allowed' : 'pointer',
                  opacity: expiring ? 0.6 : 1,
                  flexShrink: 0,
                }}
              >
                <Clock size={14} /> <span>{expiring ? 'Expiring...' : 'Expire Old'}</span>
              </button>
            </div>
          </div>
        </div>

        <div style={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box', margin: 0, padding: 0 }}>

        {/* Summary Cards */}
        <div className="statements-kpi-container" style={{ padding: '16px 20px', background: '#F8FAFC', borderBottom: '1px solid var(--border)' }}>
          <div className="statements-kpi-grid">
            <div className="stat-card" style={{ borderLeftColor: 'var(--text-primary)', background: '#FFFFFF' }}>
              <p className="stat-label">Total Revenue</p>
              <h3 className="stat-value" style={{ color: 'var(--text-primary)' }}>
                {formatPrice(totalRevenue)}
              </h3>
              <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>Revenue + GST</p>
            </div>
            <div className="stat-card" style={{ background: '#FFFFFF' }}>
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
              <div className="stat-card" style={{ borderLeftColor: '#059669', background: '#FFFFFF' }}>
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
              <div className="stat-card" style={{ borderLeftColor: '#EAB308', background: '#FFFFFF' }}>
                <p className="stat-label">GST Payable</p>
                <h3 className="stat-value" style={{ color: '#EAB308' }}>
                  {formatPrice(gstPayable)}
                </h3>
                <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Deducted from Revenue
                </p>
              </div>
            )}

            {(!restaurant?.gst_type || restaurant?.gst_type === 'NONE') && (
              <div className="stat-card" style={{ borderLeftColor: '#6B7280', background: '#FFFFFF' }}>
                <p className="stat-label">GST</p>
                <h3 className="stat-value" style={{ color: '#6B7280' }}>
                  {formatPrice(0)}
                </h3>
                <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  No GST applicable
                </p>
              </div>
            )}

            <div className="stat-card" style={{ borderLeftColor: '#059669', background: '#FFFFFF' }}>
              <p className="stat-label">Gross Paid</p>
              <h3 className="stat-value" style={{ color: '#059669' }}>
                {formatPrice(totalPaidRevenue)}
              </h3>
              <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Actual collected amount
              </p>
            </div>
            <div className="stat-card" style={{ borderLeftColor: 'var(--text-primary)', background: '#FFFFFF' }}>
              <p className="stat-label">Total Orders</p>
              <h3 className="stat-value" style={{ color: 'var(--text-primary)' }}>
                {orderCount}
              </h3>
              <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Received in period
              </p>
            </div>
            <div className="stat-card" style={{ borderLeftColor: '#6366F1', background: '#FFFFFF' }}>
              <p className="stat-label">Fulfillment</p>
              <h3 className="stat-value" style={{ color: '#6366F1' }}>
                {paidCount}
              </h3>
              <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Paid status
              </p>
            </div>
          </div>
        </div>

        {/* Orders Table - Flush with sidebar & header, no outer margin, no border-radius */}
        <div style={{ width: '100%', background: '#FFFFFF', borderBottom: '1px solid var(--border)', overflow: 'hidden', borderRadius: 0, margin: 0, padding: 0 }}>
          <div className="statements-scroll-hint" aria-hidden="true">
            <MoveHorizontal size={13} style={{ flexShrink: 0 }} />
            <span>Swipe horizontally to view full order columns</span>
          </div>
          <div className="table-wrapper" style={{ border: 'none', borderRadius: 0, overflowX: 'auto', width: '100%' }}>
            {loading ? (
              <div style={{ padding: '60px', display: 'flex', justifyContent: 'center' }}>
                <div className="loader" style={{ width: 40, height: 40, borderWidth: 4 }} />
              </div>
            ) : (
              <table className="statements-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#F8FAFC', borderBottom: '1px solid var(--border)' }}>
                    <th style={{ paddingLeft: '20px' }}>Ticket</th>
                    <th>Customer</th>
                    <th>Items</th>
                    <th style={{ textAlign: 'right' }}>Total</th>
                    <th style={{ textAlign: 'center' }}>Payment</th>
                    <th style={{ textAlign: 'center' }}>Status</th>
                    <th>Date & Time</th>
                    <th style={{ textAlign: 'center', paddingRight: '20px' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map((order) => (
                    <tr
                      key={order.id}
                      onClick={() => {
                        setSelectedOrder(order);
                        setShowBill(false);
                      }}
                      style={{ cursor: 'pointer' }}
                    >
                      <td style={{ fontWeight: 800, color: 'var(--primary)', paddingLeft: '20px' }}>
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
                            order.status === 'CLOSED' || order.status === 'PAID'
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
                      <td style={{ textAlign: 'center', paddingRight: '20px' }}>
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
                  {filteredOrders.length === 0 && (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text-secondary)' }}>
                        {searchQuery ? 'No statements or orders match your search criteria.' : 'No statements or orders found matching the filter criteria.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
          {!loading && filteredOrders.length >= 200 && (
            <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)', background: '#FFFFFF' }}>
              <Pagination
                currentPage={page}
                totalPages={Math.ceil(filteredOrders.length / 50)}
                onPageChange={(p) => setPage(p)}
                pageSize={50}
                totalRecords={filteredOrders.length}
              />
            </div>
          )}
        </div>
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
                    selectedOrder.status === 'CLOSED' || selectedOrder.status === 'PAID'
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
                      color: (selectedOrder.status === 'CLOSED' || selectedOrder.status === 'PAID' || selectedOrder.is_paid) ? '#059669' : 'var(--primary, #EA580C)',
                      margin: 0,
                    }}
                  >
                    {(selectedOrder.status === 'CLOSED' || selectedOrder.status === 'PAID' || selectedOrder.is_paid)
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
              {(selectedOrder.status === 'CLOSED' || selectedOrder.status === 'PAID' || selectedOrder.is_paid) && (
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
      {showBill && selectedOrder && restaurant && (
        <BillTemplate
          order={selectedOrder}
          restaurant={restaurant}
          onClose={() => setShowBill(false)}
        />
      )}
    </>
  );
}

