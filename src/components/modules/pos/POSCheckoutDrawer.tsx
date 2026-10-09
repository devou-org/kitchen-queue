'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import {
  X,
  ShoppingBag,
  Plus,
  Minus,
  Trash2,
  Loader2,
  Users,
  MapPin,
  UtensilsCrossed,
  Check,
  FileText,
  User,
  Phone,
  CreditCard,
  Banknote,
  QrCode,
  Gift,
  Tag,
  Award,
  Printer,
  Split,
  BadgeCheck,
} from 'lucide-react';
import { CartItem, OrderType } from '@/types';
import { formatPrice } from '@/lib/format';
import { CustomSelect } from '@/components/ui/CustomSelect';
import OrderTypeSelector from '@/components/modules/orders/OrderTypeSelector';
import { checkTableAssignment } from '@/lib/table-capacity';
import SplitPaymentBreakdown, { SplitAmounts, formatSplitSummary, parseSplitFromSummary } from '@/components/modules/orders/SplitPaymentBreakdown';
import { COUNTRY_CODES, getDefaultCallingCode } from '@/lib/constants';
import { CountryCodeSelect } from '@/components/ui/CountryCodeSelect';

export interface POSOrderFormData {
  customer_name: string;
  phone: string;
  table_number: string;
  party_size: number;
  notes: string;
  order_type: OrderType | string;
  is_paid?: boolean;
  payment_method?: string;
  payment_split?: any;
  discount_amount?: number;
  selected_reward_id?: string;
  auto_print_bill?: boolean;
}

export interface POSCheckoutDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  cart: Map<string, CartItem>;
  onUpdateCart: (id: string, delta: number) => void;
  tables: any[];
  restaurant: any;
  orderForm: POSOrderFormData;
  setOrderForm: React.Dispatch<React.SetStateAction<POSOrderFormData>>;
  onSubmitOrder: (e: React.FormEvent) => void | Promise<any>;
  submitting: boolean;
}

