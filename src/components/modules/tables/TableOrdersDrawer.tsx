'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Users,
  Utensils,
  CreditCard,
  Printer,
  Calendar,
  Clock,
  AlertCircle,
  MapPin,
  ChevronRight,
  Loader2,
  Sparkles,
  ShoppingBag,
  Banknote,
  QrCode,
  CheckCircle2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { RestaurantTable } from '@/modules/tables/tables.repository';
import { formatPrice, formatDateTime } from '@/lib/format';
import OrderStatusBadge from '@/components/modules/orders/OrderStatusBadge';
import OrderTypeBadge from '@/components/modules/orders/OrderTypeBadge';
import { printBillFromBrowser } from '@/lib/client-print';

interface TableOrdersDrawerProps {
  table: RestaurantTable | null;
  slug: string;
  isOpen: boolean;
  onClose: () => void;
  onRefresh?: () => void;
  primaryColor?: string;
}

export function TableOrdersDrawer({
  table,
  slug,
  isOpen,
  onClose,
  onRefresh,
  primaryColor = '#059669',
}: TableOrdersDrawerProps) {
  const [mounted, setMounted] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [printingOrderId, setPrintingOrderId] = useState<string | null>(null);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [closingOrderId, setClosingOrderId] = useState<string | null>(null);
  const [paymentModalOrder, setPaymentModalOrder] = useState<any | null>(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'CASH' | 'UPI' | 'CARD'>('CASH');
  const [submittingPayment, setSubmittingPayment] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Keyboard shortcut: Escape to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        if (paymentModalOrder) {
          setPaymentModalOrder(null);
        } else {
          handleDismiss();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, paymentModalOrder]);

  const handleDismiss = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 200);
  };

  if (!mounted || !isOpen || !table) return null;

  const activeOrders = table.active_orders || [];
  const capacity = Number(table.capacity) || 0;
  const seatedGuests = activeOrders.reduce((sum: number, o: any) => sum + (Number(o.party_size) || 1), 0);
  const isOccupied = table.status === 'OCCUPIED' || activeOrders.length > 0;
  const remainingSeats = isOccupied ? Math.max(0, capacity - seatedGuests) : capacity;
  const combinedTotal = activeOrders.reduce((sum, o) => sum + Number(o.total_price || 0), 0);

  // 1-Click Direct Silent Bill Printing
  const handlePrintBill = async (order: any) => {
    if (printingOrderId) return;
    setPrintingOrderId(order.id);

    const savedPrinter = typeof window !== 'undefined'
      ? (localStorage.getItem('qdine_bill_printer_name') || localStorage.getItem('qdine_kot_printer_name') || 'POS-80C')
      : 'POS-80C';

    const toastId = toast.loading(`🖨️ Printing Bill #${String(order.ticket_number).padStart(3, '0')}...`);

    try {
      const res = await fetch('/api/print/bill', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-restaurant-slug': slug,
        },
        body: JSON.stringify({
          orderId: order.id,
          printerName: savedPrinter,
          orderData: order,
          slug,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to print bill');
      }

      // If handled on server (local Windows dev) or cloud print agent
      if (data.mode === 'server' || data.mode === 'agent') {
        toast.success(`🖨️ Bill #${String(order.ticket_number).padStart(3, '0')} sent to printer!`, { id: toastId });
        return;
      }

      // Hardware fallback: Bluetooth / Serial / RawBT / Bridge / Browser iframe
      const savedBridgeUrl = typeof window !== 'undefined' ? localStorage.getItem('qdine_printer_bridge_url') : undefined;
      const clientRes = await printBillFromBrowser({
        base64Bytes: data.base64Bytes,
        billHtml: data.billHtml,
        orderData: order,
        billData: data.billData,
        printerName: data.printer || savedPrinter,
        ticketNumber: order.ticket_number,
        localBridgeUrl: savedBridgeUrl ? `${savedBridgeUrl.replace(/\/+$/, '')}/print` : undefined,
      });

      if (clientRes.success) {
        toast.success(clientRes.message || `🖨️ Bill #${String(order.ticket_number).padStart(3, '0')} printed!`, { id: toastId });
      } else {
        // Fallback: direct thermal HTML iframe print
        const { printBillTemplateDirectly } = await import('@/lib/bill-template-html');
        printBillTemplateDirectly(order, {
          name: data.billData?.restaurantName || (order as any).restaurant_name || 'Restaurant',
          logo_url: data.billData?.logoUrl,
          address: data.billData?.address,
          phone: data.billData?.phone,
          gst_number: data.billData?.gstNumber,
          primary_color: data.billData?.primaryColor,
        });
        toast.success(`🖨️ Bill #${String(order.ticket_number).padStart(3, '0')} printed!`, { id: toastId });
      }
    } catch (err: any) {
      console.error('Bill print error:', err);
      toast.error(err.message || 'Failed to print bill.', { id: toastId });
    } finally {
      setPrintingOrderId(null);
    }
  };

  // Handle Close Ticket Click: If not marked paid, show popup to select payment method
  const handleCloseTicketClick = (order: any) => {
    if (order.is_paid) {
      executeCloseTicket(order, order.payment_method || 'CASH');
    } else {
      setSelectedPaymentMethod('CASH');
      setPaymentModalOrder(order);
    }
  };

  // Execute closing single ticket and setting status = PAID & is_paid = true
  const executeCloseTicket = async (order: any, paymentMethod: string) => {
    if (closingOrderId) return;
    setClosingOrderId(order.id);
    setSubmittingPayment(true);
    const ticketNum = String(order.ticket_number).padStart(3, '0');
    const toastId = toast.loading(`Closing Ticket #${ticketNum}...`);

    try {
      const res = await fetch(`/api/orders/${order.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-restaurant-slug': slug,
        },
        body: JSON.stringify({
          status: 'PAID',
          is_paid: true,
          payment_method: paymentMethod || 'CASH',
          table_number: table.table_number,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`Ticket #${ticketNum} marked Paid via ${paymentMethod} & closed!`, { id: toastId });
        setPaymentModalOrder(null);
        onRefresh?.();
      } else {
        toast.error(data.error || 'Failed to close ticket', { id: toastId });
      }
    } catch (err: any) {
      console.error('Error closing ticket:', err);
      toast.error('Network error closing ticket', { id: toastId });
    } finally {
      setClosingOrderId(null);
      setSubmittingPayment(false);
    }
  };

  // Quick Status Update
  const handleUpdateStatus = async (orderId: string, newStatus: string) => {
    setUpdatingOrderId(orderId);
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-restaurant-slug': slug,
        },
        body: JSON.stringify({
          status: newStatus,
          table_number: table.table_number,
        }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success(`Order marked as ${newStatus}`);
        onRefresh?.();
      } else {
        toast.error(data.error || 'Failed to update status');
      }
    } catch {
      toast.error('Network error updating status');
    } finally {
      setUpdatingOrderId(null);
    }
  };

  return createPortal(
    <>
      <style>{`
        @keyframes drawerBackdropIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes drawerBackdropOut {
          from { opacity: 1; }
          to { opacity: 0; }
        }
        @keyframes tableDrawerSlideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        @keyframes tableDrawerSlideOut {
          from { transform: translateX(0); }
          to { transform: translateX(100%); }
        }
        @keyframes modalFadeIn {
          from { opacity: 0; transform: scale(0.96); }
          to { opacity: 1; transform: scale(1); }
        }
        .table-drawer-backdrop {
          animation: drawerBackdropIn 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .table-drawer-backdrop.closing {
          animation: drawerBackdropOut 0.18s cubic-bezier(0.16, 1, 0.3, 1) forwards !important;
        }
        .table-drawer-panel {
          animation: tableDrawerSlideIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .table-drawer-panel.closing {
          animation: tableDrawerSlideOut 0.18s cubic-bezier(0.16, 1, 0.3, 1) forwards !important;
        }
        .table-drawer-body {
          scrollbar-width: thin;
          scrollbar-color: #CBD5E1 #F8FAFC;
        }
        .table-drawer-body::-webkit-scrollbar {
          width: 6px;
        }
        .table-drawer-body::-webkit-scrollbar-track {
          background: #F8FAFC;
        }
        .table-drawer-body::-webkit-scrollbar-thumb {
          background: #CBD5E1;
          border-radius: 4px;
        }
      `}</style>

      {/* Backdrop */}
      <div
        className={`table-drawer-backdrop ${isClosing ? 'closing' : ''}`}
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
          background: 'rgba(15, 23, 42, 0.35)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
          zIndex: 99998,
          margin: 0,
          padding: 0,
        }}
      />

      {/* Slide-over Drawer Panel */}
      <aside
        className={`table-drawer-panel ${isClosing ? 'closing' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={`Table #${table.table_number} Orders`}
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: '460px',
          maxWidth: '100vw',
          height: '100vh',
          background: '#FFFFFF',
          zIndex: 99999,
          boxShadow: '-8px 0 32px rgba(0, 0, 0, 0.15)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          borderLeft: '1px solid #E2E8F0',
          boxSizing: 'border-box',
        }}
      >
        {/* 1. FIXED HEADER */}
        <div
          style={{
            flexShrink: 0,
            background: '#FFFFFF',
            padding: '16px 20px',
            borderBottom: '1px solid #E2E8F0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: isOccupied ? '#FEF3C7' : '#ECFDF5',
                color: isOccupied ? '#92400E' : '#065F46',
                border: `1px solid ${isOccupied ? '#FDE68A' : '#A7F3D0'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Utensils size={18} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 style={{ fontSize: '18px', fontWeight: 900, color: '#0F172A', margin: 0, letterSpacing: '-0.01em' }}>
                  Table #{table.table_number}
                </h2>
                <span
                  style={{
                    display: 'inline-block',
                    padding: '2px 8px',
                    borderRadius: '9999px',
                    fontSize: '11px',
                    fontWeight: 800,
                    background: isOccupied ? '#FEF3C7' : '#DCFCE7',
                    color: isOccupied ? '#92400E' : '#166534',
                    border: `1px solid ${isOccupied ? '#FDE68A' : '#86EFAC'}`,
                  }}
                >
                  {isOccupied ? 'Occupied' : 'Available'}
                </span>
              </div>
              <p style={{ fontSize: '12px', color: '#64748B', margin: '2px 0 0 0' }}>
                Capacity: {capacity} ·{' '}
                <strong style={{ color: remainingSeats === 0 ? '#DC2626' : '#059669' }}>
                  {remainingSeats === 0 ? 'Full' : `${remainingSeats} free`}
                </strong>
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              type="button"
              onClick={handleDismiss}
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                border: 'none',
                background: '#F1F5F9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#64748B',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#E2E8F0';
                e.currentTarget.style.color = '#0F172A';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#F1F5F9';
                e.currentTarget.style.color = '#64748B';
              }}
              aria-label="Close drawer"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* 2. SUB-HEADER SUMMARY TOOLBAR */}
        <div
          style={{
            flexShrink: 0,
            background: '#F8FAFC',
            padding: '10px 20px',
            borderBottom: '1px solid #E2E8F0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '13px', color: '#64748B', fontWeight: 700 }}>
              {activeOrders.length} Active {activeOrders.length === 1 ? 'Order' : 'Orders'}
            </span>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 600, display: 'block' }}>Table Total</span>
            <span style={{ fontSize: '18px', fontWeight: 900, color: '#0F172A', fontVariantNumeric: 'tabular-nums' }}>
              {formatPrice(combinedTotal)}
            </span>
          </div>
        </div>

        {/* 3. ORDERS LIST */}
        <div
          className="table-drawer-body"
          style={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
            padding: '0',
            background: '#FFFFFF',
          }}
        >
          {activeOrders.length === 0 ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                padding: '60px 20px',
                color: '#64748B',
              }}
            >
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '50%',
                  background: '#F1F5F9',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#94A3B8',
                  marginBottom: '10px',
                }}
              >
                <Utensils size={20} />
              </div>
              <h3 style={{ fontSize: '14px', fontWeight: 800, color: '#1E293B', margin: '0 0 4px 0' }}>
                No active orders
              </h3>
              <p style={{ fontSize: '12px', color: '#94A3B8', margin: 0 }}>
                Table #{table.table_number} is clean and ready for guests.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {activeOrders.map((order: any, idx: number) => {
                const ticketNum = String(order.ticket_number || '').padStart(3, '0');
                const items = order.items || [];
                const isPrintingThisBill = printingOrderId === order.id;

                return (
                  <div
                    key={order.id || idx}
                    style={{
                      padding: '16px 20px',
                      borderBottom: '1px solid #F1F5F9',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px',
                      background: '#FFFFFF',
                      transition: 'background 0.15s ease',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#F8FAFC')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#FFFFFF')}
                  >
                    {/* Top Header Row */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flexWrap: 'wrap' }}>
                        <span
                          style={{
                            fontSize: '15px',
                            fontWeight: 900,
                            color: '#0F172A',
                            fontFamily: 'monospace, var(--font-mono)',
                          }}
                        >
                          #{ticketNum}
                        </span>
                        <OrderStatusBadge status={order.status} />
                        <span style={{ fontSize: '11px', color: '#94A3B8' }}>
                          {order.created_at ? formatDateTime(order.created_at).split(',')[1]?.trim() || '' : ''}
                        </span>
                      </div>

                      {/* Right: Order Total & Payment status, Close Ticket, Print Bill */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontSize: '14px', fontWeight: 900, color: '#0F172A', fontVariantNumeric: 'tabular-nums', marginRight: '2px', display: 'block' }}>
                            {formatPrice(order.total_price)}
                          </span>
                          {order.is_paid && (
                            <span style={{ fontSize: '9.5px', fontWeight: 800, color: '#059669', background: '#ECFDF5', border: '1px solid #A7F3D0', padding: '1px 5px', borderRadius: '4px', textTransform: 'uppercase' }}>
                              ✓ Paid {order.payment_method ? `(${order.payment_method})` : ''}
                            </span>
                          )}
                        </div>

                        {/* Close Ticket Button */}
                        <button
                          type="button"
                          onClick={() => handleCloseTicketClick(order)}
                          disabled={closingOrderId === order.id}
                          style={{
                            height: '28px',
                            padding: '0 12px',
                            borderRadius: '6px',
                            border: '1px solid #059669',
                            background: '#059669',
                            color: '#FFFFFF',
                            fontSize: '11px',
                            fontWeight: 700,
                            cursor: closingOrderId === order.id ? 'wait' : 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '5px',
                            boxShadow: '0 1px 2px rgba(5, 150, 105, 0.2)',
                            transition: 'all 0.15s ease',
                          }}
                          onMouseEnter={(e) => {
                            if (closingOrderId !== order.id) {
                              e.currentTarget.style.background = '#047857';
                              e.currentTarget.style.borderColor = '#047857';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (closingOrderId !== order.id) {
                              e.currentTarget.style.background = '#059669';
                              e.currentTarget.style.borderColor = '#059669';
                            }
                          }}
                          title={`Close Ticket #${ticketNum}`}
                        >
                          {closingOrderId === order.id ? (
                            <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} />
                          ) : null}
                          <span>Close Ticket</span>
                        </button>

                        {/* Print Bill Button */}
                        <button
                          type="button"
                          onClick={() => handlePrintBill(order)}
                          disabled={isPrintingThisBill}
                          style={{
                            height: '28px',
                            padding: '0 10px',
                            borderRadius: '6px',
                            border: '1px solid #10B981',
                            background: isPrintingThisBill ? '#ECFDF5' : '#F0FDF4',
                            color: '#047857',
                            fontSize: '11px',
                            fontWeight: 700,
                            cursor: isPrintingThisBill ? 'wait' : 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            transition: 'all 0.15s ease',
                          }}
                          onMouseEnter={(e) => {
                            if (!isPrintingThisBill) e.currentTarget.style.background = '#DCFCE7';
                          }}
                          onMouseLeave={(e) => {
                            if (!isPrintingThisBill) e.currentTarget.style.background = '#F0FDF4';
                          }}
                          title={`Print Bill #${ticketNum} directly`}
                        >
                          {isPrintingThisBill ? (
                            <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} />
                          ) : (
                            <Printer size={11} />
                          )}
                          <span>Print Bill</span>
                        </button>
                      </div>
                    </div>

                    {/* Customer & Guest note (if any) */}
                    {(order.customer_name || order.phone) && (
                      <div style={{ fontSize: '11.5px', color: '#64748B' }}>
                        Guest: <strong style={{ color: '#334155' }}>{order.customer_name || 'Walk-in'}</strong>
                        {order.phone ? ` (${order.phone})` : ''}
                      </div>
                    )}

                    {/* Minimal Clean Items List */}
                    {items.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', paddingLeft: '2px' }}>
                        {items.map((item: any, itemIdx: number) => (
                          <div
                            key={itemIdx}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              fontSize: '12px',
                              color: '#334155',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                              <span style={{ fontWeight: 800, color: '#0F172A', fontSize: '11px' }}>
                                {item.quantity}×
                              </span>
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {item.product_name || item.name || 'Item'}
                              </span>
                            </div>
                            <span style={{ color: '#64748B', fontWeight: 600, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                              {formatPrice(Number(item.price_at_purchase || item.price || 0) * Number(item.quantity || 1))}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {order.notes && (
                      <div style={{ fontSize: '11px', color: '#B45309', background: '#FEF3C7', padding: '3px 8px', borderRadius: '4px' }}>
                        Note: {order.notes}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </aside>

      {/* 4. SETTLE PAYMENT & CLOSE TICKET POPUP MODAL */}
      {paymentModalOrder && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100001,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            animation: 'drawerBackdropIn 0.15s ease',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !submittingPayment) {
              setPaymentModalOrder(null);
            }
          }}
        >
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '380px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              border: '1px solid #E2E8F0',
              overflow: 'hidden',
              animation: 'modalFadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid #F1F5F9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '34px',
                    height: '34px',
                    borderRadius: '10px',
                    background: '#ECFDF5',
                    color: '#059669',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <CreditCard size={18} />
                </div>
                <div>
                  <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                    Settle &amp; Close Ticket
                  </h3>
                  <span style={{ fontSize: '11px', color: '#64748B' }}>
                    Ticket #{String(paymentModalOrder.ticket_number).padStart(3, '0')} • Table #{table.table_number}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPaymentModalOrder(null)}
                disabled={submittingPayment}
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  border: 'none',
                  background: '#F1F5F9',
                  color: '#64748B',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <X size={15} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '20px' }}>
              {/* Order Amount Banner */}
              <div
                style={{
                  background: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  borderRadius: '12px',
                  padding: '14px 16px',
                  textAlign: 'center',
                  marginBottom: '18px',
                }}
              >
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Total Payable Amount
                </span>
                <div style={{ fontSize: '24px', fontWeight: 900, color: '#0F172A', fontVariantNumeric: 'tabular-nums', marginTop: '2px' }}>
                  {formatPrice(paymentModalOrder.total_price)}
                </div>
                {paymentModalOrder.customer_name && (
                  <div style={{ fontSize: '11px', color: '#64748B', marginTop: '4px' }}>
                    Guest: <strong style={{ color: '#334155' }}>{paymentModalOrder.customer_name}</strong>
                  </div>
                )}
              </div>

              {/* Payment Method Selector */}
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '8px' }}>
                Select Payment Method
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '20px' }}>
                {[
                  { id: 'CASH', label: 'Cash', icon: Banknote },
                  { id: 'UPI', label: 'UPI / QR', icon: QrCode },
                  { id: 'CARD', label: 'Card', icon: CreditCard },
                ].map((m) => {
                  const Icon = m.icon;
                  const isSelected = selectedPaymentMethod === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setSelectedPaymentMethod(m.id as any)}
                      style={{
                        padding: '10px 6px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        borderRadius: '10px',
                        border: isSelected ? '2px solid #059669' : '1px solid #CBD5E1',
                        background: isSelected ? '#ECFDF5' : '#FFFFFF',
                        color: isSelected ? '#065F46' : '#475569',
                        fontWeight: isSelected ? 800 : 600,
                        fontSize: '12px',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        boxShadow: isSelected ? '0 2px 4px rgba(5, 150, 105, 0.15)' : 'none',
                      }}
                    >
                      <Icon size={18} color={isSelected ? '#059669' : '#64748B'} />
                      <span>{m.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setPaymentModalOrder(null)}
                  disabled={submittingPayment}
                  style={{
                    flex: 1,
                    height: '40px',
                    borderRadius: '8px',
                    border: '1px solid #E2E8F0',
                    background: '#F8FAFC',
                    color: '#64748B',
                    fontWeight: 700,
                    fontSize: '12.5px',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => executeCloseTicket(paymentModalOrder, selectedPaymentMethod)}
                  disabled={submittingPayment || closingOrderId === paymentModalOrder.id}
                  style={{
                    flex: 2,
                    height: '40px',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#059669',
                    color: '#FFFFFF',
                    fontWeight: 800,
                    fontSize: '12.5px',
                    cursor: submittingPayment ? 'wait' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    boxShadow: '0 2px 6px rgba(5, 150, 105, 0.3)',
                  }}
                >
                  {submittingPayment || closingOrderId === paymentModalOrder.id ? (
                    <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                  ) : (
                    <CheckCircle2 size={15} />
                  )}
                  <span>Make Paid &amp; Close</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>,
    document.body
  );
}

export default TableOrdersDrawer;
