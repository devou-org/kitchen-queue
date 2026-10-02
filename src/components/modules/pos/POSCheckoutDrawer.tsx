'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
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
} from 'lucide-react';
import { CartItem, OrderType } from '@/types';
import { formatPrice } from '@/lib/format';
import { CustomSelect } from '@/components/ui/CustomSelect';
import OrderTypeSelector from '@/components/modules/orders/OrderTypeSelector';
import { checkTableAssignment } from '@/lib/table-capacity';

export interface POSOrderFormData {
  customer_name: string;
  phone: string;
  table_number: string;
  party_size: number;
  notes: string;
  order_type: OrderType | string;
  is_paid?: boolean;
  payment_method?: string;
  discount_amount?: number;
  selected_reward_id?: string;
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

  // Loyalty & Rewards State
  const [loyaltyProfile, setLoyaltyProfile] = useState<any>(null);
  const [activeRewards, setActiveRewards] = useState<any[]>([]);
  const [selectedReward, setSelectedReward] = useState<any>(null);
  const [loadingLoyalty, setLoadingLoyalty] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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

  // Person Options for CustomSelect (1 to 15)
  const personOptions = useMemo(
    () =>
      Array.from({ length: 15 }, (_, i) => ({
        value: String(i + 1),
        label: `${i + 1} ${i === 0 ? 'Person' : 'Persons'}`,
      })),
    []
  );