export function POSCheckoutDrawer({
  isOpen,
  onClose,
  cart,
  onUpdateCart,
  tables,
  restaurant,
  orderForm,
  setOrderForm,
  onSubmitOrder,
  submitting,
}: POSCheckoutDrawerProps) {
  const [mounted, setMounted] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [printingBill, setPrintingBill] = useState(false);

  // Compute default country code based on restaurant location
  const defaultCallingCode = useMemo(() => {
    return getDefaultCallingCode(restaurant?.country_code, restaurant?.country);
  }, [restaurant?.country_code, restaurant?.country]);

  // Phone input local state
  const [countryCode, setCountryCode] = useState(defaultCallingCode);
  const [phoneDigits, setPhoneDigits] = useState('');

  // Loyalty & Rewards State
  const [loyaltyProfile, setLoyaltyProfile] = useState<any>(null);
  const [activeRewards, setActiveRewards] = useState<any[]>([]);
  const [selectedReward, setSelectedReward] = useState<any>(null);
  const [loadingLoyalty, setLoadingLoyalty] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Set default payment mode based on order type (Dine-in: Pay Later, Takeaway: Pay Now)
  const prevIsOpenRef = useRef(isOpen);
  useEffect(() => {
    if (isOpen && !prevIsOpenRef.current) {
      if (orderForm.order_type === 'TAKEAWAY') {
        if (!orderForm.is_paid) {
          setOrderForm((prev) => ({
            ...prev,
            is_paid: true,
            payment_method: prev.payment_method || 'CASH',
          }));
        }
      } else {
        if (orderForm.is_paid) {
          setOrderForm((prev) => ({
            ...prev,
            is_paid: false,
          }));
        }
      }
    }
    prevIsOpenRef.current = isOpen;
  }, [isOpen, orderForm.order_type, orderForm.is_paid, setOrderForm]);

  // Sync phoneDigits with orderForm.phone
  useEffect(() => {
    const p = orderForm.phone || '';
    if (!p) {
      setCountryCode(defaultCallingCode);
      setPhoneDigits('');
      return;
    }
    const matched = COUNTRY_CODES.find((c) => p.startsWith(c.code));
    if (matched) {
      setCountryCode(matched.code);
      setPhoneDigits(p.replace(matched.code, '').replace(/\D/g, ''));
    } else if (!p.startsWith('+')) {
      const clean = p.replace(/\D/g, '');
      setPhoneDigits(clean);
      setCountryCode(defaultCallingCode);
    } else {
      setPhoneDigits(p.replace(/\D/g, '').slice(-10));
    }
  }, [orderForm.phone, defaultCallingCode]);

  // Fetch loyalty data on phone change
  useEffect(() => {
    const rawPhone = orderForm.phone || '';
    const cleaned = rawPhone.replace(/\D/g, '');
    const slugStr = restaurant?.slug || '';
    if (!cleaned || cleaned.length < 7 || !slugStr) {
      setLoyaltyProfile(null);
      setActiveRewards([]);
      setSelectedReward(null);
      return;
    }

    let isSubscribed = true;
    setLoadingLoyalty(true);

    Promise.all([
      fetch(`/api/admin/loyalty/customers?slug=${slugStr}&search=${encodeURIComponent(cleaned)}`).then((r) => r.json()),
      fetch(`/api/admin/loyalty/rewards?slug=${slugStr}`).then((r) => r.json()),
    ])
      .then(([custJson, rewJson]) => {
        if (!isSubscribed) return;

        if (custJson.success && Array.isArray(custJson.data)) {
          const match = custJson.data.find(
            (c: any) =>
              (c.phone || '').replace(/\D/g, '').endsWith(cleaned) ||
              cleaned.endsWith((c.phone || '').replace(/\D/g, ''))
          );
          if (match) {
            setLoyaltyProfile({
              id: match.id,
              points_balance: Number(match.points_balance || 0),
              total_visits: Number(match.total_visits || 0),
              total_spent: Number(match.total_spent || 0),
              phone: match.phone,
              name: match.name,
            });
            if (match.name && !orderForm.customer_name) {
              setOrderForm((prev) => ({ ...prev, customer_name: match.name }));
            }
          } else {
            setLoyaltyProfile(null);
          }
        }

        if (rewJson.success && Array.isArray(rewJson.data)) {
          const activeList = rewJson.data.filter((r: any) => r.is_active !== false);
          setActiveRewards(activeList);
        }
      })
      .catch(() => {
        if (isSubscribed) setLoyaltyProfile(null);
      })
      .finally(() => {
        if (isSubscribed) setLoadingLoyalty(false);
      });

    return () => {
      isSubscribed = false;
    };
  }, [orderForm.phone, restaurant?.slug]);

  const handlePrintCurrentBill = async () => {
    if (printingBill || cart.size === 0) {
      if (cart.size === 0) toast.error('Cart is empty');
      return;
    }
    setPrintingBill(true);

    const savedPrinter = typeof window !== 'undefined'
      ? (localStorage.getItem('qdine_bill_printer_name') || localStorage.getItem('qdine_kot_printer_name') || 'POS-80C')
      : 'POS-80C';

    const items = Array.from(cart.values()).map((item) => ({
      product_id: item.product_id,
      product_name: item.name,
      name: item.name,
      quantity: item.quantity,
      price_at_purchase: item.price,
      price: item.price,
    }));

    const targetSlug = restaurant?.slug || (typeof window !== 'undefined' ? window.location.pathname.split('/')[1] : '');

    const billOrderData: any = {
      ticket_number: orderForm.table_number ? `T-${orderForm.table_number}` : 'EST',
      customer_name: orderForm.customer_name || (orderForm.order_type === 'TAKEAWAY' ? 'Takeaway Customer' : (orderForm.table_number ? `Table ${orderForm.table_number}` : 'Customer')),
      phone: orderForm.phone || '',
      table_number: orderForm.table_number || '',
      order_type: orderForm.order_type || 'DINE_IN',
      items,
      subtotal,
      gst_type: restaurant?.gst_type || 'NONE',
      gst_rate: restaurant?.gst_rate || 0,
      gst_amount: gstAmount,
      total_price: totalPrice,
      is_paid: Boolean(orderForm.is_paid),
      payment_method: orderForm.is_paid ? (orderForm.payment_method || 'CASH') : undefined,
      notes: orderForm.notes || '',
      created_at: new Date().toISOString(),
    };

    const toastId = toast.loading('🖨️ Printing Bill...');

    try {
      const res = await fetch('/api/print/bill', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-restaurant-slug': targetSlug,
        },
        body: JSON.stringify({
          printerName: savedPrinter,
          orderData: billOrderData,
          slug: targetSlug,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to print bill');
      }

      if (data.mode === 'server' || data.mode === 'agent') {
        toast.success(data.message || 'Bill printed successfully!', { id: toastId });
        return;
      }

      const { printBillFromBrowser } = await import('@/lib/client-print');
      const savedBridgeUrl = typeof window !== 'undefined' ? localStorage.getItem('qdine_printer_bridge_url') : undefined;
      const clientRes = await printBillFromBrowser({
        base64Bytes: data.base64Bytes,
        billHtml: data.billHtml,
        orderData: billOrderData,
        billData: data.billData,
        printerName: data.printer || savedPrinter,
        ticketNumber: billOrderData.ticket_number,
        localBridgeUrl: savedBridgeUrl ? `${savedBridgeUrl.replace(/\/+$/, '')}/print` : undefined,
      });

      if (clientRes.success) {
        toast.success(clientRes.message || 'Bill printed successfully!', { id: toastId });
      } else {
        toast.error(clientRes.message || 'Failed to print bill. Check printer connection.', { id: toastId });
      }
    } catch (err: any) {
      console.error('Print bill error:', err);
      try {
        const { printBillTemplateDirectly } = await import('@/lib/bill-template-html');
        printBillTemplateDirectly(billOrderData, restaurant);
        toast.success('Bill sent to printer!', { id: toastId });
      } catch (directErr: any) {
        toast.error(err.message || 'Failed to print bill. Check printer connection.', { id: toastId });
      }
    } finally {
      setPrintingBill(false);
    }
  };

  const handleDismiss = () => {
    if (submitting || isClosing) return;
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 180);
  };

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) {
        handleDismiss();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, submitting, isClosing]);

  // Lock body scroll when open
  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen]);

  const totalItems = useMemo(
    () => Array.from(cart.values()).reduce((sum, item) => sum + item.quantity, 0),
    [cart]
  );

  const subtotal = useMemo(
    () => Array.from(cart.values()).reduce((sum, item) => sum + item.price * item.quantity, 0),
    [cart]
  );

  // Compute discount amount
  const loyaltyDiscountAmount = useMemo(() => {
    if (!selectedReward || !loyaltyProfile) return 0;
    if (loyaltyProfile.points_balance < Number(selectedReward.points_required || 0)) return 0;
    if (subtotal < Number(selectedReward.min_purchase_amount || 0)) return 0;

    if (selectedReward.reward_type === 'DISCOUNT_PERCENTAGE') {
      return Math.round(((subtotal * Number(selectedReward.discount_value || 0)) / 100) * 100) / 100;
    }
    return Math.min(subtotal, Number(selectedReward.discount_value || 0));
  }, [selectedReward, loyaltyProfile, subtotal]);

  // Sync discount amount into orderForm
  useEffect(() => {
    setOrderForm((prev) => {
      if (prev.discount_amount === loyaltyDiscountAmount && prev.selected_reward_id === (selectedReward?.id || undefined)) {
        return prev;
      }
      return {
        ...prev,
        discount_amount: loyaltyDiscountAmount,
        selected_reward_id: selectedReward?.id || undefined,
      };
    });
  }, [loyaltyDiscountAmount, selectedReward]);

  const { gstAmount, totalPrice } = useMemo(() => {
    let gst = 0;
    if (restaurant?.gst_type === 'REGULAR') {
      const rate = Number(restaurant.gst_rate) || 0;
      gst = Math.round(((subtotal * rate) / 100) * 100) / 100;
    }
    const finalTotal = Math.max(0, subtotal + gst - loyaltyDiscountAmount);
    return { gstAmount: gst, totalPrice: finalTotal };
  }, [subtotal, restaurant, loyaltyDiscountAmount]);

  const [posSplit, setPosSplit] = useState<SplitAmounts>(() => {
    return (orderForm.payment_split as SplitAmounts) || parseSplitFromSummary(orderForm.payment_method) || { CASH: 0, UPI: 0, CARD: 0 };
  });

  useEffect(() => {
    if (orderForm.payment_split) {
      setPosSplit(orderForm.payment_split as SplitAmounts);
    } else if (orderForm.payment_method?.toUpperCase().startsWith('SPLIT')) {
      const parsed = parseSplitFromSummary(orderForm.payment_method);
      if (parsed) setPosSplit(parsed);
    }
  }, [orderForm.payment_method, orderForm.payment_split]);

  // Helper to calculate max free seats for a table
  const getTableFreeSeats = (table: any, partyContext?: { phone?: string; customerName?: string }): number => {
    if (!table) return 1;
    const cap = Number(table.capacity) || 1;
    const check = checkTableAssignment(table, 1, partyContext);
    const seated = check.occupiedSeats || 0;
    const free = cap - seated;
    return free > 0 ? free : 1;
  };

  // Dynamic Person Options based on selected table's max free seats
  const personOptions = useMemo(() => {
    const selectedTable = tables.find(
      (t: any) => String(t.table_number) === String(orderForm.table_number)
    );
    const maxFree = selectedTable
      ? getTableFreeSeats(selectedTable, {
          phone: orderForm.phone,
          customerName: orderForm.customer_name,
        })
      : 15;

    return Array.from({ length: Math.max(1, maxFree) }, (_, i) => ({
      value: String(i + 1),
      label: `${i + 1} ${i === 0 ? 'Person' : 'Persons'}`,
    }));
  }, [tables, orderForm.table_number, orderForm.phone, orderForm.customer_name]);

  // Ensure party_size is always clamped to max free seats on the selected table
  useEffect(() => {
    if (orderForm.table_number && tables.length > 0) {
      const selectedTable = tables.find(
        (t: any) => String(t.table_number) === String(orderForm.table_number)
      );
      if (selectedTable) {
        const maxFree = getTableFreeSeats(selectedTable, {
          phone: orderForm.phone,
          customerName: orderForm.customer_name,
        });
        if (!orderForm.party_size || orderForm.party_size > maxFree) {
          setOrderForm((prev) => ({ ...prev, party_size: maxFree }));
        }
      }
    }
  }, [orderForm.table_number, tables, orderForm.party_size, orderForm.phone, orderForm.customer_name, setOrderForm]);

  // Table Options for CustomSelect
  const tableOptions = useMemo(() => {
    const list = [
      { value: '', label: '-- Select Table --' },
      ...tables
        .filter((t: any) => {
          const check = checkTableAssignment(t, 1, {
            phone: orderForm.phone,
            customerName: orderForm.customer_name,
          });
          const isCurrent = t.table_number === orderForm.table_number;
          return check.allowed || isCurrent;
        })
        .map((t: any) => {
          const check = checkTableAssignment(t, 1, {
            phone: orderForm.phone,
            customerName: orderForm.customer_name,
          });
          const cap = Number(t.capacity) || 0;
          const seated = check.occupiedSeats;

          const rawNum = String(t.table_number || '').trim();
          let tableLabel = rawNum;
          if (/^\d+$/.test(rawNum)) {
            tableLabel = `T${rawNum}`;
          } else if (rawNum.toLowerCase().startsWith('t-')) {
            tableLabel = `T-${rawNum.slice(2)}`;
          } else if (rawNum.toLowerCase().startsWith('t') && !rawNum.toLowerCase().startsWith('table')) {
            tableLabel = `T${rawNum.slice(1)}`;
          } else if (rawNum.toLowerCase().startsWith('table #')) {
            const c = rawNum.slice(7).trim();
            tableLabel = /^\d+$/.test(c) ? `T${c}` : c;
          } else if (rawNum.toLowerCase().startsWith('table ')) {
            const c = rawNum.slice(6).trim();
            tableLabel = /^\d+$/.test(c) ? `T${c}` : c;
          }

          const freeSeats = Math.max(0, cap - seated);

          return {
            value: String(t.table_number),
            label: `${tableLabel} · ${seated}/${cap} (${freeSeats} Free)`,
          };
        }),
    ];

    // Ensure selected table is included if currently selected but outside filter
    if (
      orderForm.table_number &&
      !list.some((opt) => opt.value === String(orderForm.table_number))
    ) {
      list.push({
        value: String(orderForm.table_number),
        label: `Table ${orderForm.table_number}`,
      });
    }

    return list;
  }, [tables, orderForm.phone, orderForm.customer_name, orderForm.table_number]);

  if (!mounted || !isOpen) return null;

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100000,
        margin: 0,
        padding: 0,
      }}
    >
      <style>{`
        @keyframes posSideDrawerIn {
          from {
            transform: translateX(100%);
          }
          to {
            transform: translateX(0);
          }
        }
        @keyframes posSideDrawerOut {
          from {
            transform: translateX(0);
          }
          to {
            transform: translateX(100%);
          }
        }
        @keyframes posBackdropIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes posBackdropOut {
          from { opacity: 1; }
          to { opacity: 0; }
        }
        .pos-checkout-backdrop {
          animation: posBackdropIn 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .pos-checkout-backdrop.closing {
          animation: posBackdropOut 0.18s ease forwards;
        }
        .pos-checkout-drawer {
          animation: posSideDrawerIn 0.22s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .pos-checkout-drawer.closing {
          animation: posSideDrawerOut 0.18s ease forwards;
        }
        @media (max-width: 480px) {
          .pos-checkout-drawer {
            width: 100vw !important;
          }
        }
      `}</style>

      {/* Backdrop with blur */}
      <div
        className={`pos-checkout-backdrop ${isClosing ? 'closing' : ''}`}
        onClick={handleDismiss}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.42)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
          zIndex: 100000,
        }}
      />

      {/* Slide-over Side Drawer Panel */}
      <aside
        className={`pos-checkout-drawer ${isClosing ? 'closing' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="POS Checkout"
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: '480px',
          maxWidth: '100vw',
          height: '100vh',
          background: '#FFFFFF',
          zIndex: 100001,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '-10px 0 35px rgba(0, 0, 0, 0.16)',
          borderLeft: '1px solid #E2E8F0',
          boxSizing: 'border-box',
          overflow: 'hidden',
        }}
      >
        {/* 1. Header */}
        <div
          style={{
            height: '64px',
            minHeight: '64px',
            padding: '0 20px',
            borderBottom: '1px solid #F1F5F9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#FFFFFF',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '8px',
                background: 'rgba(151, 19, 69, 0.08)',
                color: 'var(--primary, #971345)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ShoppingBag size={18} />
            </div>
            <div>
              <h2
                style={{
                  fontSize: '17px',
                  fontWeight: 800,
                  color: '#0F172A',
                  margin: 0,
                  letterSpacing: '-0.01em',
                }}
              >
                POS Checkout
              </h2>
            </div>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                background: '#F1F5F9',
                color: '#475569',
                padding: '3px 8px',
                borderRadius: '8px',
                border: '1px solid #E2E8F0',
              }}
            >
              {totalItems} {totalItems === 1 ? 'item' : 'items'}
            </span>
          </div>

          <button
            type="button"
            onClick={handleDismiss}
            disabled={submitting}
            style={{
              background: '#F1F5F9',
              border: 'none',
              borderRadius: '8px',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: submitting ? 'not-allowed' : 'pointer',
              color: '#64748B',
              transition: 'background 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#E2E8F0')}
            onMouseLeave={(e) => (e.currentTarget.style.background = '#F1F5F9')}
            title="Close Checkout (Esc)"
          >
            <X size={16} />
          </button>
        </div>

        {/* 2. Scrollable Body Form */}
        <form
          onSubmit={onSubmitOrder}
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            {/* Section A: Selected Cart Items */}
            <div
              style={{
                background: '#F8FAFC',
                border: '1px solid #E2E8F0',
                borderRadius: '8px',
                padding: '14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingBottom: '4px',
                }}
              >
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: '#64748B',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <UtensilsCrossed size={13} />
                  <span>Items in Cart</span>
                </span>
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748B' }}>
                  {formatPrice(subtotal)}
                </span>
              </div>

              {cart.size === 0 ? (
                <div
                  style={{
                    textAlign: 'center',
                    padding: '20px',
                    color: '#94A3B8',
                    fontSize: '13px',
                  }}
                >
                  Your cart is empty. Add items from the menu to checkout.
                </div>
              ) : (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    maxHeight: '220px',
                    overflowY: 'auto',
                  }}
                >
                  {Array.from(cart.values()).map((item) => (
                    <div
                      key={item.product_id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '10px',
                        padding: '8px 12px',
                        background: '#FFFFFF',
                        border: '1px solid #E2E8F0',
                        borderRadius: '8px',
                      }}
                    >
                      {/* Name & price */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: '13px',
                            fontWeight: 600,
                            color: '#0F172A',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {item.name}
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748B' }}>
                          {formatPrice(item.price)} each
                        </div>
                      </div>

                      {/* Quantity Stepper */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <button
                          type="button"
                          onClick={() => onUpdateCart(item.product_id, -1)}
                          style={{
                            width: '28px',
                            height: '28px',
                            borderRadius: '8px',
                            border: '1px solid #CBD5E1',
                            background: '#FFFFFF',
                            color: '#0F172A',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                          }}
                          title="Decrease"
                        >
                          <Minus size={12} />
                        </button>

                        <span
                          style={{
                            minWidth: '24px',
                            textAlign: 'center',
                            fontSize: '13px',
                            fontWeight: 700,
                            color: '#0F172A',
                          }}
                        >
                          {item.quantity}
                        </span>

                        <button
                          type="button"
                          onClick={() => onUpdateCart(item.product_id, 1)}
                          style={{
                            width: '28px',
                            height: '28px',
                            borderRadius: '8px',
                            border: '1px solid #CBD5E1',
                            background: '#FFFFFF',
                            color: '#0F172A',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                          }}
                          title="Increase"
                        >
                          <Plus size={12} />
                        </button>
                      </div>

                      {/* Line subtotal */}
                      <div
                        style={{
                          minWidth: '64px',
                          textAlign: 'right',
                          fontSize: '13px',
                          fontWeight: 700,
                          color: '#0F172A',
                        }}
                      >
                        {formatPrice(item.price * item.quantity)}
                      </div>

                      {/* Delete */}
                      <button
                        type="button"
                        onClick={() => onUpdateCart(item.product_id, -item.quantity)}
                        style={{
                          width: '26px',
                          height: '26px',
                          borderRadius: '8px',
                          border: 'none',
                          background: 'transparent',
                          color: '#EF4444',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                        }}
                        title="Remove"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Section B: Order Type Selection */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '11px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: '#64748B',
                  marginBottom: '6px',
                }}
              >
                Order Type
              </label>
              <OrderTypeSelector
                value={(orderForm.order_type as OrderType) || 'DINE_IN'}
                onChange={(val) => {
                  const isTakeaway = val === 'TAKEAWAY';
                  setOrderForm((prev) => ({
                    ...prev,
                    order_type: val,
                    is_paid: isTakeaway ? true : false,
                    payment_method: isTakeaway ? (prev.payment_method || 'CASH') : prev.payment_method,
                  }));
                }}
              />
            </div>

            {/* Section C: Table and Persons with CustomSelect (CRITICAL) */}
            {orderForm.order_type !== 'TAKEAWAY' && (
              <div
                style={{
                  background: '#FFFFFF',
                  border: '1px solid #E2E8F0',
                  borderRadius: '8px',
                  padding: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}
              >
                <div
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: '#64748B',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <MapPin size={13} />
                  <span>Dine-In Seating & Table</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px', gap: '10px' }}>
                  {/* Table Selection via CustomSelect */}
                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: '12px',
                        fontWeight: 600,
                        color: '#334155',
                        marginBottom: '5px',
                      }}
                    >
                      Table Number *
                    </label>
                    {tables.length > 0 ? (
                      <CustomSelect
                        value={orderForm.table_number}
                        onChange={(selectedNum) => {
                          const matchedTable = tables.find(
                            (t: any) => String(t.table_number) === selectedNum
                          );
                          const maxFree = matchedTable
                            ? getTableFreeSeats(matchedTable, {
                                phone: orderForm.phone,
                                customerName: orderForm.customer_name,
                              })
                            : 1;
                          setOrderForm((prev) => ({
                            ...prev,
                            table_number: selectedNum,
                            party_size: maxFree,
                          }));
                        }}
                        options={tableOptions}
                        placeholder="Select Table..."
                        direction="auto"
                        buttonStyle={{
                          height: '42px',
                          borderRadius: '8px',
                          border: '1px solid #CBD5E1',
                          fontSize: '13px',
                        }}
                        dropdownStyle={{
                          borderRadius: '8px',
                        }}
                      />
                    ) : (
                      <input
                        type="text"
                        placeholder="e.g. 12"
                        value={orderForm.table_number}
                        onChange={(e) =>
                          setOrderForm((prev) => ({ ...prev, table_number: e.target.value }))
                        }
                        style={{
                          width: '100%',
                          height: '42px',
                          padding: '0 12px',
                          borderRadius: '8px',
                          border: '1px solid #CBD5E1',
                          background: '#FFFFFF',
                          fontSize: '13px',
                          color: '#0F172A',
                          boxSizing: 'border-box',
                        }}
                      />
                    )}
                  </div>

                  {/* Persons Selection via CustomSelect */}
                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: '12px',
                        fontWeight: 600,
                        color: '#334155',
                        marginBottom: '5px',
                      }}
                    >
                      Persons *
                    </label>
                    <CustomSelect
                      value={String(orderForm.party_size || 1)}
                      onChange={(val) =>
                        setOrderForm((prev) => ({ ...prev, party_size: parseInt(val, 10) || 1 }))
                      }
                      options={personOptions}
                      direction="auto"
                      buttonStyle={{
                        height: '42px',
                        borderRadius: '8px',
                        border: '1px solid #CBD5E1',
                        fontSize: '13px',
                      }}
                      dropdownStyle={{
                        borderRadius: '8px',
                      }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Section D: Customer Information & Notes */}
            <div
              style={{
                background: '#FFFFFF',
                border: '1px solid #E2E8F0',
                borderRadius: '8px',
                padding: '14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: '#64748B',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <User size={13} />
                <span>Customer & Notes (Optional)</span>
              </div>

              {/* Customer Name */}
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#334155',
                    marginBottom: '5px',
                  }}
                >
                  Customer Name
                </label>
                <input
                  type="text"
                  placeholder="Guest / Customer Name"
                  value={orderForm.customer_name}
                  onChange={(e) =>
                    setOrderForm((prev) => ({ ...prev, customer_name: e.target.value }))
                  }
                  style={{
                    width: '100%',
                    height: '38px',
                    padding: '0 12px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    background: '#FFFFFF',
                    fontSize: '13px',
                    color: '#0F172A',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Phone Number Field */}
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '12px',
                    fontWeight: 700,
                    color: '#334155',
                    marginBottom: '5px',
                  }}
                >
                  Phone Number *
                </label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <CountryCodeSelect
                    value={countryCode}
                    onChange={(code) => {
                      setCountryCode(code);
                      const clean = phoneDigits.replace(/\D/g, '');
                      setOrderForm((prev) => ({ ...prev, phone: clean ? `${code}${clean}` : '' }));
                    }}
                    buttonHeight="42px"
                  />
                  <input
                    type="tel"
                    placeholder="9xxxxxxxxx"
                    value={phoneDigits}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                      setPhoneDigits(val);
                      setOrderForm((prev) => ({ ...prev, phone: val ? `${countryCode}${val}` : '' }));
                    }}
                    maxLength={10}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      height: '42px',
                      padding: '0 12px',
                      borderRadius: '8px',
                      border: '1px solid #CBD5E1',
                      background: '#FFFFFF',
                      fontSize: '14px',
                      fontWeight: 500,
                      color: '#0F172A',
                      boxSizing: 'border-box',
                    }}
                  />
                  {loadingLoyalty ? (
                    <span
                      style={{
                        height: '42px',
                        padding: '0 10px',
                        borderRadius: '8px',
                        background: '#F1F5F9',
                        color: '#64748B',
                        fontSize: '12px',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                      }}
                    >
                      <Loader2 size={14} className="animate-spin" />
                      Checking...
                    </span>
                  ) : loyaltyProfile ? (
                    <span
                      style={{
                        height: '42px',
                        padding: '0 12px',
                        borderRadius: '8px',
                        background: '#ECFDF5',
                        color: '#10B981',
                        border: '1px solid #A7F3D0',
                        fontSize: '13px',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                      }}
                    >
                      <BadgeCheck size={16} /> Verified
                    </span>
                  ) : null}
                </div>
              </div>

              {/* Kitchen Notes */}
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#334155',
                    marginBottom: '5px',
                  }}
                >
                  Kitchen Notes
                </label>
                <input
                  type="text"
                  placeholder="Less spicy, extra napkins, serve together..."
                  value={orderForm.notes}
                  onChange={(e) => setOrderForm((prev) => ({ ...prev, notes: e.target.value }))}
                  style={{
                    width: '100%',
                    height: '38px',
                    padding: '0 12px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    background: '#FFFFFF',
                    fontSize: '13px',
                    color: '#0F172A',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            {/* Section: Customer Loyalty Profile & Rewards */}
            {orderForm.phone && orderForm.phone.trim().length >= 7 && (
              <div
                style={{
                  background: '#FFFFFF',
                  border: '1px solid #E2E8F0',
                  borderRadius: '8px',
                  padding: '12px 14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Gift size={15} color="var(--primary, #971345)" />
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#0F172A' }}>
                      Customer Loyalty & Rewards
                    </span>
                  </div>
                  {loadingLoyalty && <Loader2 size={13} className="animate-spin" color="var(--primary, #971345)" />}
                </div>

                {loyaltyProfile ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        background: '#F8FAFC',
                        border: '1px solid #E2E8F0',
                        borderRadius: '6px',
                        padding: '8px 12px',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: '#0F172A' }}>
                          {loyaltyProfile.name || orderForm.customer_name || 'Loyalty Member'}
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748B' }}>
                          {loyaltyProfile.total_visits || 0} visits recorded
                        </div>
                      </div>
                      <span
                        style={{
                          fontSize: '12px',
                          fontWeight: 800,
                          padding: '3px 10px',
                          borderRadius: '999px',
                          background: 'rgba(151, 19, 69, 0.08)',
                          color: 'var(--primary, #971345)',
                        }}
                      >
                        {loyaltyProfile.points_balance.toLocaleString()} pts
                      </span>
                    </div>

                    {activeRewards.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>
                            Redeem Reward
                          </label>
                          {selectedReward ? (
                            <button
                              type="button"
                              onClick={() => setSelectedReward(null)}
                              style={{
                                fontSize: '11px',
                                color: '#EF4444',
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                padding: 0,
                                fontWeight: 600,
                              }}
                            >
                              ✕ Clear Reward
                            </button>
                          ) : (
                            <span style={{ fontSize: '11px', color: '#94A3B8' }}>Scroll for more →</span>
                          )}
                        </div>

                        {/* Rewards Carousel Container */}
                        <div
                          style={{
                            display: 'flex',
                            gap: '10px',
                            overflowX: 'auto',
                            paddingBottom: '8px',
                            paddingTop: '2px',
                            scrollSnapType: 'x mandatory',
                            WebkitOverflowScrolling: 'touch',
                          }}
                        >
                          {activeRewards.map((reward) => {
                            const reqPts = Number(reward.points_required || 0);
                            const minAmount = Number(reward.min_purchase_amount || 0);
                            const hasPts = loyaltyProfile.points_balance >= reqPts;
                            const meetsMin = subtotal >= minAmount;
                            const isEligible = hasPts && meetsMin;
                            const isSelected = selectedReward?.id === reward.id;

                            let benefitText = '';
                            if (reward.reward_type === 'DISCOUNT_AMOUNT') {
                              benefitText = `₹${reward.discount_value} Flat Off`;
                            } else if (reward.reward_type === 'DISCOUNT_PERCENTAGE') {
                              benefitText = `${reward.discount_value}% Off Order`;
                            } else {
                              benefitText = `Free Item Voucher`;
                            }

                            return (
                              <div
                                key={reward.id}
                                style={{
                                  flex: '0 0 210px',
                                  minWidth: '210px',
                                  scrollSnapAlign: 'start',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  justifyContent: 'space-between',
                                  padding: '10px 12px',
                                  borderRadius: '10px',
                                  border: isSelected
                                    ? '1.5px solid #16A34A'
                                    : isEligible
                                    ? '1px solid #CBD5E1'
                                    : '1px dashed #CBD5E1',
                                  background: isSelected
                                    ? '#F0FDF4'
                                    : isEligible
                                    ? '#FFFFFF'
                                    : '#F8FAFC',
                                  boxShadow: isSelected ? '0 3px 10px rgba(22, 163, 74, 0.12)' : '0 1px 2px rgba(0,0,0,0.03)',
                                  gap: '8px',
                                }}
                              >
                                <div>
                                  <div style={{ fontSize: '12.5px', fontWeight: 700, color: isSelected ? '#15803D' : '#0F172A', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '3px' }}>
                                    <Tag size={13} style={{ color: isSelected ? '#16A34A' : 'var(--primary, #971345)', flexShrink: 0 }} />
                                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{reward.name}</span>
                                  </div>
                                  <div style={{ fontSize: '11.5px', fontWeight: 700, color: '#16A34A', marginBottom: '2px' }}>
                                    {benefitText}
                                  </div>
                                  <div style={{ fontSize: '11px', color: '#D97706', fontWeight: 700 }}>
                                    {reqPts} pts required
                                  </div>
                                  {minAmount > 0 && (
                                    <div style={{ fontSize: '10.5px', color: '#64748B', marginTop: '1px' }}>
                                      Min spend: ₹{minAmount}
                                    </div>
                                  )}
                                </div>

                                <button
                                  type="button"
                                  disabled={!isEligible}
                                  onClick={() => {
                                    if (isSelected) {
                                      setSelectedReward(null);
                                    } else {
                                      setSelectedReward(reward);
                                    }
                                  }}
                                  style={{
                                    width: '100%',
                                    padding: '6px 10px',
                                    borderRadius: '6px',
                                    border: isSelected
                                      ? 'none'
                                      : isEligible
                                      ? '1px solid var(--primary, #971345)'
                                      : 'none',
                                    background: isSelected
                                      ? '#16A34A'
                                      : isEligible
                                      ? '#FFFFFF'
                                      : '#E2E8F0',
                                    color: isSelected
                                      ? '#FFFFFF'
                                      : isEligible
                                      ? 'var(--primary, #971345)'
                                      : '#94A3B8',
                                    cursor: isEligible ? 'pointer' : 'not-allowed',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '4px',
                                    fontSize: '11.5px',
                                    fontWeight: 700,
                                    transition: 'all 0.15s ease',
                                  }}
                                >
                                  {isSelected ? (
                                    <>
                                      <Check size={13} /> Applied
                                    </>
                                  ) : isEligible ? (
                                    'Redeem'
                                  ) : !meetsMin ? (
                                    `Min spend ₹${minAmount}`
                                  ) : (
                                    `Needs ${reqPts - loyaltyProfile.points_balance} pts`
                                  )}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div style={{ fontSize: '11px', color: '#64748B' }}>
                        No active rewards configured currently.
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ fontSize: '12px', color: '#64748B' }}>
                    Loyalty profile active. Member points will automatically accumulate on this order.
                  </div>
                )}
              </div>
            )}

            {/* Section: Payment Selection */}
            <div
              style={{
                background: '#FFFFFF',
                border: '1px solid #E2E8F0',
                borderRadius: '8px',
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                transition: 'all 0.15s ease',
              }}
            >
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    color: '#475569',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  PAYMENT
                </span>
                {orderForm.is_paid ? (
                  <span
                    style={{
                      fontSize: '10.5px',
                      fontWeight: 700,
                      color: '#15803D',
                      background: '#DCFCE7',
                      padding: '2px 7px',
                      borderRadius: '4px',
                    }}
                  >
                    Pay Now
                  </span>
                ) : (
                  <span
                    style={{
                      fontSize: '10.5px',
                      fontWeight: 700,
                      color: '#64748B',
                      background: '#F1F5F9',
                      padding: '2px 7px',
                      borderRadius: '4px',
                    }}
                  >
                    Pay Later (Unpaid)
                  </span>
                )}
              </div>

              {/* Pay Later / Pay Now Radio Options */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '28px', padding: '2px 0' }}>
                {/* Pay Later */}
                <label
                  onClick={() => setOrderForm((prev) => ({ ...prev, is_paid: false }))}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                    userSelect: 'none',
                    fontSize: '13.5px',
                    fontWeight: !orderForm.is_paid ? 700 : 500,
                    color: !orderForm.is_paid ? '#0F172A' : '#64748B',
                  }}
                >
                  <div
                    style={{
                      width: '16px',
                      height: '16px',
                      borderRadius: '50%',
                      border: !orderForm.is_paid ? '2px solid var(--primary, #059669)' : '2px solid #CBD5E1',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: '#FFFFFF',
                      transition: 'all 0.15s ease',
                      flexShrink: 0,
                    }}
                  >
                    {!orderForm.is_paid && (
                      <div
                        style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          background: 'var(--primary, #059669)',
                        }}
                      />
                    )}
                  </div>
                  <span>Pay Later</span>
                </label>

                {/* Pay Now */}
                <label
                  onClick={() =>
                    setOrderForm((prev) => ({
                      ...prev,
                      is_paid: true,
                      payment_method: prev.payment_method || 'CASH',
                    }))
                  }
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                    userSelect: 'none',
                    fontSize: '13.5px',
                    fontWeight: orderForm.is_paid ? 700 : 500,
                    color: orderForm.is_paid ? '#0F172A' : '#64748B',
                  }}
                >
                  <div
                    style={{
                      width: '16px',
                      height: '16px',
                      borderRadius: '50%',
                      border: orderForm.is_paid ? '2px solid var(--primary, #059669)' : '2px solid #CBD5E1',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: '#FFFFFF',
                      transition: 'all 0.15s ease',
                      flexShrink: 0,
                    }}
                  >
                    {orderForm.is_paid && (
                      <div
                        style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          background: 'var(--primary, #059669)',
                        }}
                      />
                    )}
                  </div>
                  <span>Pay Now</span>
                </label>
              </div>

              {/* Payment Method Sub-selection (When Pay Now is active) */}
              {orderForm.is_paid ? (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    paddingTop: '8px',
                    borderTop: '1px solid #F1F5F9',
                  }}
                >
                  <label
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      color: '#475569',
                      letterSpacing: '0.02em',
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
                        ? (orderForm.payment_method === 'SPLIT' || orderForm.payment_method?.toUpperCase().startsWith('SPLIT'))
                        : (orderForm.payment_method || 'CASH') === m.id;
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (m.id === 'SPLIT') {
                              if (posSplit.CASH === 0 && posSplit.UPI === 0 && posSplit.CARD === 0) {
                                const half = Math.round((totalPrice / 2) * 100) / 100;
                                const other = Math.round((totalPrice - half) * 100) / 100;
                                const init = { CASH: half, UPI: other, CARD: 0 };
                                setPosSplit(init);
                                setOrderForm((prev) => ({
                                  ...prev,
                                  payment_method: formatSplitSummary(init),
                                  payment_split: init,
                                }));
                              } else {
                                setOrderForm((prev) => ({
                                  ...prev,
                                  payment_method: formatSplitSummary(posSplit),
                                  payment_split: posSplit,
                                }));
                              }
                            } else {
                              setOrderForm((prev) => ({ ...prev, payment_method: m.id, payment_split: null }));
                            }
                          }}
                          style={{
                            height: '36px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '4px',
                            borderRadius: '6px',
                            fontSize: '11.5px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            border: selected ? '1.5px solid var(--primary, #059669)' : '1px solid #CBD5E1',
                            background: selected ? '#FFFFFF' : '#F8FAFC',
                            color: selected ? 'var(--primary, #059669)' : '#475569',
                            boxShadow: selected ? '0 1px 3px rgba(0, 0, 0, 0.08)' : 'none',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          {selected ? <Check size={13} strokeWidth={2.5} /> : <Icon size={13} />}
                          <span>{m.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  {(orderForm.payment_method === 'SPLIT' || orderForm.payment_method?.toUpperCase().startsWith('SPLIT')) && (
                    <SplitPaymentBreakdown
                      totalAmount={totalPrice}
                      split={posSplit}
                      onChange={(newSplit, summary) => {
                        setPosSplit(newSplit);
                        setOrderForm((prev) => ({
                          ...prev,
                          payment_method: summary,
                          payment_split: newSplit,
                        }));
                      }}
                      theme="emerald"
                    />
                  )}
                </div>
              ) : (
                <div
                  style={{
                    fontSize: '11.5px',
                    color: '#64748B',
                    paddingTop: '6px',
                    borderTop: '1px solid #F1F5F9',
                  }}
                >
                  Order will be placed as <strong>Unpaid</strong>. Settle payment upon customer departure.
                </div>
              )}
            </div>

            {/* Section E: Price Summary */}
            <div
              style={{
                background: '#F8FAFC',
                border: '1px solid #E2E8F0',
                borderRadius: '8px',
                padding: '14px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '13px',
                  color: '#64748B',
                }}
              >
                <span>Subtotal ({totalItems} items)</span>
                <span style={{ fontWeight: 600, color: '#0F172A' }}>{formatPrice(subtotal)}</span>
              </div>

              {gstAmount > 0 && (
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '13px',
                    color: '#64748B',
                  }}
                >
                  <span>GST ({restaurant?.gst_rate || 0}%)</span>
                  <span style={{ fontWeight: 600, color: '#0F172A' }}>{formatPrice(gstAmount)}</span>
                </div>
              )}

              {loyaltyDiscountAmount > 0 && (
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '13px',
                    color: '#16A34A',
                    fontWeight: 600,
                  }}
                >
                  <span>Loyalty Discount ({selectedReward?.name || 'Reward'})</span>
                  <span>-{formatPrice(loyaltyDiscountAmount)}</span>
                </div>
              )}

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                  paddingTop: '8px',
                  borderTop: '1px dashed #CBD5E1',
                }}
              >
                <span style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A' }}>
                  Grand Total
                </span>
                <span
                  style={{
                    fontSize: '22px',
                    fontWeight: 800,
                    color: 'var(--primary, #971345)',
                    letterSpacing: '-0.02em',
                  }}
                >
                  {formatPrice(totalPrice)}
                </span>
              </div>
            </div>
          </div>

          {/* 3. Footer */}
          <div
            style={{
              padding: '16px 20px',
              borderTop: '1px solid #F1F5F9',
              background: '#FFFFFF',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              flexShrink: 0,
            }}
          >
            {/* Primary Action Button: Place Order */}
            <button
              type="submit"
              disabled={submitting || cart.size === 0}
              style={{
                width: '100%',
                height: '46px',
                borderRadius: '8px',
                border: 'none',
                background: 'var(--primary, #059669)',
                color: '#FFFFFF',
                fontSize: '15px',
                fontWeight: 700,
                cursor: submitting || cart.size === 0 ? 'not-allowed' : 'pointer',
                opacity: submitting || cart.size === 0 ? 0.6 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 2px 6px rgba(5, 150, 105, 0.25)',
                transition: 'all 0.15s ease',
              }}
            >
              {submitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Placing Order...</span>
                </>
              ) : (
                <>
                  <Check size={18} />
                  <span>Place Order · {formatPrice(totalPrice)}</span>
                </>
              )}
            </button>

            {/* Independent Action Button: Print Bill (Prints bill directly, does NOT place order) */}
            <button
              type="button"
              onClick={handlePrintCurrentBill}
              disabled={printingBill || cart.size === 0}
              style={{
                width: '100%',
                height: '42px',
                borderRadius: '8px',
                border: '1.5px solid var(--primary, #059669)',
                background: '#FFFFFF',
                color: 'var(--primary, #059669)',
                fontSize: '14.5px',
                fontWeight: 700,
                cursor: printingBill || cart.size === 0 ? 'not-allowed' : 'pointer',
                opacity: printingBill || cart.size === 0 ? 0.6 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#F0FDF4')}
              onMouseLeave={(e) => (e.currentTarget.style.background = '#FFFFFF')}
            >
              {printingBill ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Printing Bill...</span>
                </>
              ) : (
                <>
                  <Printer size={17} />
                  <span>Print Bill</span>
                </>
              )}
            </button>
          </div>
        </form>
      </aside>
    </div>,
    document.body
  );
}
