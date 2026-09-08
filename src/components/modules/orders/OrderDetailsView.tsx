'use client';
import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { Order } from '@/types';
import { formatPrice, formatDateTime } from '@/lib/format';
import {
  X,
  Pencil,
  User,
  Phone,
  Users,
  Calendar,
  Utensils,
  StickyNote,
  CreditCard,
  MapPin,
  CheckCircle2
} from 'lucide-react';
import OrderTypeBadge from './OrderTypeBadge';
import OrderStatusBadge from './OrderStatusBadge';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { checkTableAssignment } from '@/lib/table-capacity';

interface OrderDetailsViewProps {
  order: Order;
  slug: string;
  isStaff?: boolean;
  tables?: any[];
  allStatuses?: string[];
  onClose?: () => void;
  onBack?: () => void;
  onStatusChange: (orderId: string, newStatus: string, tableNumber?: string, paymentMethod?: string) => Promise<void> | void;
  loading?: boolean;
}

export function OrderDetailsView({
  order,
  slug,
  isStaff = false,
  tables = [],
  allStatuses = ['PENDING', 'PREPARING', 'READY', 'PAID', 'CANCELLED'],
  onClose,
  onBack,
  onStatusChange,
  loading = false,
}: OrderDetailsViewProps) {
  const [mounted, setMounted] = useState(false);
  const [tempStatus, setTempStatus] = useState(order.status);
  const [tempTableNumber, setTempTableNumber] = useState(order.table_number || '');
  const [paymentMethod, setPaymentMethod] = useState(order.payment_method || '');
  const [actionLoading, setActionLoading] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const handleDismiss = () => {
    if (isClosing) return;
    setIsClosing(true);
    setTimeout(() => {
      if (onClose) onClose();
      else if (onBack) onBack();
    }, 180);
  };

  // Lock body scroll when drawer is open
  React.useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  // Escape key support to close drawer
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleDismiss();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isClosing]);

  // Sync state if order prop changes
  React.useEffect(() => {
    setTempStatus(order.status);
    setTempTableNumber(order.table_number || '');
    setPaymentMethod(order.payment_method || '');
    setIsClosing(false);
  }, [order.id, order.status, order.table_number, order.payment_method]);

  const handleUpdateStatus = async (statusToApply: string) => {
    setActionLoading(true);
    try {
      await onStatusChange(order.id, statusToApply, tempTableNumber, paymentMethod);
      setTempStatus(statusToApply as any);
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateTable = async () => {
    if (!tempTableNumber && !order.table_number) return;
    setActionLoading(true);
    try {
      await onStatusChange(order.id, tempStatus, tempTableNumber, paymentMethod);
    } finally {
      setActionLoading(false);
    }
  };

  const editUrl = isStaff
    ? `/${slug}/staff/orders/${order.id}/edit`
    : `/${slug}/admin/orders/${order.id}/edit`;

  const totalItemsCount = (order.items || []).reduce((acc, i) => acc + (i.quantity || 1), 0);

  if (!mounted) return null;

  return createPortal(
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes orderBackdropFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes orderBackdropFadeOut {
          from { opacity: 1; }
          to { opacity: 0; }
        }
        @keyframes orderDrawerSlideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        @keyframes orderDrawerSlideOut {
          from { transform: translateX(0); }
          to { transform: translateX(100%); }
        }
        .order-details-backdrop {
          animation: orderBackdropFadeIn 0.22s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .order-details-backdrop.closing {
          animation: orderBackdropFadeOut 0.18s cubic-bezier(0.16, 1, 0.3, 1) forwards !important;
        }
        .order-details-drawer {
          animation: orderDrawerSlideIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .order-details-drawer.closing {
          animation: orderDrawerSlideOut 0.18s cubic-bezier(0.16, 1, 0.3, 1) forwards !important;
        }
        .order-details-drawer::-webkit-scrollbar {
          width: 5px;
        }
        .order-details-drawer::-webkit-scrollbar-thumb {
          background: #E2E8F0;
          border-radius: 4px;
        }
        .order-details-drawer::-webkit-scrollbar-thumb:hover {
          background: #CBD5E1;
        }
        @media (max-width: 480px) {
          .order-details-drawer {
            width: 100vw !important;
          }
        }
      `}} />

      {/* Full-screen small blur backdrop overlay */}
      <div
        className={`order-details-backdrop ${isClosing ? 'closing' : ''}`}
        onClick={handleDismiss}
        aria-hidden="true"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(15, 23, 42, 0.32)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
          zIndex: 99998,
          margin: 0,
          padding: 0,
        }}
      />

      {/* Slide-over Drawer Panel - Edge-to-Edge Full Screen Height */}
      <aside
        className={`order-details-drawer ${isClosing ? 'closing' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={`Order Details #${String(order.ticket_number || '').padStart(3, '0')}`}
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: '440px',
          maxWidth: '100vw',
          height: '100vh',
          maxHeight: '100vh',
          background: '#FFFFFF',
          zIndex: 99999,
          boxShadow: '-8px 0 32px rgba(0, 0, 0, 0.16)',
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
          borderRadius: 0,
          border: 'none',
          borderLeft: '1px solid #E2E8F0',
          margin: 0,
          padding: 0,
          boxSizing: 'border-box',
        }}
      >
        {/* 1. STICKY HEADER */}
        <div
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 10,
            background: 'white',
            padding: '16px 20px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: '12px',
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
            <span
              style={{
                fontSize: '18px',
                fontWeight: 800,
                color: '#0F172A',
                fontFamily: 'monospace, var(--font-mono)',
              }}
            >
              #{String(order.ticket_number).padStart(3, '0')}
            </span>
            <OrderTypeBadge type={order.order_type} variant="minimal" />
            <OrderStatusBadge status={order.status} />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '11px', color: '#64748B', flexWrap: 'wrap' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <Calendar size={12} style={{ color: '#94A3B8' }} />
              {formatDateTime(order.created_at)}
            </span>
            {order.table_number && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontWeight: 700,
                  fontSize: '11px',
                  color: '#92400E',
                  backgroundColor: '#FEF3C7',
                  border: '1px solid #FDE68A',
                  padding: '2px 8px',
                  borderRadius: '6px',
                  lineHeight: 1.3,
                }}
              >
                <MapPin size={12} style={{ color: '#D97706', flexShrink: 0 }} />
                {order.table_number.toLowerCase().startsWith('table') ? order.table_number : `Table ${order.table_number}`}
              </span>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Link
            prefetch={false}
            href={editUrl}
            className="btn btn-secondary btn-sm"
            style={{
              padding: '0 10px',
              height: '30px',
              fontSize: '12px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              fontWeight: 600,
            }}
            title="Edit Order"
          >
            <Pencil size={13} />
            <span>Edit</span>
          </Link>

          <button
            onClick={handleDismiss}
            style={{
              background: '#F1F5F9',
              border: 'none',
              borderRadius: '6px',
              width: '30px',
              height: '30px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#64748B',
              transition: 'background 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#E2E8F0')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#F1F5F9')}
            title="Close Details"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* 2. VERTICAL CONTENT STACK */}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>

        {/* SECTION: CUSTOMER DETAILS */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #F1F5F9' }}>
          <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94A3B8', marginBottom: '10px' }}>
            Customer Details
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <User size={14} style={{ color: '#94A3B8', flexShrink: 0 }} />
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#0F172A' }}>
                {order.customer_name || 'Guest'}
              </span>
              {order.staff_name && (
                <span style={{ fontSize: '11px', color: '#64748B', marginLeft: 'auto' }}>
                  by {order.staff_name.split(' ')[0]}
                </span>
              )}
            </div>

            {order.phone && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Phone size={14} style={{ color: '#94A3B8', flexShrink: 0 }} />
                <a
                  href={`tel:${order.phone}`}
                  style={{ fontSize: '12px', color: '#334155', textDecoration: 'none' }}
                >
                  {order.phone}
                </a>
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Users size={14} style={{ color: '#94A3B8', flexShrink: 0 }} />
              <span style={{ fontSize: '12px', color: '#475569' }}>
                {order.party_size || 1} {Number(order.party_size) === 1 ? 'Guest' : 'Guests'}
              </span>
            </div>
          </div>
        </div>

        {/* SECTION: ORDER ITEMS */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #F1F5F9' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94A3B8', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <Utensils size={12} />
              Order Items ({totalItemsCount})
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {(order.items && order.items.length > 0) ? (
              order.items.map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    background: '#F8FAFC',
                    border: '1px solid #F1F5F9',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '22px',
                        height: '22px',
                        borderRadius: '4px',
                        background: '#E2E8F0',
                        color: '#0F172A',
                        fontWeight: 700,
                        fontSize: '11px',
                        flexShrink: 0,
                      }}
                    >
                      {item.quantity}×
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: '13px',
                          fontWeight: 600,
                          color: '#0F172A',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {item.product_name}
                      </div>
                      <div style={{ fontSize: '11px', color: '#64748B' }}>
                        {formatPrice(item.price_at_purchase)} each
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      fontSize: '13px',
                      fontWeight: 700,
                      color: '#0F172A',
                      fontVariantNumeric: 'tabular-nums',
                      flexShrink: 0,
                      marginLeft: '8px',
                    }}
                  >
                    {formatPrice(item.price_at_purchase * item.quantity)}
                  </div>
                </div>
              ))
            ) : (
              <div style={{ padding: '16px 0', textAlign: 'center', color: '#94A3B8', fontSize: '12px' }}>
                No items recorded.
              </div>
            )}
          </div>
        </div>

        {/* SECTION: FINANCIAL SUMMARY */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #F1F5F9', background: '#FAFAFA' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#64748B' }}>
              <span>Subtotal</span>
              <span style={{ fontWeight: 600, color: '#334155', fontVariantNumeric: 'tabular-nums' }}>
                {formatPrice(order.subtotal || (order.gst_amount ? order.total_price - order.gst_amount : order.total_price))}
              </span>
            </div>

            {order.gst_amount && Number(order.gst_amount) > 0 ? (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#64748B' }}>
                <span>GST ({order.gst_rate || 5}%)</span>
                <span style={{ fontWeight: 600, color: '#334155', fontVariantNumeric: 'tabular-nums' }}>
                  {formatPrice(order.gst_amount)}
                </span>
              </div>
            ) : null}

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                paddingTop: '8px',
                marginTop: '4px',
                borderTop: '1px dashed #CBD5E1',
              }}
            >
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>
                Total
              </div>
              <div
                style={{
                  fontSize: '18px',
                  fontWeight: 800,
                  color: 'var(--primary)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {formatPrice(order.total_price)}
              </div>
            </div>

            <div style={{ marginTop: '6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px' }}>
              <span style={{ color: '#64748B' }}>Payment</span>
              {order.is_paid ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#15803D', fontWeight: 600 }}>
                  <CheckCircle2 size={12} /> Paid ({order.payment_method || 'Settled'})
                </span>
              ) : (
                <span style={{ color: '#B45309', fontWeight: 600 }}>Unpaid</span>
              )}
            </div>
          </div>
        </div>

        {/* SECTION: STATUS & TABLE CONTROLS */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #F1F5F9' }}>
          <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94A3B8', marginBottom: '10px' }}>
            Status & Table
          </div>

          {/* Status Select */}
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
              Status
            </label>
            <CustomSelect
              value={tempStatus}
              disabled={actionLoading || loading}
              onChange={(val) => {
                setTempStatus(val);
                if (val !== 'PAID') {
                  handleUpdateStatus(val);
                }
              }}
              direction="up"
              options={allStatuses.map((s) => ({ value: s, label: s }))}
              buttonStyle={{ height: '36px', fontSize: '13px' }}
            />

            {tempStatus === 'PAID' && (
              <div style={{ marginTop: '10px', padding: '10px', background: '#F8FAFC', border: '1px solid var(--border)', borderRadius: '6px' }}>
                <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: '#64748B', marginBottom: '4px', textTransform: 'uppercase' }}>
                  Payment Method
                </label>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <CustomSelect
                    style={{ flex: 1 }}
                    value={paymentMethod}
                    onChange={(val) => setPaymentMethod(val)}
                    direction="up"
                    options={[
                      { value: '', label: 'Select' },
                      { value: 'UPI', label: 'UPI' },
                      { value: 'CASH', label: 'Cash' },
                      { value: 'CARD', label: 'Card' },
                    ]}
                    buttonStyle={{ height: '34px', fontSize: '12px' }}
                  />
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => handleUpdateStatus('PAID')}
                    disabled={actionLoading || !paymentMethod}
                    style={{ height: '34px', padding: '0 12px', fontSize: '12px' }}
                  >
                    Confirm
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Table Select */}
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
              Assigned Table
            </label>
            <div style={{ display: 'flex', gap: '6px' }}>
              <CustomSelect
                style={{ flex: 1 }}
                value={tempTableNumber}
                disabled={actionLoading || loading}
                onChange={(val) => setTempTableNumber(val)}
                direction="up"
                options={[
                  { value: '', label: '-- No Table --' },
                  ...tables
                    .filter((t: any) => {
                      const partySize = Number(order.party_size) || 1;
                      const check = checkTableAssignment(t, partySize, {
                        orderId: order.id,
                        phone: order.phone,
                        customerName: order.customer_name,
                      });
                      const isCurrent = t.table_number === tempTableNumber;
                      return check.allowed || isCurrent;
                    })
                    .map((t: any) => {
                      const partySize = Number(order.party_size) || 1;
                      const check = checkTableAssignment(t, partySize, {
                        orderId: order.id,
                        phone: order.phone,
                        customerName: order.customer_name,
                      });
                      const cap = Number(t.capacity) || 0;
                      const seated = check.occupiedSeats;
                      const rawNum = String(t.table_number || '').trim();
                      let tableLabel = rawNum;
                      if (/^\d+$/.test(rawNum)) {
                        tableLabel = `T${rawNum}`;
                      } else if (rawNum.toLowerCase().startsWith('t-')) {
                        tableLabel = `T-${rawNum.slice(2)}`;
                      }
                      const freeSeats = Math.max(0, cap - seated);

                      return {
                        value: String(t.table_number),
                        label: `${tableLabel} · ${seated}/${cap} (${freeSeats} free)`,
                      };
                    }),
                  ...(tempTableNumber && !tables.some((t: any) => String(t.table_number) === String(tempTableNumber))
                    ? [{ value: tempTableNumber, label: `Table ${tempTableNumber}` }]
                    : []),
                ]}
                buttonStyle={{ height: '36px', fontSize: '13px' }}
              />
              <button
                className="btn btn-secondary btn-sm"
                onClick={handleUpdateTable}
                disabled={actionLoading || loading || tempTableNumber === (order.table_number || '')}
                style={{ height: '36px', padding: '0 12px', fontSize: '12px', whiteSpace: 'nowrap' }}
              >
                Save
              </button>
            </div>
          </div>
        </div>

        {/* SECTION: SPECIAL NOTES (IF PRESENT) */}
        {order.notes && (
          <div style={{ padding: '14px 20px', borderTop: '1px solid #F1F5F9', background: '#FFFDF5' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
              <StickyNote size={13} style={{ color: '#D97706' }} />
              <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#B45309' }}>
                Special Instructions
              </span>
            </div>
            <p style={{ margin: 0, fontSize: '12px', color: '#92400E', fontStyle: 'italic', lineHeight: 1.4 }}>
              "{order.notes}"
            </p>
          </div>
        )}
      </div>
    </aside>
  </>,
  document.body
  );
}

export default OrderDetailsView;

