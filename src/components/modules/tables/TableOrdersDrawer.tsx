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
} from 'lucide-react';
import toast from 'react-hot-toast';
import { RestaurantTable } from '@/modules/tables/tables.repository';
import { formatPrice, formatDateTime } from '@/lib/format';
import OrderStatusBadge from '@/components/modules/orders/OrderStatusBadge';
import OrderTypeBadge from '@/components/modules/orders/OrderTypeBadge';
import { printBillFromBrowser, printKotFromBrowser } from '@/lib/client-print';

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
  const [printingKotId, setPrintingKotId] = useState<string | null>(null);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [closingOrderId, setClosingOrderId] = useState<string | null>(null);
  const [closingAll, setClosingAll] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Keyboard shortcut: Escape to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleDismiss();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

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
        toast.success(data.message || `Bill #${String(order.ticket_number).padStart(3, '0')} printed to ${savedPrinter}!`, { id: toastId });
        return;
      }

      // Client mode (VPS cloud-hosted / client browser):
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
        toast.success(clientRes.message || `Bill #${String(order.ticket_number).padStart(3, '0')} printed!`, { id: toastId });
      } else {
        toast.error(clientRes.message || 'Failed to print bill. Check printer connection.', { id: toastId });
      }
    } catch (err: any) {
      console.error('Bill print error:', err);
      toast.error(err.message || 'Failed to print bill. Check printer connection.', { id: toastId });
    } finally {
      setPrintingOrderId(null);
    }
  };

  // 1-Click Direct Silent KOT Printing
  const handlePrintKot = async (order: any) => {
    if (printingKotId) return;
    setPrintingKotId(order.id);

    const savedPrinter = typeof window !== 'undefined'
      ? (localStorage.getItem('qdine_kot_printer_name') || 'POS-80C')
      : 'POS-80C';

    const toastId = toast.loading(`🖨️ Printing KOT #${String(order.ticket_number).padStart(3, '0')}...`);

    try {
      const res = await fetch('/api/print/kot', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-restaurant-slug': slug,
        },
        body: JSON.stringify({
          orderId: order.id,
          counterName: 'ALL',
          printerName: savedPrinter,
          orderData: order,
          slug,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to print KOT');
      }

      if (data.mode === 'server' || data.mode === 'agent') {
        toast.success(data.message || `KOT #${String(order.ticket_number).padStart(3, '0')} printed to ${savedPrinter}!`, { id: toastId });
        return;
      }

      // Client mode (VPS fallback)
      const savedBridgeUrl = typeof window !== 'undefined' ? localStorage.getItem('qdine_printer_bridge_url') : undefined;
      if (data.slips && Array.isArray(data.slips)) {
        for (const slip of data.slips) {
          await printKotFromBrowser({
            kotData: slip.kotData,
            base64Bytes: slip.base64Bytes,
            printerName: slip.printerName || data.printer || savedPrinter,
            counterId: slip.counterId,
            counterName: slip.kotData?.counterName,
            localBridgeUrl: savedBridgeUrl ? `${savedBridgeUrl.replace(/\/+$/, '')}/print` : undefined,
          });
        }
        toast.success(`KOT printed for ${data.slips.length} counter(s)!`, { id: toastId });
      } else if (data.kotData) {
        const clientRes = await printKotFromBrowser({
          kotData: data.kotData,
          base64Bytes: data.base64Bytes,
          printerName: data.printer || savedPrinter,
          localBridgeUrl: savedBridgeUrl ? `${savedBridgeUrl.replace(/\/+$/, '')}/print` : undefined,
        });
        toast.success(clientRes.message || `KOT #${String(order.ticket_number).padStart(3, '0')} printed!`, { id: toastId });
      } else {
        toast.success(data.message || 'KOT printed!', { id: toastId });
      }
    } catch (err: any) {
      console.error('KOT print error:', err);
      toast.error(err.message || 'Failed to print KOT.', { id: toastId });
    } finally {
      setPrintingKotId(null);
    }
  };

  // Close Single Ticket & Mark as Paid
  const handleCloseTicket = async (order: any) => {
    if (closingOrderId) return;
    setClosingOrderId(order.id);
    const toastId = toast.loading(`Closing Ticket #${String(order.ticket_number).padStart(3, '0')}...`);

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
          table_number: table.table_number,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`Ticket #${String(order.ticket_number).padStart(3, '0')} closed & marked Paid!`, { id: toastId });
        onRefresh?.();
      } else {
        toast.error(data.error || 'Failed to close ticket', { id: toastId });
      }
    } catch (err: any) {
      console.error('Error closing ticket:', err);
      toast.error('Network error closing ticket', { id: toastId });
    } finally {
      setClosingOrderId(null);
    }
  };

  // Close All Tickets for Table
  const handleCloseAllTickets = async () => {
    if (closingAll || activeOrders.length === 0) return;
    if (!window.confirm(`Close all ${activeOrders.length} ticket(s) for Table #${table.table_number} and mark as Paid?`)) {
      return;
    }
    setClosingAll(true);
    const toastId = toast.loading(`Closing all tickets for Table #${table.table_number}...`);

    try {
      let successCount = 0;
      for (const order of activeOrders) {
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
              table_number: table.table_number,
            }),
          });
          const data = await res.json();
          if (res.ok && data.success) {
            successCount++;
          }
        } catch (_) {}
      }

      toast.success(`${successCount} ticket(s) closed & table settled!`, { id: toastId });
      onRefresh?.();
    } catch (err: any) {
      console.error('Error closing all tickets:', err);
      toast.error('Failed to close all tickets', { id: toastId });
    } finally {
      setClosingAll(false);
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
        toast.error(data.error || 'Failed to update order status');
      }
    } catch {
      toast.error('Network error updating status');
    } finally {
      setUpdatingOrderId(null);
    }
  };

  return createPortal(
    <>
      <style dangerouslySetInnerHTML={{ __html: `
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
      `}} />

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
                Capacity: {capacity} &middot;{' '}
                <strong style={{ color: remainingSeats > 0 ? '#16A34A' : '#DC2626' }}>
                  {remainingSeats > 0 ? `${remainingSeats} Seats Free` : 'Full'}
                </strong>
              </p>
            </div>
          </div>

          <button
            onClick={handleDismiss}
            style={{
              background: '#F1F5F9',
              border: 'none',
              borderRadius: '8px',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#64748B',
              flexShrink: 0,
              transition: 'background 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#E2E8F0')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#F1F5F9')}
            title="Close Drawer (Esc)"
          >
            <X size={16} />
          </button>
        </div>

        {/* 2. SUMMARY STATS BANNER */}
        <div
          style={{
            flexShrink: 0,
            background: '#FFFFFF',
            borderBottom: '1px solid #E2E8F0',
            padding: '12px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '13px', color: '#64748B', fontWeight: 700 }}>
              {activeOrders.length} Active {activeOrders.length === 1 ? 'Order' : 'Orders'}
            </span>
            {activeOrders.length > 1 && (
              <button
                type="button"
                onClick={handleCloseAllTickets}
                disabled={closingAll}
                style={{
                  height: '26px',
                  padding: '0 10px',
                  borderRadius: '6px',
                  border: '1px solid #A7F3D0',
                  background: '#ECFDF5',
                  color: '#065F46',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: closingAll ? 'wait' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  if (!closingAll) {
                    e.currentTarget.style.background = '#D1FAE5';
                    e.currentTarget.style.borderColor = '#6EE7B7';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!closingAll) {
                    e.currentTarget.style.background = '#ECFDF5';
                    e.currentTarget.style.borderColor = '#A7F3D0';
                  }
                }}
                title="Close all active tickets on this table and mark as Paid"
              >
                {closingAll && (
                  <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} />
                )}
                <span>Close All Tickets</span>
              </button>
            )}
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 600, display: 'block' }}>Table Total</span>
            <span style={{ fontSize: '18px', fontWeight: 900, color: '#0F172A', fontVariantNumeric: 'tabular-nums' }}>
              {formatPrice(combinedTotal)}
            </span>
          </div>
        </div>

        {/* 3. ULTRA-MINIMAL ORDERS LIST (NO BULKY NESTED CARDS) */}
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
                const isPrintingThisKot = printingKotId === order.id;

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
                    {/* Minimal Top Header Row */}
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

                      {/* Right: Order Total, Close Ticket & Print Bill */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                        <span style={{ fontSize: '14px', fontWeight: 900, color: '#0F172A', fontVariantNumeric: 'tabular-nums', marginRight: '2px' }}>
                          {formatPrice(order.total_price)}
                        </span>

                        {/* Close Ticket Button */}
                        <button
                          type="button"
                          onClick={() => handleCloseTicket(order)}
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
                          title={`Close Ticket #${ticketNum} and mark as Paid`}
                        >
                          {closingOrderId === order.id && (
                            <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} />
                          )}
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
                          onMouseEnter={(e) => { if (!isPrintingThisBill) e.currentTarget.style.background = '#DCFCE7'; }}
                          onMouseLeave={(e) => { if (!isPrintingThisBill) e.currentTarget.style.background = '#F0FDF4'; }}
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
    </>,
    document.body
  );
}
export default TableOrdersDrawer;
