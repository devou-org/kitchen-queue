'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Search, Plus, Minus, Trash2, Loader2, Utensils, User, Phone, Users, Check, ShoppingBag, Activity, Info } from 'lucide-react';
import toast from 'react-hot-toast';
import { Order, Product } from '@/types';
import { formatPrice } from '@/lib/format';
import { validatePhone } from '@/lib/validators';
import { orderService } from '@/app/services/orders.api';
import { productService } from '@/app/services/products.api';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { checkTableAssignment } from '@/lib/table-capacity';
import OrderStatusBadge, { getOrderStatusConfig } from './OrderStatusBadge';

export interface EditOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order;
  slug: string;
  tables?: any[];
  onOrderUpdated?: (updatedOrder: Order) => void;
}

interface EditableOrderItem {
  product_id: string;
  quantity: number;
  product_name?: string;
  price?: number;
}

export function EditOrderModal({
  isOpen,
  onClose,
  order,
  slug,
  tables = [],
  onOrderUpdated,
}: EditOrderModalProps) {
  const [mounted, setMounted] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form Fields
  const [orderStatus, setOrderStatus] = useState<string>(order.status || 'PENDING');
  const [orderType, setOrderType] = useState<string>(order.order_type || 'DINE_IN');
  const [customerName, setCustomerName] = useState(order.customer_name || '');
  const [phone, setPhone] = useState(order.phone || '');
  const [notes, setNotes] = useState(order.notes || '');
  const [tableNumber, setTableNumber] = useState(order.table_number || '');
  const [partySize, setPartySize] = useState<number>(order.party_size || 1);
  const [items, setItems] = useState<EditableOrderItem[]>([]);

  // Product Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Sync state whenever the order prop changes or modal opens
  useEffect(() => {
    if (isOpen && order) {
      setOrderStatus(order.status || 'PENDING');
      setOrderType(order.order_type || 'DINE_IN');
      setCustomerName(order.customer_name || '');
      setPhone(order.phone || '');
      setNotes(order.notes || '');
      setTableNumber(order.table_number || '');
      setPartySize(order.party_size || 1);

      const initialItems: EditableOrderItem[] = (order.items || []).map((i) => ({
        product_id: i.product_id,
        quantity: i.quantity || 1,
        product_name: i.product_name,
        price: i.price_at_purchase,
      }));
      setItems(initialItems);
      setSearchQuery('');
      setShowSearchDropdown(false);
    }
  }, [isOpen, order]);

  // Fetch available products
  useEffect(() => {
    if (!isOpen) return;

    let isCancelled = false;
    const fetchCatalog = async () => {
      setLoadingProducts(true);
      try {
        const res = await productService.getProducts();
        if (!isCancelled && res.success && res.data) {
          const mapped = res.data.map((p) => ({
            ...p,
            price: Number(p.price),
          }));
          setProducts(mapped);
        }
      } catch {
        // Fallback / ignore
      } finally {
        if (!isCancelled) setLoadingProducts(false);
      }
    };

    fetchCatalog();
    return () => {
      isCancelled = true;
    };
  }, [isOpen]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        searchInputRef.current &&
        !searchInputRef.current.contains(e.target as Node)
      ) {
        setShowSearchDropdown(false);
      }
    };
    if (showSearchDropdown) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [showSearchDropdown]);

  // Escape key handler
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Product lookup map
  const productMap = useMemo(() => {
    const map = new Map<string, Product>();
    for (const p of products) {
      map.set(p.id, p);
    }
    return map;
  }, [products]);

  // Available status options
  const statusOptions = useMemo(() => {
    const base = ['PENDING', 'PREPARING', 'READY', 'SERVED', 'CLOSED', 'CANCELLED'];
    const cur = (order?.status || '').toUpperCase();
    if (cur && !base.includes(cur)) {
      base.push(cur);
    }
    return base;
  }, [order?.status]);

  // Options formatted for CustomSelect
  const statusSelectOptions = useMemo(() => {
    return statusOptions.map((st) => {
      const cfg = getOrderStatusConfig(st);
      return {
        value: st,
        label: cfg.label,
      };
    });
  }, [statusOptions]);

  // Filtered products for search
  const filteredProducts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return products.slice(0, 15);
    }
    return products.filter((p) =>
      p.name.toLowerCase().includes(query) || (p.category && p.category.toLowerCase().includes(query))
    ).slice(0, 20);
  }, [products, searchQuery]);

  // Calculate live total
  const calculatedTotal = useMemo(() => {
    return items.reduce((sum, item) => {
      const p = productMap.get(item.product_id);
      const price = item.price ?? p?.price ?? 0;
      return sum + price * item.quantity;
    }, 0);
  }, [items, productMap]);

  const totalQuantity = useMemo(() => {
    return items.reduce((sum, item) => sum + item.quantity, 0);
  }, [items]);

  const handleUpdateQuantity = (productId: string, delta: number) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.product_id === productId) {
          const nextQty = Math.max(1, Math.min(99, item.quantity + delta));
          return { ...item, quantity: nextQty };
        }
        return item;
      })
    );
  };

  const handleRemoveItem = (productId: string) => {
    setItems((prev) => prev.filter((item) => item.product_id !== productId));
  };

  const handleAddProduct = (product: Product) => {
    const existing = items.find((i) => i.product_id === product.id);
    if (existing) {
      handleUpdateQuantity(product.id, 1);
      toast.success(`Increased ${product.name} quantity`);
    } else {
      setItems((prev) => [
        ...prev,
        {
          product_id: product.id,
          quantity: 1,
          product_name: product.name,
          price: product.price,
        },
      ]);
      toast.success(`Added ${product.name}`);
    }
    setSearchQuery('');
    setShowSearchDropdown(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedName = customerName.trim();
    const trimmedPhone = phone.trim();

    if (!trimmedName) {
      toast.error('Customer name is required');
      return;
    }

    if (trimmedPhone) {
      const phoneCheck = validatePhone(trimmedPhone);
      if (!phoneCheck.valid) {
        toast.error(phoneCheck.message || 'Invalid phone number');
        return;
      }
    }

    if (!partySize || partySize <= 0) {
      toast.error('Party size must be at least 1');
      return;
    }

    if (items.length === 0) {
      toast.error('Order must have at least one item');
      return;
    }

    const isDineIn = orderType === 'DINE_IN';
    const finalTable = isDineIn ? (tableNumber ? tableNumber.trim() : null) : null;

    if (isDineIn && finalTable) {
      const selectedT = tables.find((t: any) => String(t.table_number) === String(finalTable));
      if (selectedT) {
        const check = checkTableAssignment(selectedT, Number(partySize) || 1, {
          orderId: order?.id,
          phone: trimmedPhone || order?.phone,
          customerName: trimmedName || order?.customer_name,
        });
        const cap = Number(selectedT.capacity) || 0;
        const freeSeats = Math.max(0, cap - check.occupiedSeats);
        if (freeSeats <= 0 && !check.allowed) {
          toast.error(`Table ${finalTable} is full. Please choose an available table.`);
          return;
        }
      }
    }

    setSaving(true);
    try {
      const payload: any = {
        status: orderStatus,
        order_type: orderType,
        customer_name: trimmedName,
        phone: trimmedPhone || undefined,
        table_number: finalTable,
        party_size: Number(partySize),
        notes: notes.trim() || null,
        items: items.map((i) => ({
          product_id: i.product_id,
          quantity: i.quantity,
        })),
      };

      const res = await orderService.updateOrder(order.id, payload);

      if (res.success && res.data) {
        if (orderStatus !== order.status) {
          toast.success(`Order #${String(order.ticket_number).padStart(3, '0')} updated (Status: ${orderStatus})`);
        } else {
          toast.success(`Order #${String(order.ticket_number).padStart(3, '0')} updated!`);
        }
        if (onOrderUpdated) {
          onOrderUpdated(res.data);
        }
        onClose();
      } else {
        toast.error(res.error || 'Failed to update order');
      }
    } catch {
      toast.error('Network error while saving order');
    } finally {
      setSaving(false);
    }
  };

  // Party size options (1 to 15)
  const partySizeOptions = Array.from({ length: 15 }, (_, i) => ({
    value: String(i + 1),
    label: `${i + 1} ${i === 0 ? 'Person' : 'Persons'}`,
  }));

  // Table options (Filtering out full tables, displaying exact availability)
  const tableOptions = useMemo(() => {
    const opts = [{ value: '', label: '-- No Table Assigned --' }];

    const pSize = Number(partySize) || 1;

    // Filter tables: If table is full (freeSeats <= 0), DO NOT show in list
    const availableTables = (tables || []).filter((t: any) => {
      const check = checkTableAssignment(t, pSize, {
        orderId: order?.id,
        phone: phone || order?.phone,
        customerName: customerName || order?.customer_name,
      });
      const cap = Number(t.capacity) || 0;
      const seated = check.occupiedSeats;
      const freeSeats = Math.max(0, cap - seated);

      // Do NOT show in the list if free seats <= 0
      return freeSeats > 0 && check.allowed;
    });

    for (const t of availableTables) {
      const check = checkTableAssignment(t, pSize, {
        orderId: order?.id,
        phone: phone || order?.phone,
        customerName: customerName || order?.customer_name,
      });
      const cap = Number(t.capacity) || 0;
      const seated = check.occupiedSeats;
      const rawNum = String(t.table_number || '').trim();
      let tableLabel = rawNum;
      if (/^\d+$/.test(rawNum)) {
        tableLabel = `Table ${rawNum}`;
      } else if (rawNum.toLowerCase().startsWith('t-')) {
        tableLabel = `Table ${rawNum.slice(2)}`;
      }
      const freeSeats = Math.max(0, cap - seated);

      opts.push({
        value: String(t.table_number),
        label: `${tableLabel} · ${seated}/${cap} (${freeSeats} free)`,
      });
    }

    return opts;
  }, [tables, partySize, order?.id, phone, customerName]);

  if (!mounted || !isOpen) return null;

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100005,
        background: 'rgba(15, 23, 42, 0.45)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        boxSizing: 'border-box',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving) {
          onClose();
        }
      }}
    >
      <style>{`
        @keyframes popupModalFadeIn {
          from {
            opacity: 0;
            transform: scale(0.96) translateY(8px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
        .edit-order-modal-container {
          animation: popupModalFadeIn 0.18s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .edit-order-item-row:hover {
          background-color: #F8FAFC !important;
        }
      `}</style>

      {/* Popup Container with exact 8px border radius */}
      <div
        className="edit-order-modal-container"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '620px',
          maxHeight: '90vh',
          background: '#FFFFFF',
          borderRadius: '8px',
          border: '1px solid #E2E8F0',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxSizing: 'border-box',
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
            background: '#FFFFFF',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h2
              style={{
                fontSize: '17px',
                fontWeight: 700,
                color: '#0F172A',
                margin: 0,
                letterSpacing: '-0.01em',
              }}
            >
              Edit Order
            </h2>
            <span
              style={{
                fontFamily: 'monospace',
                fontSize: '13px',
                fontWeight: 700,
                color: 'var(--primary, #971345)',
                background: 'rgba(151, 19, 69, 0.08)',
                padding: '2px 8px',
                borderRadius: '8px',
                border: '1px solid rgba(151, 19, 69, 0.15)',
              }}
            >
              #{String(order.ticket_number).padStart(3, '0')}
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
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
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#E2E8F0')}
            onMouseLeave={(e) => (e.currentTarget.style.background = '#F1F5F9')}
            title="Close popup"
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal Body - Form */}
        <form
          onSubmit={handleSubmit}
          style={{
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            flex: 1,
          }}
        >
          <div
            style={{
              padding: '20px',
              overflowY: 'auto',
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            {/* Customer & Dining Details Container */}
            <div
              style={{
                background: '#F8FAFC',
                border: '1px solid #E2E8F0',
                borderRadius: '8px',
                padding: '16px',
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
                  marginBottom: '2px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <User size={13} />
                <span>Customer & Seating Details</span>
              </div>

              {/* Row 1: Name and Phone */}
              {/* Order Type Selection */}
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '12px',
                    fontWeight: 700,
                    color: '#334155',
                    marginBottom: '6px',
                  }}
                >
                  Order Type
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                  {[
                    { id: 'DINE_IN', label: 'Dine-in', icon: Utensils },
                    { id: 'TAKEAWAY', label: 'Takeaway', icon: ShoppingBag },
                  ].map((t) => {
                    const Icon = t.icon;
                    const isSelected = orderType === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => {
                          setOrderType(t.id);
                          if (t.id === 'TAKEAWAY') {
                            setTableNumber('');
                          }
                        }}
                        style={{
                          height: '36px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          borderRadius: '8px',
                          fontSize: '12px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          border: isSelected ? '1.5px solid #2563EB' : '1px solid #CBD5E1',
                          background: isSelected ? '#EFF6FF' : '#FFFFFF',
                          color: isSelected ? '#1D4ED8' : '#475569',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <Icon size={13} style={{ color: isSelected ? '#1D4ED8' : '#64748B' }} />
                        <span>{t.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Row 1: Name and Phone */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
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
                    Customer Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Guest Name"
                    style={{
                      width: '100%',
                      height: '38px',
                      padding: '0 12px',
                      borderRadius: '8px',
                      border: '1px solid #CBD5E1',
                      background: '#FFFFFF',
                      fontSize: '13px',
                      color: '#0F172A',
                      outline: 'none',
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
                    Phone Number
                  </label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="10-digit mobile number"
                    style={{
                      width: '100%',
                      height: '38px',
                      padding: '0 12px',
                      borderRadius: '8px',
                      border: '1px solid #CBD5E1',
                      background: '#FFFFFF',
                      fontSize: '13px',
                      color: '#0F172A',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>

              {/* Row 2: Table and Party Size */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '5px' }}>
                    <label
                      style={{
                        display: 'block',
                        fontSize: '12px',
                        fontWeight: 600,
                        color: orderType === 'DINE_IN' ? '#334155' : '#94A3B8',
                      }}
                    >
                      Assigned Table
                    </label>
                    {orderType !== 'DINE_IN' && (
                      <span style={{ fontSize: '11px', color: '#64748B', fontStyle: 'italic' }}>
                        Disabled for Takeaway
                      </span>
                    )}
                  </div>
                  <CustomSelect
                    value={tableNumber}
                    disabled={orderType !== 'DINE_IN'}
                    onChange={(val) => setTableNumber(val)}
                    options={tableOptions}
                    placeholder={orderType === 'DINE_IN' ? "Select table..." : "-- No Table (Takeaway) --"}
                    buttonStyle={{
                      height: '38px',
                      fontSize: '13px',
                      borderRadius: '8px',
                      border: '1px solid #CBD5E1',
                      background: orderType === 'DINE_IN' ? '#FFFFFF' : '#F1F5F9',
                      color: orderType === 'DINE_IN' ? '#0F172A' : '#94A3B8',
                      cursor: orderType === 'DINE_IN' ? 'pointer' : 'not-allowed',
                      opacity: orderType === 'DINE_IN' ? 1 : 0.7,
                    }}
                    dropdownStyle={{
                      borderRadius: '8px',
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
                    Party Size
                  </label>
                  <CustomSelect
                    value={String(partySize)}
                    onChange={(val) => setPartySize(parseInt(val, 10) || 1)}
                    options={partySizeOptions}
                    buttonStyle={{
                      height: '38px',
                      fontSize: '13px',
                      borderRadius: '8px',
                      border: '1px solid #CBD5E1',
                    }}
                    dropdownStyle={{
                      borderRadius: '8px',
                    }}
                  />
                </div>
              </div>

              {/* Notes */}
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
                  Kitchen Notes / Preferences
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Special instructions, allergies, spice level..."
                  rows={2}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    background: '#FFFFFF',
                    fontSize: '13px',
                    color: '#0F172A',
                    outline: 'none',
                    resize: 'none',
                    boxSizing: 'border-box',
                    fontFamily: 'inherit',
                  }}
                />
              </div>
            </div>

            {/* Order Status */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#334155',
                  marginBottom: '6px',
                }}
              >
                Order Status
              </label>
              <CustomSelect
                value={orderStatus}
                onChange={(val) => setOrderStatus(val)}
                options={statusSelectOptions}
                buttonStyle={{
                  height: '38px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  background: '#FFFFFF',
                  fontSize: '13px',
                }}
                dropdownStyle={{
                  borderRadius: '8px',
                  zIndex: 100010,
                }}
              />
            </div>

            {/* Order Items Section */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
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
                  <Utensils size={13} />
                  <span>Order Items ({totalQuantity})</span>
                </div>
              </div>

              {/* Search & Add Product Dropdown */}
              <div style={{ position: 'relative' }}>
                <div
                  style={{
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <Search
                    size={15}
                    style={{
                      position: 'absolute',
                      left: '12px',
                      color: '#94A3B8',
                      pointerEvents: 'none',
                    }}
                  />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setShowSearchDropdown(true);
                    }}
                    onFocus={() => setShowSearchDropdown(true)}
                    placeholder="Search menu item to add..."
                    style={{
                      width: '100%',
                      height: '38px',
                      paddingLeft: '34px',
                      paddingRight: searchQuery ? '30px' : '12px',
                      borderRadius: '8px',
                      border: '1px solid #CBD5E1',
                      background: '#FFFFFF',
                      fontSize: '13px',
                      outline: 'none',
                      color: '#0F172A',
                      boxSizing: 'border-box',
                    }}
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        setShowSearchDropdown(false);
                      }}
                      style={{
                        position: 'absolute',
                        right: '8px',
                        background: 'transparent',
                        border: 'none',
                        color: '#94A3B8',
                        cursor: 'pointer',
                        padding: '4px',
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                      }}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                {/* Dropdown for Search Results */}
                {showSearchDropdown && (
                  <div
                    ref={dropdownRef}
                    style={{
                      position: 'absolute',
                      top: 'calc(100% + 4px)',
                      left: 0,
                      right: 0,
                      background: '#FFFFFF',
                      border: '1px solid #CBD5E1',
                      borderRadius: '8px',
                      maxHeight: '220px',
                      overflowY: 'auto',
                      zIndex: 100,
                      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
                      padding: '4px',
                      boxSizing: 'border-box',
                    }}
                  >
                    {loadingProducts ? (
                      <div
                        style={{
                          padding: '12px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '8px',
                          color: '#64748B',
                          fontSize: '13px',
                        }}
                      >
                        <Loader2 size={16} className="animate-spin" />
                        <span>Loading items...</span>
                      </div>
                    ) : filteredProducts.length === 0 ? (
                      <div
                        style={{
                          padding: '12px',
                          textAlign: 'center',
                          color: '#64748B',
                          fontSize: '13px',
                        }}
                      >
                        No items found matching &quot;{searchQuery}&quot;
                      </div>
                    ) : (
                      filteredProducts.map((prod) => (
                        <div
                          key={prod.id}
                          onClick={() => handleAddProduct(prod)}
                          style={{
                            padding: '8px 12px',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            transition: 'background 0.15s ease',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = '#F1F5F9')}
                          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                        >
                          <div>
                            <div style={{ fontSize: '13px', fontWeight: 600, color: '#0F172A' }}>
                              {prod.name}
                            </div>
                            <div style={{ fontSize: '11px', color: '#64748B' }}>
                              {prod.category || 'General'}
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--primary, #971345)' }}>
                              {formatPrice(prod.price)}
                            </span>
                            <span
                              style={{
                                fontSize: '11px',
                                fontWeight: 600,
                                background: 'rgba(151, 19, 69, 0.08)',
                                color: 'var(--primary, #971345)',
                                padding: '3px 8px',
                                borderRadius: '8px',
                              }}
                            >
                              + Add
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Items List Container */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  maxHeight: '260px',
                  overflowY: 'auto',
                }}
              >
                {items.length === 0 ? (
                  <div
                    style={{
                      padding: '24px',
                      textAlign: 'center',
                      background: '#F8FAFC',
                      border: '1px dashed #CBD5E1',
                      borderRadius: '8px',
                      color: '#64748B',
                      fontSize: '13px',
                    }}
                  >
                    No items in this order. Search and add an item above.
                  </div>
                ) : (
                  items.map((item) => {
                    const prod = productMap.get(item.product_id);
                    const unitPrice = item.price ?? prod?.price ?? 0;
                    const itemSubtotal = unitPrice * item.quantity;
                    const itemName = item.product_name || prod?.name || 'Item';

                    return (
                      <div
                        key={item.product_id}
                        className="edit-order-item-row"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '12px',
                          padding: '10px 14px',
                          background: '#FFFFFF',
                          border: '1px solid #E2E8F0',
                          borderRadius: '8px',
                          transition: 'background 0.15s ease',
                        }}
                      >
                        {/* Item Name & Unit Price */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: '13.5px',
                              fontWeight: 600,
                              color: '#0F172A',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {itemName}
                          </div>
                          <div style={{ fontSize: '12px', color: '#64748B', marginTop: '1px' }}>
                            {formatPrice(unitPrice)} each
                          </div>
                        </div>

                        {/* Quantity Stepper with 8px border radius */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <button
                            type="button"
                            onClick={() => handleUpdateQuantity(item.product_id, -1)}
                            disabled={item.quantity <= 1}
                            style={{
                              width: '30px',
                              height: '30px',
                              borderRadius: '8px',
                              border: '1px solid #CBD5E1',
                              background: item.quantity <= 1 ? '#F8FAFC' : '#FFFFFF',
                              color: item.quantity <= 1 ? '#CBD5E1' : '#0F172A',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: item.quantity <= 1 ? 'not-allowed' : 'pointer',
                              transition: 'all 0.15s ease',
                            }}
                            title="Decrease quantity"
                          >
                            <Minus size={13} />
                          </button>

                          <span
                            style={{
                              minWidth: '28px',
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
                            onClick={() => handleUpdateQuantity(item.product_id, 1)}
                            disabled={item.quantity >= 99}
                            style={{
                              width: '30px',
                              height: '30px',
                              borderRadius: '8px',
                              border: '1px solid #CBD5E1',
                              background: '#FFFFFF',
                              color: '#0F172A',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: item.quantity >= 99 ? 'not-allowed' : 'pointer',
                              transition: 'all 0.15s ease',
                            }}
                            title="Increase quantity"
                          >
                            <Plus size={13} />
                          </button>
                        </div>

                        {/* Item Total */}
                        <div
                          style={{
                            minWidth: '70px',
                            textAlign: 'right',
                            fontSize: '13.5px',
                            fontWeight: 700,
                            color: '#0F172A',
                          }}
                        >
                          {formatPrice(itemSubtotal)}
                        </div>

                        {/* Delete Button with 8px border radius */}
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(item.product_id)}
                          style={{
                            width: '30px',
                            height: '30px',
                            borderRadius: '8px',
                            border: '1px solid transparent',
                            background: 'transparent',
                            color: '#EF4444',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = '#FEE2E2';
                            e.currentTarget.style.borderColor = '#FCA5A5';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'transparent';
                            e.currentTarget.style.borderColor = 'transparent';
                          }}
                          title="Remove item"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Total Summary Container with 8px border radius */}
            <div
              style={{
                background: '#F8FAFC',
                border: '1px solid #E2E8F0',
                borderRadius: '8px',
                padding: '14px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ fontSize: '11px', fontWeight: 600, color: '#64748B', textTransform: 'uppercase' }}>
                  Updated Total
                </div>
                <div style={{ fontSize: '12px', color: '#64748B' }}>
                  {totalQuantity} {totalQuantity === 1 ? 'item' : 'items'}
                </div>
              </div>
              <div
                style={{
                  fontSize: '20px',
                  fontWeight: 800,
                  color: 'var(--primary, #971345)',
                  letterSpacing: '-0.02em',
                }}
              >
                {formatPrice(calculatedTotal)}
              </div>
            </div>
          </div>

          {/* Modal Footer with 8px border radius buttons */}
          <div
            style={{
              padding: '14px 20px',
              borderTop: '1px solid #F1F5F9',
              background: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '10px',
              flexShrink: 0,
            }}
          >
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              style={{
                height: '38px',
                padding: '0 16px',
                borderRadius: '8px',
                border: '1px solid #CBD5E1',
                background: '#FFFFFF',
                color: '#334155',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#F8FAFC')}
              onMouseLeave={(e) => (e.currentTarget.style.background = '#FFFFFF')}
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving || items.length === 0}
              style={{
                height: '38px',
                padding: '0 20px',
                borderRadius: '8px',
                border: 'none',
                background: 'var(--primary, #971345)',
                color: '#FFFFFF',
                fontSize: '13px',
                fontWeight: 600,
                cursor: saving || items.length === 0 ? 'not-allowed' : 'pointer',
                opacity: saving || items.length === 0 ? 0.6 : 1,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.15s ease',
              }}
            >
              {saving ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Saving Changes...</span>
                </>
              ) : (
                <>
                  <Check size={14} />
                  <span>Save Order Changes</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