  // Table Options for CustomSelect
  const tableOptions = useMemo(() => {
    const list = [
      { value: '', label: '-- Select Table --' },
      ...tables
        .filter((t: any) => {
          const partySize = Number(orderForm.party_size) || 1;
          const check = checkTableAssignment(t, partySize, {
            phone: orderForm.phone,
            customerName: orderForm.customer_name,
          });
          const isCurrent = t.table_number === orderForm.table_number;
          return check.allowed || isCurrent;
        })
        .map((t: any) => {
          const partySize = Number(orderForm.party_size) || 1;
          const check = checkTableAssignment(t, partySize, {
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
  }, [tables, orderForm.party_size, orderForm.phone, orderForm.customer_name, orderForm.table_number]);

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
                onChange={(val) => setOrderForm((prev) => ({ ...prev, order_type: val }))}
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
                          setOrderForm((prev) => ({
                            ...prev,
                            table_number: selectedNum,
                            party_size: matchedTable?.capacity
                              ? Number(matchedTable.capacity)
                              : prev.party_size,
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

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
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
                    Phone
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 9876543210"
                    value={orderForm.phone}
                    onChange={(e) => setOrderForm((prev) => ({ ...prev, phone: e.target.value }))}
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
                          {selectedReward && (
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
                          )}
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {activeRewards.map((reward) => {
                            const reqPts = Number(reward.points_required || 0);
                            const minAmount = Number(reward.min_purchase_amount || 0);
                            const hasPts = loyaltyProfile.points_balance >= reqPts;
                            const meetsMin = subtotal >= minAmount;
                            const isEligible = hasPts && meetsMin;
                            const isSelected = selectedReward?.id === reward.id;

                            let label = reward.name;
                            if (reward.reward_type === 'DISCOUNT_AMOUNT') {
                              label = `${reward.name} (₹${reward.discount_value} Off)`;
                            } else if (reward.reward_type === 'DISCOUNT_PERCENTAGE') {
                              label = `${reward.name} (${reward.discount_value}% Off)`;
                            }

                            return (
                              <button
                                key={reward.id}
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
                                  padding: '8px 12px',
                                  borderRadius: '6px',
                                  border: isSelected
                                    ? '1.5px solid #16A34A'
                                    : isEligible
                                    ? '1px solid #E2E8F0'
                                    : '1px dashed #CBD5E1',
                                  background: isSelected
                                    ? '#F0FDF4'
                                    : isEligible
                                    ? '#FFFFFF'
                                    : '#F8FAFC',
                                  color: isSelected ? '#15803D' : isEligible ? '#0F172A' : '#94A3B8',
                                  cursor: isEligible ? 'pointer' : 'not-allowed',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  fontSize: '12px',
                                  fontWeight: isSelected ? 700 : 500,
                                  textAlign: 'left',
                                  transition: 'all 0.15s ease',
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <Tag size={13} style={{ color: isSelected ? '#16A34A' : '#64748B' }} />
                                  <span>{label}</span>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span style={{ fontSize: '11px', fontWeight: 700, color: isEligible ? '#64748B' : '#94A3B8' }}>
                                    {reqPts} pts
                                  </span>
                                  {isSelected && <Check size={14} color="#16A34A" />}
                                </div>
                              </button>
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

            {/* Section: Payment Settlement (Optional) */}
            <div
              style={{
                background: orderForm.is_paid ? '#F0FDF4' : '#F8FAFC',
                border: orderForm.is_paid ? '1px solid #BBF7D0' : '1px solid #E2E8F0',
                borderRadius: '8px',
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                transition: 'all 0.15s ease',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  userSelect: 'none',
                }}
                onClick={() =>
                  setOrderForm((prev) => ({
                    ...prev,
                    is_paid: !prev.is_paid,
                    payment_method: !prev.is_paid ? (prev.payment_method || 'CASH') : prev.payment_method,
                  }))
                }
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <CreditCard size={16} style={{ color: orderForm.is_paid ? '#16A34A' : '#64748B' }} />
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: orderForm.is_paid ? '#15803D' : '#0F172A' }}>
                      Mark as Paid (Optional)
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748B' }}>
                      Record payment now without changing kitchen status
                    </div>
                  </div>
                </div>

                <input
                  type="checkbox"
                  checked={Boolean(orderForm.is_paid)}
                  onChange={(e) => {
                    e.stopPropagation();
                    setOrderForm((prev) => ({
                      ...prev,
                      is_paid: e.target.checked,
                      payment_method: e.target.checked ? (prev.payment_method || 'CASH') : prev.payment_method,
                    }));
                  }}
                  style={{
                    width: '18px',
                    height: '18px',
                    accentColor: '#16A34A',
                    cursor: 'pointer',
                  }}
                />
              </div>

              {orderForm.is_paid && (
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
                      fontSize: '11px',
                      fontWeight: 700,
                      color: '#166534',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    }}
                  >
                    Payment Method
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                    {[
                      { id: 'CASH', label: 'Cash', icon: Banknote },
                      { id: 'UPI', label: 'UPI / QR', icon: QrCode },
                      { id: 'CARD', label: 'Card', icon: CreditCard },
                    ].map((m) => {
                      const Icon = m.icon;
                      const selected = (orderForm.payment_method || 'CASH') === m.id;
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOrderForm((prev) => ({ ...prev, payment_method: m.id }));
                          }}
                          style={{
                            height: '34px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '5px',
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            border: selected ? '1.5px solid #16A34A' : '1px solid #CBD5E1',
                            background: selected ? '#FFFFFF' : '#F8FAFC',
                            color: selected ? '#15803D' : '#475569',
                            boxShadow: selected ? '0 1px 3px rgba(22, 163, 74, 0.15)' : 'none',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <Icon size={13} />
                          <span>{m.label}</span>
                        </button>
                      );
                    })}
                  </div>
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
            <button
              type="submit"
              disabled={submitting || cart.size === 0}
              style={{
                width: '100%',
                height: '46px',
                borderRadius: '8px',
                border: 'none',
                background: 'var(--primary, #971345)',
                color: '#FFFFFF',
                fontSize: '15px',
                fontWeight: 700,
                cursor: submitting || cart.size === 0 ? 'not-allowed' : 'pointer',
                opacity: submitting || cart.size === 0 ? 0.6 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 4px 12px rgba(151, 19, 69, 0.25)',
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

            <button
              type="button"
              onClick={handleDismiss}
              disabled={submitting}
              style={{
                width: '100%',
                height: '36px',
                borderRadius: '8px',
                border: '1px solid #CBD5E1',
                background: '#FFFFFF',
                color: '#475569',
                fontSize: '13px',
                fontWeight: 600,
                cursor: submitting ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#F8FAFC')}
              onMouseLeave={(e) => (e.currentTarget.style.background = '#FFFFFF')}
            >
              Continue Ordering
            </button>
          </div>
        </form>
      </aside>
    </div>,
    document.body
  );
}
