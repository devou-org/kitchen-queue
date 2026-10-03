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
  Banknote,
  QrCode,
  Check,
  ChefHat,
  Split,
  ArrowRight,
} from 'lucide-react';
import toast from 'react-hot-toast';
import SplitPaymentBreakdown, { SplitAmounts, formatSplitSummary, parseSplitFromSummary, normalizeSplitAmounts } from './SplitPaymentBreakdown';
import OrderTypeBadge from './OrderTypeBadge';
import OrderStatusBadge from './OrderStatusBadge';
import { printKotFromBrowser, printBillFromBrowser } from '@/lib/client-print';
import { printBillTemplateDirectly } from '@/components/BillTemplate';
import { useRestaurant } from '@/hooks/useRestaurant';
import { orderService } from '@/app/services/orders.api';
import { EditOrderModal } from './EditOrderModal';

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
  onOrderUpdated?: (updatedOrder: Order) => void;
}

export function OrderDetailsView({
  order: initialOrder,
  slug,
  isStaff = false,
  tables = [],
  allStatuses = ['PENDING', 'PREPARING', 'READY', 'SERVED', 'CLOSED', 'CANCELLED'],
  onClose,
  onBack,
  onStatusChange,
  loading = false,
  onOrderUpdated,
}: OrderDetailsViewProps) {
  const { restaurant } = useRestaurant();
  const primaryColor = restaurant?.primary_color || '#4F46E5';

  const primarySoftBg = React.useMemo(() => {
    if (!primaryColor || typeof primaryColor !== 'string') return 'rgba(79, 70, 229, 0.08)';
    let c = primaryColor.replace('#', '').trim();
    if (c.length === 3) c = c.split('').map((x) => x + x).join('');
    if (c.length === 6) {
      const num = parseInt(c, 16);
      return `rgba(${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}, 0.08)`;
    }
    return 'rgba(79, 70, 229, 0.08)';
  }, [primaryColor]);

  const primaryBorder = React.useMemo(() => {
    if (!primaryColor || typeof primaryColor !== 'string') return 'rgba(79, 70, 229, 0.25)';
    let c = primaryColor.replace('#', '').trim();
    if (c.length === 3) c = c.split('').map((x) => x + x).join('');
    if (c.length === 6) {
      const num = parseInt(c, 16);
      return `rgba(${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}, 0.25)`;
    }
    return 'rgba(79, 70, 229, 0.25)';
  }, [primaryColor]);
  const [order, setOrder] = useState<Order>(initialOrder);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [tempStatus, setTempStatus] = useState(initialOrder.status);
  const [tempTableNumber, setTempTableNumber] = useState(initialOrder.table_number || '');
  const [paymentMethod, setPaymentMethod] = useState(initialOrder.payment_method || 'CASH');
  const [splitAmounts, setSplitAmounts] = useState<SplitAmounts>(() => {
    return normalizeSplitAmounts(initialOrder.payment_split, initialOrder.payment_method);
  });
  const [isStatusUpdating, setIsStatusUpdating] = useState(false);
  const [isPaymentUpdating, setIsPaymentUpdating] = useState(false);
  const [isCancelUpdating, setIsCancelUpdating] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  const isAnyActionBusy = isStatusUpdating || isPaymentUpdating || isCancelUpdating || loading;

  React.useEffect(() => {
    setOrder(initialOrder);
    setSplitAmounts(normalizeSplitAmounts(initialOrder.payment_split, initialOrder.payment_method));
  }, [initialOrder]);

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
    setPaymentMethod(order.payment_method || 'CASH');
    setSplitAmounts(normalizeSplitAmounts(order.payment_split, order.payment_method));
    setIsClosing(false);
  }, [order.id, order.status, order.table_number, order.payment_method, order.payment_split]);

  const handleUpdateStatus = async (statusToApply: string) => {
    setIsStatusUpdating(true);
    try {
      let pMethod = statusToApply === 'CLOSED' ? (order.payment_method || paymentMethod || 'CASH') : paymentMethod;
      let pSplit: any = null;

      if (statusToApply === 'CLOSED' && (pMethod === 'SPLIT' || pMethod.toUpperCase().startsWith('SPLIT'))) {
        const totalSplit = (splitAmounts.CASH || 0) + (splitAmounts.UPI || 0) + (splitAmounts.CARD || 0);
        if (totalSplit <= 0) {
          toast.error('Please allocate the split amounts across methods');
          setIsStatusUpdating(false);
          return;
        }
        pMethod = formatSplitSummary(splitAmounts);
        pSplit = splitAmounts;
      }

      await onStatusChange(order.id, statusToApply, tempTableNumber, pMethod);
      setTempStatus(statusToApply as any);
      setOrder((prev) => ({
        ...prev,
        status: statusToApply as any,
        is_paid: statusToApply === 'CLOSED' ? true : prev.is_paid,
        payment_method: statusToApply === 'CLOSED' ? (prev.payment_method || pMethod) : prev.payment_method,
        payment_split: statusToApply === 'CLOSED' ? (pSplit || prev.payment_split) : prev.payment_split,
      }));
      toast.success(`Order status updated to ${statusToApply}`);
    } finally {
      setIsStatusUpdating(false);
    }
  };

  const handleCancelOrder = async () => {
    if (!window.confirm(`Are you sure you want to cancel Order #${String(order.ticket_number).padStart(3, '0')}?`)) {
      return;
    }
    setIsCancelUpdating(true);
    try {
      await onStatusChange(order.id, 'CANCELLED', tempTableNumber || order.table_number, paymentMethod);
      setOrder((prev) => ({ ...prev, status: 'CANCELLED', is_paid: false }));
      toast.success('Order cancelled');
    } catch {
      toast.error('Failed to cancel order');
    } finally {
      setIsCancelUpdating(false);
    }
  };

  const handleMarkAsPaid = async (methodToUse?: string) => {
    setIsPaymentUpdating(true);
    try {
      let pMethod = methodToUse || paymentMethod || order.payment_method || 'CASH';
      let pSplit: any = null;

      if (pMethod === 'SPLIT' || pMethod.toUpperCase().startsWith('SPLIT')) {
        const totalSplit = (splitAmounts.CASH || 0) + (splitAmounts.UPI || 0) + (splitAmounts.CARD || 0);
        if (totalSplit <= 0) {
          toast.error('Please allocate the split amounts across methods');
          setIsPaymentUpdating(false);
          return;
        }
        pMethod = formatSplitSummary(splitAmounts);
        pSplit = splitAmounts;
      }

      const currentSt = (order.status || '').toUpperCase();
      // If food is ALREADY served (fulfilled), paying closes the order.
      // If food is still PENDING, PREPARING, or READY, keep kitchen status unchanged as stated in the UI ("Record payment without changing kitchen status")!
      const targetStatus = currentSt === 'SERVED' ? 'CLOSED' : order.status;

      const res = await orderService.updateOrder(order.id, {
        status: targetStatus,
        is_paid: true,
        payment_method: pMethod,
        payment_split: pSplit,
        table_number: tempTableNumber || order.table_number,
      });
      if (res.success && res.data) {
        setOrder(res.data);
        setTempStatus(res.data.status);
        setPaymentMethod(res.data.payment_method || pMethod);
        if (onOrderUpdated) onOrderUpdated(res.data);
        if (targetStatus === 'CLOSED') {
          toast.success(`Payment recorded as Paid (${pMethod}) & Order Closed`);
        } else {
          toast.success(`Payment recorded as Paid (${pMethod})`);
        }
      } else {
        toast.error(res.error || 'Failed to update payment');
      }
    } catch {
      toast.error('Network error updating payment');
    } finally {
      setIsPaymentUpdating(false);
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
      const c = (item.counter || '').trim() || 'Kitchen';
      if (!map[c]) map[c] = [];
      map[c].push(item);
    }
    return map;
  }, [itemsWithCounter]);

  const uniqueCounters = React.useMemo(() => Object.keys(counterGroups), [counterGroups]);

  const [updatingCounters, setUpdatingCounters] = useState<Record<string, boolean>>({});

  const getItemStatusBadgeConfig = (status?: string) => {
    const s = (status || 'PENDING').toUpperCase();
    switch (s) {
      case 'PREPARING':
        return { label: 'Preparing', bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE' };
      case 'READY':
        return { label: 'Ready', bg: '#ECFDF5', text: '#047857', border: '#A7F3D0' };
      case 'SERVED':
        return { label: 'Served', bg: '#F5F3FF', text: '#6D28D9', border: '#DDD6FE' };
      case 'CANCELLED':
        return { label: 'Cancelled', bg: '#FEF2F2', text: '#B91C1C', border: '#FECACA' };
      case 'PENDING':
      default:
        return { label: 'Pending', bg: '#FFF7ED', text: '#C2410C', border: '#FFEDD5' };
    }
  };

  const handleCounterStatusChange = async (counterName: string, nextStatus: string) => {
    setUpdatingCounters(prev => ({ ...prev, [counterName]: true }));
    try {
      const itemsInCounter = counterGroups[counterName] || [];
      const itemIds = itemsInCounter.map((i: any) => i.id).filter(Boolean);

      const res = await orderService.updateOrderItemStatus(order.id, {
        counter: counterName,
        item_ids: itemIds,
        status: nextStatus,
      });
      if (res.success && res.data) {
        setOrder(res.data);
        setTempStatus(res.data.status);
        if (onOrderUpdated) onOrderUpdated(res.data);
        toast.success(`All ${counterName} items marked as ${nextStatus === 'SERVED' ? 'Served' : 'Ready'}`);
      } else {
        toast.error(res.error || 'Failed to update counter items');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setUpdatingCounters(prev => ({ ...prev, [counterName]: false }));
    }
  };

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

  const handlePrintBill = async () => {
    if (isPrintingBill) return;
    setIsPrintingBill(true);

    const savedPrinter = typeof window !== 'undefined'
      ? (localStorage.getItem('qdine_bill_printer_name') || localStorage.getItem('qdine_kot_printer_name') || 'POS-80C')
      : 'POS-80C';

    const toastId = toast.loading(`🖨️ Printing Bill #${String(order.ticket_number).padStart(3, '0')} to ${savedPrinter}...`);

    try {
      // Send print job directly to POS-80C thermal printer (1-click instant silent print)
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

      if (data.mode === 'server' || data.mode === 'agent') {
        toast.success(data.message || `Bill #${String(order.ticket_number).padStart(3, '0')} printed to ${savedPrinter}!`, { id: toastId });
        return;
      }

      // Cloud hosted (VPS): Print via hardware (Bluetooth/USB/RawBT/local bridge) or 80mm browser thermal driver
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
      try {
        printBillTemplateDirectly(order, restaurant ? {
          name: restaurant.name,
          logo_url: restaurant.logo_url,
          address: restaurant.address,
          phone: restaurant.phone,
          primary_color: restaurant.primary_color,
          gst_number: restaurant.gst_number,
        } : undefined);
        toast.success(`Bill #${String(order.ticket_number).padStart(3, '0')} sent to printer!`, { id: toastId });
      } catch {
        toast.error(err.message || 'Failed to print bill. Check printer connection.', { id: toastId });
      }
    } finally {
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
          width: '460px',
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
            padding: '16px 20px',
            borderBottom: '1px solid var(--border)',
            zIndex: 10,
          }}
        >
          {/* Top Row: Ticket Number + Badges + Close Button */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              width: '100%',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', minWidth: 0 }}>
              <span
                style={{
                  fontSize: '20px',
                  fontWeight: 800,
                  color: '#0F172A',
                  fontFamily: 'monospace, var(--font-mono)',
                  letterSpacing: '-0.02em',
                }}
              >
                #{String(order.ticket_number).padStart(3, '0')}
              </span>
              <OrderTypeBadge type={order.order_type} variant="minimal" />
              <OrderStatusBadge status={order.status} />
              {order.order_type !== 'TAKEAWAY' && order.order_type !== 'DELIVERY' && order.table_number && (
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
                  <MapPin size={11} style={{ color: '#D97706', flexShrink: 0 }} />
                  {order.table_number.toLowerCase().startsWith('table') ? order.table_number : `Table ${order.table_number}`}
                </span>
              )}
            </div>

            {/* Close Button */}
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
              title="Close Details (Esc)"
            >
              <X size={16} />
            </button>
          </div>

          {/* Date & Time Row */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px',
              color: '#64748B',
              marginTop: '6px',
            }}
          >
            <Calendar size={13} style={{ color: '#94A3B8', flexShrink: 0 }} />
            <span>{formatDateTime(order.created_at)}</span>
          </div>

          {/* Actions Toolbar Row */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '8px',
              marginTop: '14px',
            }}
          >
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
                style={{
                  width: '100%',
                  padding: '0 8px',
                  height: '34px',
                  fontSize: '12px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '5px',
                  fontWeight: 600,
                  borderRadius: '8px',
                  background: isPrinting ? '#F8FAFC' : '#FFFFFF',
                  border: '1px solid #CBD5E1',
                  color: '#0F172A',
                  cursor: isPrinting ? 'wait' : 'pointer',
                  boxSizing: 'border-box',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => { if (!isPrinting) e.currentTarget.style.background = '#F8FAFC'; }}
                onMouseLeave={(e) => { if (!isPrinting) e.currentTarget.style.background = '#FFFFFF'; }}
                title={
                  uniqueCounters.length <= 1
                    ? `Print KOT (${uniqueCounters[0] || 'All Items'}) to POS-80C`
                    : 'Print KOT by Counter'
                }
              >
                {isPrinting ? (
                  <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />
                ) : (
                  <Printer size={13} style={{ color: '#475569' }} />
                )}
                <span>Print KOT</span>
                {uniqueCounters.length > 1 && (
                  <ChevronDown size={12} style={{ color: '#64748B', marginLeft: '1px' }} />
                )}
              </button>

              {/* Dropdown Menu when multiple counters exist */}
              {printMenuOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 6px)',
                    left: 0,
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
                      color: primaryColor,
                      cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = primarySoftBg)}
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
              style={{
                width: '100%',
                padding: '0 8px',
                height: '34px',
                fontSize: '12px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '5px',
                fontWeight: 600,
                borderRadius: '8px',
                background: isPrintingBill ? '#F8FAFC' : '#FFFFFF',
                border: '1px solid #CBD5E1',
                color: '#0F172A',
                cursor: isPrintingBill ? 'wait' : 'pointer',
                boxSizing: 'border-box',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => { if (!isPrintingBill) e.currentTarget.style.background = '#F8FAFC'; }}
              onMouseLeave={(e) => { if (!isPrintingBill) e.currentTarget.style.background = '#FFFFFF'; }}
              title="Print customer bill / receipt"
            >
              {isPrintingBill ? (
                <Loader2 size={13} style={{ animation: 'spin 1s linear infinite', color: '#475569' }} />
              ) : (
                <CreditCard size={13} style={{ color: '#475569' }} />
              )}
              <span>Print Bill</span>
            </button>

            {/* Edit Button - Opens minimal popup modal with 8px radius */}
            <button
              type="button"
              onClick={() => setIsEditModalOpen(true)}
              style={{
                width: '100%',
                padding: '0 8px',
                height: '34px',
                fontSize: '12px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '5px',
                fontWeight: 600,
                borderRadius: '8px',
                background: '#FFFFFF',
                border: '1px solid #CBD5E1',
                color: '#0F172A',
                boxSizing: 'border-box',
                whiteSpace: 'nowrap',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#F8FAFC')}
              onMouseLeave={(e) => (e.currentTarget.style.background = '#FFFFFF')}
              title="Edit Order"
            >
              <Pencil size={13} style={{ color: '#64748B' }} />
              <span>Edit</span>
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



        {/* SECTION: KITCHEN WORKFLOW LIFECYCLE CONTROLS */}
        {(() => {
          const isKot = (restaurant?.kitchen_mode || 'KOT').toUpperCase() !== 'KDS';
          const currentSt = (order.status || 'PENDING').toUpperCase();

          let nextTargetStatus: string | null = null;
          let nextButtonLabel = '';
          let buttonBg = primaryColor;

          if (currentSt === 'PENDING') {
            nextTargetStatus = 'PREPARING';
            nextButtonLabel = 'Start Preparing (Kitchen)';
            buttonBg = primaryColor;
          } else if (currentSt === 'PREPARING') {
            if (isKot) {
              nextTargetStatus = 'SERVED';
              nextButtonLabel = 'Mark Order as Served';
              buttonBg = primaryColor;
            } else {
              nextTargetStatus = 'READY';
              nextButtonLabel = 'Mark Order as Ready';
              buttonBg = primaryColor;
            }
          } else if (currentSt === 'READY') {
            nextTargetStatus = 'SERVED';
            nextButtonLabel = 'Mark Order as Served';
            buttonBg = primaryColor;
          } else if (currentSt === 'SERVED') {
            nextTargetStatus = 'CLOSED';
            nextButtonLabel = 'Close Order & Complete';
            buttonBg = '#0F172A';
          }

          if (!nextTargetStatus && currentSt !== 'CLOSED') {
            return null;
          }

          return (
            <div style={{ padding: '14px 20px', borderBottom: '1px solid #F1F5F9', background: '#FAFAFA' }}>
              {/* Action Button */}
              {nextTargetStatus && currentSt !== 'CANCELLED' && currentSt !== 'EXPIRED' && (
                <button
                  type="button"
                  disabled={isAnyActionBusy}
                  onClick={() => handleUpdateStatus(nextTargetStatus!)}
                  style={{
                    width: '100%',
                    height: '36px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    borderRadius: '8px',
                    border: 'none',
                    background: buttonBg,
                    color: '#FFFFFF',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: isAnyActionBusy ? 'not-allowed' : 'pointer',
                    opacity: isAnyActionBusy && !isStatusUpdating ? 0.7 : 1,
                    boxShadow: `0 2px 8px ${primaryBorder}`,
                    transition: 'all 0.15s ease',
                  }}
                >
                  {isStatusUpdating ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <CheckCircle2 size={14} />
                  )}
                  <span>{isStatusUpdating ? 'Updating Status...' : nextButtonLabel}</span>
                </button>
              )}

              {currentSt === 'CLOSED' && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '8px', background: '#F1F5F9', borderRadius: '8px', color: '#475569', fontSize: '12px', fontWeight: 700 }}>
                  <Check size={14} style={{ color: '#16A34A' }} />
                  <span>Order is Closed & Completed</span>
                </div>
              )}
            </div>
          );
        })()}

        {/* SECTION: ORDER ITEMS (COUNTER ROUTED & PER-ITEM STATUS) */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #F1F5F9' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748B', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Utensils size={13} />
              Order Items ({totalItemsCount})
            </span>
            {uniqueCounters.length > 1 && (
              <span style={{ fontSize: '10px', fontWeight: 700, color: '#4F46E5', background: '#EEF2FF', padding: '2px 8px', borderRadius: '12px', border: '1px solid #E0E7FF' }}>
                {uniqueCounters.length} Counters
              </span>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {uniqueCounters.length > 0 ? (
              uniqueCounters.map((cName) => {
                const itemsInCounter = counterGroups[cName] || [];
                const isKot = (restaurant?.kitchen_mode || 'KOT').toUpperCase() !== 'KDS';
                const targetCompletionStatus = isKot ? 'SERVED' : 'READY';
                const completionLabel = isKot ? 'Served' : 'Ready';

                const readyCount = itemsInCounter.filter((i: any) => {
                  const st = (i.status || 'PENDING').toUpperCase();
                  return isKot ? st === 'SERVED' : ['READY', 'SERVED'].includes(st);
                }).length;
                const isAllReady = itemsInCounter.length > 0 && readyCount === itemsInCounter.length;
                const isCounterUpdating = Boolean(updatingCounters[cName]);

                return (
                  <div
                    key={cName}
                    style={{
                      borderRadius: '8px',
                      border: '1px solid #E2E8F0',
                      background: '#FFFFFF',
                      overflow: 'hidden',
                    }}
                  >
                    {/* Counter Station Header */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        background: '#F8FAFC',
                        borderBottom: '1px solid #E2E8F0',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '22px',
                            height: '22px',
                            borderRadius: '5px',
                            background: primarySoftBg,
                            color: primaryColor,
                          }}
                        >
                          <ChefHat size={13} />
                        </span>
                        <div>
                          <span style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>
                            {cName}
                          </span>
                          <span style={{ fontSize: '11px', color: '#64748B', marginLeft: '6px' }}>
                            ({readyCount}/{itemsInCounter.length} {completionLabel})
                          </span>
                        </div>
                      </div>

                      {/* Station Bulk Action */}
                      <div>
                        {isAllReady ? (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '11px',
                              fontWeight: 700,
                              color: '#475569',
                              background: '#F1F5F9',
                              border: '1px solid #E2E8F0',
                              padding: '3px 8px',
                              borderRadius: '6px',
                            }}
                          >
                            <Check size={12} /> All {completionLabel}
                          </span>
                        ) : (
                          <button
                            type="button"
                            disabled={isCounterUpdating}
                            onClick={() => handleCounterStatusChange(cName, targetCompletionStatus)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              fontSize: '11px',
                              fontWeight: 700,
                              color: primaryColor,
                              background: primarySoftBg,
                              border: `1px solid ${primaryBorder}`,
                              padding: '4px 10px',
                              borderRadius: '6px',
                              cursor: isCounterUpdating ? 'not-allowed' : 'pointer',
                              transition: 'all 0.15s ease',
                            }}
                            title={`Mark all items for ${cName} as ${completionLabel}`}
                          >
                            {isCounterUpdating ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : (
                              <CheckCircle2 size={12} />
                            )}
                            Mark {cName} {completionLabel}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Counter Items List */}
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      {itemsInCounter.map((item: any, idx: number) => {
                        const statusConfig = getItemStatusBadgeConfig(item.status);

                        return (
                          <div
                            key={item.id || idx}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              padding: '9px 12px',
                              borderBottom: idx < itemsInCounter.length - 1 ? '1px solid #F1F5F9' : 'none',
                              background: idx % 2 === 0 ? '#FFFFFF' : '#FAFAFA',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
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
                              <div style={{ minWidth: 0, flex: 1 }}>
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
                                  {Number(item.price_at_purchase || 0) === 0 ? (
                                    <span style={{ color: '#16A34A', fontWeight: 700 }}>₹0.00 (FREE)</span>
                                  ) : (
                                    `${formatPrice(item.price_at_purchase)} each`
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Item Status (Static Badge) & Price */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  color: statusConfig.text,
                                  background: statusConfig.bg,
                                  border: `1px solid ${statusConfig.border}`,
                                  padding: '3px 8px',
                                  borderRadius: '6px',
                                  userSelect: 'none',
                                }}
                              >
                                <span
                                  style={{
                                    width: '6px',
                                    height: '6px',
                                    borderRadius: '50%',
                                    backgroundColor: statusConfig.text,
                                  }}
                                />
                                {statusConfig.label}
                              </span>

                              <div
                                style={{
                                  fontSize: '13px',
                                  fontWeight: 700,
                                  color: Number(item.price_at_purchase || 0) === 0 ? '#16A34A' : '#0F172A',
                                  fontVariantNumeric: 'tabular-nums',
                                  minWidth: '60px',
                                  textAlign: 'right',
                                }}
                              >
                                {Number(item.price_at_purchase || 0) === 0 ? '₹0.00' : formatPrice(item.price_at_purchase * item.quantity)}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })
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

            {order.discount_amount && Number(order.discount_amount) > 0 ? (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#16a34a', fontWeight: 700 }}>
                <span>Loyalty Discount</span>
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                  -{formatPrice(order.discount_amount)}
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
                  color: '#0F172A',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {formatPrice(order.total_price)}
              </div>
            </div>

            <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '11px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748B' }}>Payment</span>
                {order.is_paid ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#15803D', fontWeight: 600 }}>
                    <CheckCircle2 size={12} /> Paid ({order.payment_method || 'Settled'})
                  </span>
                ) : (
                  <span style={{ color: '#B45309', fontWeight: 600 }}>Unpaid</span>
                )}
              </div>

              {!order.is_paid && (
                <div
                  style={{
                    background: '#F0FDF4',
                    border: '1px solid #BBF7D0',
                    borderRadius: '8px',
                    padding: '12px 14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    marginTop: '4px',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <CreditCard size={15} style={{ color: '#16A34A' }} />
                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#15803D' }}>
                      Mark as Paid
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                      paddingTop: '8px',
                      borderTop: '1px solid #DCFCE7',
                    }}
                  >
                    <label
                      style={{
                        fontSize: '10px',
                        fontWeight: 700,
                        color: '#166534',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                      }}
                    >
                      Payment Method
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                      {[
                        { id: 'CASH', label: 'Cash', icon: Banknote },
                        { id: 'UPI', label: 'UPI / QR', icon: QrCode },
                        { id: 'CARD', label: 'Card', icon: CreditCard },
                        { id: 'SPLIT', label: 'Split', icon: Split },
                      ].map((m) => {
                        const Icon = m.icon;
                        const selected = m.id === 'SPLIT'
                          ? (paymentMethod === 'SPLIT' || paymentMethod?.toUpperCase().startsWith('SPLIT'))
                          : (paymentMethod || 'CASH') === m.id;
                        return (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => {
                              if (m.id === 'SPLIT') {
                                if (splitAmounts.CASH === 0 && splitAmounts.UPI === 0 && splitAmounts.CARD === 0) {
                                  const half = Math.round((Number(order.total_price || 0) / 2) * 100) / 100;
                                  const rest = Math.round((Number(order.total_price || 0) - half) * 100) / 100;
                                  const initialSplit = { CASH: half, UPI: rest, CARD: 0 };
                                  setSplitAmounts(initialSplit);
                                  setPaymentMethod(formatSplitSummary(initialSplit));
                                } else {
                                  setPaymentMethod(formatSplitSummary(splitAmounts));
                                }
                              } else {
                                setPaymentMethod(m.id);
                              }
                            }}
                            style={{
                              height: '32px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '4px',
                              borderRadius: '6px',
                              fontSize: '11px',
                              fontWeight: 600,
                              cursor: 'pointer',
                              border: selected ? '1.5px solid #16A34A' : '1px solid #CBD5E1',
                              background: '#FFFFFF',
                              color: selected ? '#15803D' : '#475569',
                              boxShadow: selected ? '0 1px 3px rgba(22, 163, 74, 0.15)' : 'none',
                              transition: 'all 0.15s ease',
                            }}
                          >
                            <Icon size={12} />
                            <span>{m.label}</span>
                          </button>
                        );
                      })}
                    </div>

                    {(paymentMethod === 'SPLIT' || paymentMethod?.toUpperCase().startsWith('SPLIT')) && (
                      <SplitPaymentBreakdown
                        totalAmount={Number(order.total_price || 0)}
                        split={splitAmounts}
                        onChange={(newSplit, summary) => {
                          setSplitAmounts(newSplit);
                          setPaymentMethod(summary);
                        }}
                        theme="emerald"
                      />
                    )}

                    <button
                      type="button"
                      disabled={isAnyActionBusy}
                      onClick={() => handleMarkAsPaid()}
                      style={{
                        marginTop: '4px',
                        width: '100%',
                        height: '34px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        borderRadius: '6px',
                        border: 'none',
                        background: '#16A34A',
                        color: '#FFFFFF',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: isAnyActionBusy ? 'not-allowed' : 'pointer',
                        opacity: isAnyActionBusy && !isPaymentUpdating ? 0.7 : 1,
                        boxShadow: '0 2px 6px rgba(22, 163, 74, 0.25)',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#15803D')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = '#16A34A')}
                    >
                      {isPaymentUpdating ? (
                        <>
                          <Loader2 size={13} className="animate-spin" />
                          <span>Recording Payment...</span>
                        </>
                      ) : (
                        <>
                          <Check size={14} />
                          <span>Confirm as Paid · {paymentMethod?.toUpperCase().startsWith('SPLIT') ? 'Split Payment' : (paymentMethod || 'CASH')}</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

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

        {/* ACTION: CANCEL ORDER (if active) */}
        {order.status !== 'CANCELLED' && (
          <div style={{ padding: '16px 20px', borderTop: '1px solid #F1F5F9', display: 'flex', justifyContent: 'flex-end', background: '#FAFAFA' }}>
            <button
              type="button"
              onClick={handleCancelOrder}
              disabled={isAnyActionBusy}
              style={{
                background: '#FFFFFF',
                border: '1px solid #FECACA',
                borderRadius: '8px',
                color: '#DC2626',
                fontSize: '12px',
                fontWeight: 600,
                padding: '7px 14px',
                cursor: isAnyActionBusy ? 'not-allowed' : 'pointer',
                opacity: isAnyActionBusy && !isCancelUpdating ? 0.7 : 1,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#FEF2F2'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = '#FFFFFF'; }}
            >
              {isCancelUpdating ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  <span>Cancelling...</span>
                </>
              ) : (
                <>
                  <X size={13} />
                  <span>Cancel Order</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </aside>

    <EditOrderModal
      isOpen={isEditModalOpen}
      onClose={() => setIsEditModalOpen(false)}
      order={order}
      slug={slug}
      tables={tables}
      onOrderUpdated={(updated) => {
        setOrder(updated);
        setTempStatus(updated.status);
        setTempTableNumber(updated.table_number || '');
        setPaymentMethod(updated.payment_method || '');
        if (onOrderUpdated) {
          onOrderUpdated(updated);
        }
      }}
    />
  </>,
  document.body
  );
}

export default OrderDetailsView;

