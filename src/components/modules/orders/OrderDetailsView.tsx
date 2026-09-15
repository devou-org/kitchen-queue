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
  CheckCircle2,
  Printer,
  ChevronDown,
  Loader2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import OrderTypeBadge from './OrderTypeBadge';
import OrderStatusBadge from './OrderStatusBadge';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { checkTableAssignment } from '@/lib/table-capacity';
import { printKotFromBrowser } from '@/lib/client-print';
import { generateBillReceiptHtml } from '@/lib/thermal-receipt-html';

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

  // Extract and group order items by counter
  const itemsWithCounter = React.useMemo(() => {
    return (order.items || []).filter((i: any) => (i.quantity || 0) > 0);
  }, [order.items]);

  const counterGroups = React.useMemo(() => {
    const map: Record<string, typeof itemsWithCounter> = {};
    for (const item of itemsWithCounter) {
      const c = (item.counter || '').trim() || 'Unassigned';
      if (!map[c]) map[c] = [];
      map[c].push(item);
    }
    return map;
  }, [itemsWithCounter]);

  const uniqueCounters = React.useMemo(() => Object.keys(counterGroups), [counterGroups]);

  const [isPrinting, setIsPrinting] = useState(false);
  const [printMenuOpen, setPrintMenuOpen] = useState(false);
  const printMenuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (printMenuRef.current && !printMenuRef.current.contains(e.target as Node)) {
        setPrintMenuOpen(false);
      }
    };
    if (printMenuOpen) {
      document.addEventListener('mousedown', handleOutside);
    }
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [printMenuOpen]);

  const handlePrintKot = async (counterName?: string, separateSlips = false) => {
    setIsPrinting(true);
    setPrintMenuOpen(false);
    const toastId = toast.loading(
      counterName && counterName !== 'ALL'
        ? `Preparing KOT for ${counterName}...`
        : separateSlips
        ? `Preparing ${uniqueCounters.length} KOT slips...`
        : `Preparing Master KOT...`
    );

    try {
      const savedPrinter = typeof window !== 'undefined' ? localStorage.getItem('qdine_kot_printer_name') : null;
      const targetPrinter = (savedPrinter || 'POS-80C').trim();
      const savedBridgeUrl = typeof window !== 'undefined' ? localStorage.getItem('qdine_printer_bridge_url') : null;

      const res = await fetch('/api/print/kot', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-restaurant-slug': slug,
        },
        body: JSON.stringify({
          orderId: order.id,
          counterName: counterName || 'ALL',
          separateSlips,
          printerName: targetPrinter,
          orderData: order,
          slug,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to print KOT');
      }

      // If server handled it directly (e.g. running on local Windows machine)
      if (data.mode === 'server') {
        toast.success(data.message || 'KOT printed to POS-80C!', { id: toastId });
        return;
      }

      // If handled via Cloud Print Agent on Cashier PC
      if (data.mode === 'agent') {
        toast.success(data.message || `KOT sent directly to Cashier ${targetPrinter}!`, { id: toastId });
        return;
      }

      // Cloud hosted: Print via local bridge (silent) or 80mm browser thermal driver
      if (data.slips && Array.isArray(data.slips)) {
        for (const slip of data.slips) {
          await printKotFromBrowser({
            kotData: slip.kotData,
            base64Bytes: slip.base64Bytes,
            printerName: slip.printerName || data.printer || targetPrinter,
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
          printerName: data.printer || targetPrinter,
          localBridgeUrl: savedBridgeUrl ? `${savedBridgeUrl.replace(/\/+$/, '')}/print` : undefined,
        });
        if (clientRes.method === 'bluetooth') {
          toast.success(clientRes.message || 'KOT printed via Bluetooth!', { id: toastId });
        } else if (clientRes.method === 'serial') {
          toast.success(clientRes.message || 'KOT printed via USB!', { id: toastId });
        } else if (clientRes.method === 'bridge') {
          toast.success(clientRes.message || `KOT sent to ${targetPrinter}!`, { id: toastId });
        } else {
          toast.success('KOT thermal ticket printed!', { id: toastId });
        }
      } else {
        toast.success('Print job completed', { id: toastId });
      }
    } catch (err: any) {
      console.error('KOT print error:', err);
      toast.error(err.message || 'Print job failed. Check printer connection.', { id: toastId, duration: 4500 });
    } finally {
      setIsPrinting(false);
    }
  };

  const [isPrintingBill, setIsPrintingBill] = useState(false);

  const handlePrintBill = () => {
    if (isPrintingBill) return;
    setIsPrintingBill(true);
    const toastId = toast.loading('🖨️ Preparing bill...');
    try {
      const billHtml = generateBillReceiptHtml({
        restaurantName: (order as any).restaurant_name || undefined,
        ticketNumber: order.ticket_number,
        orderType: order.order_type || 'DINE_IN',
        tableNumber: order.table_number || undefined,
        customerName: order.customer_name || undefined,
        phone: order.phone || undefined,
        staffName: order.staff_name || undefined,
        createdAt: order.created_at,
        items: (order.items || []).map((i: any) => ({
          name: i.product_name || i.name,
          product_name: i.product_name,
          quantity: i.quantity,
          price_at_purchase: i.price_at_purchase,
          notes: i.notes,
        })),
        subtotal: order.subtotal,
        gstAmount: order.gst_amount,
        gstRate: order.gst_rate,
        gstType: order.gst_type,
        totalPrice: order.total_price,
        paymentMethod: order.payment_method || undefined,
        notes: order.notes || undefined,
      });

      const iframeId = `bill-print-iframe-${Date.now()}`;
      const iframe = document.createElement('iframe');
      iframe.id = iframeId;
      iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:none;z-index:-9999';
      document.body.appendChild(iframe);

      const doc = iframe.contentWindow?.document;
      if (!doc) throw new Error('Cannot access print frame');
      doc.open();
      doc.write(billHtml);
      doc.close();

      const triggerPrint = () => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
          setTimeout(() => { try { iframe.remove(); } catch {} }, 60000);
          toast.success(`Bill #${String(order.ticket_number).padStart(3, '0')} sent to printer!`, { id: toastId });
        } catch {
          toast.success('Bill print initiated!', { id: toastId });
        }
        setIsPrintingBill(false);
      };

      iframe.onload = triggerPrint;
      setTimeout(triggerPrint, 500);
    } catch (err: any) {
      console.error('Bill print error:', err);
      toast.error(err.message || 'Failed to print bill.', { id: toastId });
      setIsPrintingBill(false);
    }
  };

  if (!mounted) return null;

  return createPortal(
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
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
          --radius: 8px;
          --radius-sm: 8px;
          --radius-lg: 8px;
          --radius-full: 8px;
        }
        .order-details-drawer .btn,
        .order-details-drawer button,
        .order-details-drawer a.btn {
          border-radius: 8px !important;
        }
        .order-details-drawer.closing {
          animation: orderDrawerSlideOut 0.18s cubic-bezier(0.16, 1, 0.3, 1) forwards !important;
        }
        .order-details-body,
        .order-details-drawer {
          scrollbar-width: thin;
          scrollbar-color: #94A3B8 #F8FAFC;
        }
        .order-details-body::-webkit-scrollbar,
        .order-details-drawer::-webkit-scrollbar {
          width: 8px;
        }
        .order-details-body::-webkit-scrollbar-track,
        .order-details-drawer::-webkit-scrollbar-track {
          background: #F8FAFC;
        }
        .order-details-body::-webkit-scrollbar-thumb,
        .order-details-drawer::-webkit-scrollbar-thumb {
          background: #94A3B8;
          border-radius: 6px;
        }
        .order-details-body::-webkit-scrollbar-thumb:hover,
        .order-details-drawer::-webkit-scrollbar-thumb:hover {
          background: #64748B;
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
          overflow: 'hidden',
          borderRadius: 0,
          border: 'none',
          borderLeft: '1px solid #E2E8F0',
          margin: 0,
          padding: 0,
          boxSizing: 'border-box',
        }}
      >
        {/* 1. FIXED HEADER */}
        <div
          style={{
            flexShrink: 0,
            background: 'white',
            padding: '20px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: '16px',
            zIndex: 10,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '10px' }}>
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

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '12px', color: '#64748B', flexWrap: 'wrap' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                <Calendar size={13} style={{ color: '#94A3B8' }} />
                {formatDateTime(order.created_at)}
              </span>
              {order.table_number && (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    fontWeight: 700,
                    fontSize: '12px',
                    color: '#92400E',
                    backgroundColor: '#FEF3C7',
                    border: '1px solid #FDE68A',
                    padding: '3px 9px',
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
          {/* Print KOT Button */}
          <div ref={printMenuRef} style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => {
                if (uniqueCounters.length <= 1) {
                  handlePrintKot(uniqueCounters[0] || 'ALL');
                } else {
                  setPrintMenuOpen(!printMenuOpen);
                }
              }}
              disabled={isPrinting || itemsWithCounter.length === 0}
              className="btn btn-secondary btn-sm"
              style={{
                padding: '0 10px',
                height: '30px',
                fontSize: '12px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                fontWeight: 600,
                borderRadius: '8px',
                background: '#F8FAFC',
                border: '1px solid #E2E8F0',
                color: '#0F172A',
                cursor: isPrinting ? 'wait' : 'pointer',
              }}
              title={
                uniqueCounters.length <= 1
                  ? `Print KOT (${uniqueCounters[0] || 'All Items'}) to POS-80C`
                  : 'Print KOT by Counter'
              }
            >
              {isPrinting ? (
                <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />
              ) : (
                <Printer size={13} style={{ color: 'var(--primary, #2563eb)' }} />
              )}
              <span>Print KOT</span>
              {uniqueCounters.length > 1 && (
                <ChevronDown size={12} style={{ color: '#64748B', marginLeft: '-2px' }} />
              )}
            </button>

            {/* Dropdown Menu when multiple counters exist */}
            {printMenuOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 6px)',
                  right: 0,
                  zIndex: 100,
                  background: '#FFFFFF',
                  borderRadius: '8px',
                  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                  border: '1px solid #E2E8F0',
                  padding: '6px',
                  minWidth: '220px',
                }}
              >
                <div style={{ padding: '4px 8px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94A3B8' }}>
                  Print KOT by Counter
                </div>

                {/* Print individual counters */}
                {uniqueCounters.map((cName) => {
                  const count = counterGroups[cName]?.length || 0;
                  return (
                    <button
                      key={cName}
                      type="button"
                      onClick={() => handlePrintKot(cName)}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: '7px 10px',
                        borderRadius: '6px',
                        border: 'none',
                        background: 'transparent',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: '12px',
                        fontWeight: 600,
                        color: '#0F172A',
                        cursor: 'pointer',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#F8FAFC')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <span>{cName}</span>
                      <span style={{ fontSize: '11px', color: '#64748B', background: '#F1F5F9', padding: '1px 6px', borderRadius: '4px' }}>
                        {count} {count === 1 ? 'item' : 'items'}
                      </span>
                    </button>
                  );
                })}

                <div style={{ height: '1px', background: '#F1F5F9', margin: '4px 0' }} />

                {/* Option: Separate slips for all counters */}
                <button
                  type="button"
                  onClick={() => handlePrintKot('ALL', true)}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '7px 10px',
                    borderRadius: '6px',
                    border: 'none',
                    background: 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '12px',
                    fontWeight: 700,
                    color: 'var(--primary, #2563eb)',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#EFF6FF')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <span>All Counters (Separate Slips)</span>
                  <span style={{ fontSize: '10px', opacity: 0.8 }}>{uniqueCounters.length} slips</span>
                </button>

                {/* Option: Combined master KOT */}
                <button
                  type="button"
                  onClick={() => handlePrintKot('ALL', false)}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '7px 10px',
                    borderRadius: '6px',
                    border: 'none',
                    background: 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#64748B',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#F8FAFC')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <span>Combined Master KOT</span>
                  <span style={{ fontSize: '10px' }}>{itemsWithCounter.length} items</span>
                </button>
              </div>
            )}
          </div>

          {/* Print Bill Button */}
          <button
            type="button"
            onClick={handlePrintBill}
            disabled={isPrintingBill || (order.items || []).length === 0}
            className="btn btn-secondary btn-sm"
            style={{
              padding: '0 10px',
              height: '30px',
              fontSize: '12px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              fontWeight: 600,
              borderRadius: '8px',
              background: isPrintingBill ? '#F8FAFC' : '#ECFDF5',
              border: '1px solid #6EE7B7',
              color: '#065F46',
              cursor: isPrintingBill ? 'wait' : 'pointer',
              flexShrink: 0,
            }}
            title="Print customer bill / receipt"
          >
            {isPrintingBill ? (
              <Loader2 size={13} style={{ animation: 'spin 1s linear infinite', color: '#065F46' }} />
            ) : (
              <CreditCard size={13} style={{ color: '#059669' }} />
            )}
            <span>Print Bill</span>
          </button>

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
              borderRadius: '8px',
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
              borderRadius: '8px',
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

      {/* 2. SCROLLABLE CONTENT BODY */}
      <div
        className="order-details-body"
        style={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          overflowX: 'hidden',
          paddingBottom: '80px',
        }}
      >

        {/* SECTION: CUSTOMER DETAILS */}
        <div style={{ padding: '18px 20px', borderBottom: '1px solid #F1F5F9' }}>
          <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94A3B8', marginBottom: '12px' }}>
            Customer Details
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <User size={15} style={{ color: '#94A3B8', flexShrink: 0 }} />
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Phone size={15} style={{ color: '#94A3B8', flexShrink: 0 }} />
                <a
                  href={`tel:${order.phone}`}
                  style={{ fontSize: '12px', color: '#334155', textDecoration: 'none' }}
                >
                  {order.phone}
                </a>
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Users size={15} style={{ color: '#94A3B8', flexShrink: 0 }} />
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
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.product_name}
                        </span>
                        {item.counter && (
                          <span
                            style={{
                              fontSize: '10px',
                              fontWeight: 700,
                              padding: '1px 5px',
                              borderRadius: '4px',
                              backgroundColor: '#EEF2FF',
                              color: '#4F46E5',
                              border: '1px solid #E0E7FF',
                              flexShrink: 0,
                            }}
                          >
                            {item.counter}
                          </span>
                        )}
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
                {formatPrice(
                  (order.items && order.items.length > 0)
                    ? order.items.reduce((acc, item) => acc + (Number(item.price_at_purchase || 0) * Number(item.quantity || 0)), 0)
                    : (order.subtotal || (order.gst_amount ? order.total_price - order.gst_amount : order.total_price))
                )}
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
                    style={{ height: '34px', padding: '0 12px', fontSize: '12px', borderRadius: '8px' }}
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
                style={{ height: '36px', padding: '0 12px', fontSize: '12px', whiteSpace: 'nowrap', borderRadius: '8px' }}
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

