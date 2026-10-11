'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { CartItem, Order, OrderType } from '@/types';
import { authService } from '@/app/services/auth.api';
import { orderService } from '@/app/services/orders.api';

// Modular Components
import OrderSummary from './components/OrderSummary';
import CustomerDetails, { LoyaltyRewardOption } from './components/CustomerDetails';
import CheckoutActions from './components/CheckoutActions';

import { use } from 'react';
import { useRestaurant } from '@/hooks/useRestaurant';

export default function CheckoutPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const router = useRouter();
  const [cart, setCart] = useState<Map<string, CartItem>>(new Map());
  const { restaurant, loading: resLoading } = useRestaurant();

  useEffect(() => {
    if (!resLoading && restaurant && restaurant.modules?.ONLINE_ORDERING === false) {
      router.replace(`/${slug}/menu`);
    }
  }, [restaurant, resLoading, router, slug]);

  const [loading, setLoading] = useState(false);
  const isSubmittingRef = useRef(false);
  const [checkingActive, setCheckingActive] = useState(true);
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [addToMode, setAddToMode] = useState(false); // true = adding to existing order
  const [inOtpStep, setInOtpStep] = useState(false);
  const [selectedReward, setSelectedReward] = useState<LoyaltyRewardOption | null>(null);
  const [form, setForm] = useState<{
    customer_name: string;
    phone: string;
    party_size: string;
    notes: string;
    order_type?: OrderType | string;
  }>({
    customer_name: '',
    phone: '',
    party_size: '',
    notes: '',
    order_type: 'DINE_IN',
  });

  const [currentUser, setCurrentUser] = useState<any>(null);

  // ── AUTH CHECK ──────────────────────────────────────────────────
  const checkAuth = useCallback(async () => {
    try {
      const data = await authService.me();
      if (data.success && data.user) {
        setCurrentUser(data.user);
        return data.user;
      }
    } catch (e) {
      console.error('Auth check failed:', e);
    }
    return null;
  }, []);

  // ── CHECK ACTIVE ORDER HELPER ────────────────────────────────────
  const checkActiveOrderForPhone = useCallback(async (phone?: string) => {
    if (!phone) return null;
    try {
      const data = await orderService.getHistory(phone);
      if (data.success && data.data) {
        const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
        const active = (data.data as Order[]).find(o => {
          const orderDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(o.created_at));
          const st = (o.status || '').toUpperCase();
          return !['CLOSED', 'CANCELLED', 'EXPIRED'].includes(st) && orderDate === todayStr;
        });
        if (active) {
          setActiveOrder(active);
          setAddToMode(true);
          return active;
        } else {
          setActiveOrder(null);
          setAddToMode(false);
        }
      }
    } catch (e) {
      console.error('Active order check failed:', e);
    }
    return null;
  }, []);

  useEffect(() => {
    const init = async () => {
      // 1. Load Cart
      if (!slug) return;
      const saved = localStorage.getItem(`cart_${slug}`);
      if (saved) {
        try { setCart(new Map(Object.entries(JSON.parse(saved)))); } catch { }
      }

      // 2. Check Auth & Load User
      const user = await checkAuth();
      if (user) {
        setForm(f => {
          let loadedPhone = user.phone || f.phone;
          if (loadedPhone && !loadedPhone.startsWith('+')) {
            loadedPhone = `+91${loadedPhone}`;
          }
          return {
            ...f, 
            phone: loadedPhone, 
            customer_name: user.name || f.customer_name 
          };
        });

        // 3. Check for Active Order
        await checkActiveOrderForPhone(user.phone);
      }
      setCheckingActive(false);
    };

    init();
  }, [checkAuth, checkActiveOrderForPhone, slug]);

  const items = Array.from(cart.values());
  const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
  
  let gstAmount = 0;
  let total = subtotal;
  if (restaurant?.gst_type === 'REGULAR') {
    const rate = Number(restaurant.gst_rate) || 0;
    gstAmount = Math.round((subtotal * rate / 100) * 100) / 100;
    total = subtotal + gstAmount;
  }

  // Calculate Loyalty Reward Discount
  let discountAmount = 0;
  if (selectedReward) {
    if (selectedReward.reward_type === 'DISCOUNT_AMOUNT') {
      discountAmount = Math.min(total, Number(selectedReward.discount_value || 0));
    } else if (selectedReward.reward_type === 'DISCOUNT_PERCENTAGE') {
      discountAmount = Math.min(total, Math.round((subtotal * Number(selectedReward.discount_value || 0)) / 100));
    } else if (selectedReward.reward_type === 'FREE_ITEM') {
      discountAmount = 0; // Discount is applied directly via 0-price line item
    }
  }

  const finalTotal = Math.max(0, total - discountAmount);

  const normalizeDigits = (p?: string) => (p ? p.replace(/\D/g, '').slice(-10) : '');
  const isVerified = Boolean(
    currentUser &&
    currentUser.phone &&
    form.phone &&
    normalizeDigits(currentUser.phone) === normalizeDigits(form.phone)
  );


  // ── PLACE NEW ORDER ──────────────────────────────────────────────
  const handleNewOrder = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isSubmittingRef.current || loading) return;

    if (activeOrder) {
      toast.error(`You have an active order (#${activeOrder.ticket_number}). Adding items to active order instead.`);
      setAddToMode(true);
      return;
    }
    
    if (!form.customer_name.trim() || form.customer_name.length < 2) {
      toast.error('Please enter your name (min 2 characters)');
      return;
    }
    const cleanedPhone = form.phone.replace(/\D/g, '');
    if (!cleanedPhone) {
      toast.error('Phone number is required');
      return;
    }
    if (cleanedPhone.length < 10) {
      toast.error('Please enter a valid 10-digit phone number');
      return;
    }
    const isTakeaway = form.order_type === 'TAKEAWAY';
    if (!isTakeaway) {
      const partySize = parseInt(form.party_size);
      if (!form.party_size || partySize < 1) {
        toast.error('Please select number of persons');
        return;
      }
    }
    if (items.length === 0) {
      toast.error('Your cart is empty');
      return;
    }

    // Set synchronous locks immediately BEFORE any async work
    isSubmittingRef.current = true;
    setLoading(true);

    try {
      // Dynamic verification check (user may have changed phone number)
      const user = await checkAuth();
      const verified = Boolean(
        user &&
        user.phone &&
        form.phone &&
        normalizeDigits(user.phone) === normalizeDigits(form.phone)
      );
      if (!verified) {
        toast.error('Please verify your phone number first.');
        isSubmittingRef.current = false;
        setLoading(false);
        return;
      }

      // Re-verify if an active order exists for this phone before creating a new order
      const foundActive = await checkActiveOrderForPhone(form.phone);
      if (foundActive) {
        toast.error(`You already have an active order (#${foundActive.ticket_number}). Adding to your existing order.`);
        setAddToMode(true);
        isSubmittingRef.current = false;
        setLoading(false);
        return;
      }

      const orderItems = items.map(i => ({
        product_id: i.product_id,
        quantity: i.quantity,
        price_at_purchase: i.price,
      }));

      // Handle FREE_ITEM loyalty reward line item
      if (selectedReward && selectedReward.reward_type === 'FREE_ITEM') {
        let freeProductId: string | undefined = undefined;
        if (Array.isArray(selectedReward.selected_product_ids) && selectedReward.selected_product_ids.length > 0) {
          freeProductId = selectedReward.selected_product_ids[0];
        }

        if (freeProductId) {
          const existingIdx = orderItems.findIndex(i => i.product_id === freeProductId);
          if (existingIdx >= 0) {
            if (orderItems[existingIdx].quantity > 1) {
              orderItems[existingIdx].quantity -= 1;
              orderItems.push({
                product_id: freeProductId,
                quantity: 1,
                price_at_purchase: 0,
              });
            } else {
              orderItems[existingIdx].price_at_purchase = 0;
            }
          } else {
            orderItems.push({
              product_id: freeProductId,
              quantity: 1,
              price_at_purchase: 0,
            });
          }
        } else if (orderItems.length > 0) {
          // If no specific product is linked to reward, set first item as free reward
          if (orderItems[0].quantity > 1) {
            orderItems[0].quantity -= 1;
            orderItems.push({
              product_id: orderItems[0].product_id,
              quantity: 1,
              price_at_purchase: 0,
            });
          } else {
            orderItems[0].price_at_purchase = 0;
          }
        }
      }

      const storedTable = typeof window !== 'undefined' ? localStorage.getItem(`table_number_${slug}`) || undefined : undefined;
      const combinedNotes = form.notes.trim();

      const data = await orderService.createOrder({
        customer_name: form.customer_name.trim(),
        phone: form.phone,
        items: orderItems,
        notes: combinedNotes || undefined,
        party_size: isTakeaway ? 0 : (parseInt(form.party_size) || 1),
        table_number: isTakeaway ? undefined : storedTable,
        order_type: (form.order_type as OrderType) || 'DINE_IN',
        discount_amount: discountAmount,
      });

      if (data.success && data.data) {
        // Redeem loyalty reward if selected
        if (selectedReward) {
          try {
            await fetch('/api/admin/loyalty/redeem', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                slug,
                phone: form.phone,
                reward_id: selectedReward.id,
              }),
            });
          } catch (err) {
            console.error('Failed to process loyalty reward redemption:', err);
          }
        }

        // Always store customer profile in localStorage so /order-status can find their orders!
        try {
          const existing = localStorage.getItem('user');
          const u = existing ? JSON.parse(existing) : {};
          localStorage.setItem('user', JSON.stringify({
            ...u,
            name: form.customer_name.trim(),
            phone: form.phone.trim(),
          }));
        } catch {
          localStorage.setItem('user', JSON.stringify({
            name: form.customer_name.trim(),
            phone: form.phone.trim(),
          }));
        }
        localStorage.setItem(`customer_phone_${slug}`, form.phone.trim());
        localStorage.removeItem(`cart_${slug}`);
        localStorage.removeItem(`add_to_order_${slug}`);
        localStorage.removeItem(`table_number_${slug}`);
        toast.success('Order placed successfully!');
        router.push(`/${slug}/order-status/${data.data.id}`);
      } else {
        toast.error(data.error || 'Failed to place order');
        if (data.error && data.error.includes('active order')) {
          await checkActiveOrderForPhone(form.phone);
        }
      }
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      isSubmittingRef.current = false;
      setLoading(false);
    }
  };

  // ── ADD ITEMS TO EXISTING ORDER ──────────────────────────────────
  const handleAddToOrder = async () => {
    if (isSubmittingRef.current || loading) return;
    if (!activeOrder) return;
    if (items.length === 0) {
      toast.error('Your cart is empty');
      return;
    }

    isSubmittingRef.current = true;
    setLoading(true);

    try {
      // Always check auth before proceeding
      const user = await checkAuth();
      if (!user) {
        toast.error('Session expired. Please verify again.');
        isSubmittingRef.current = false;
        setLoading(false);
        return;
      }

      let existingItemsList = activeOrder.items || [];
      if (!existingItemsList || existingItemsList.length === 0) {
        try {
          const fresh = await orderService.getOrderById(activeOrder.id);
          if (fresh.success && fresh.data?.items) {
            existingItemsList = fresh.data.items;
          }
        } catch { }
      }

      const existingItems: { product_id: string; quantity: number }[] = existingItemsList.map(
        (oi: any) => ({ product_id: oi.product_id, quantity: Number(oi.quantity) })
      );

      const mergedMap = new Map<string, number>();
      for (const oi of existingItems) {
        mergedMap.set(oi.product_id, (mergedMap.get(oi.product_id) || 0) + oi.quantity);
      }
      for (const ci of items) {
        mergedMap.set(ci.product_id, (mergedMap.get(ci.product_id) || 0) + ci.quantity);
      }

      const mergedItems = Array.from(mergedMap.entries()).map(([product_id, quantity]) => ({
        product_id,
        quantity,
      }));

      const data = await orderService.updateOrder(activeOrder.id, { items: mergedItems });

      if (data.success) {
        localStorage.removeItem(`cart_${slug}`);
        localStorage.removeItem(`add_to_order_${slug}`);
        toast.success(`Items added to Order #${String(activeOrder.ticket_number).padStart(3, '0')}!`);
        router.push(`/${slug}/order-status/${activeOrder.id}`);
      } else {
        toast.error(data.error || 'Failed to update order');
      }
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      isSubmittingRef.current = false;
      setLoading(false);
    }
  };

  if (checkingActive) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="loader" style={{ width: 36, height: 36, borderWidth: 3 }} />
      </div>
    );
  }

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      {/* Header */}
      <div className="page-header">
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => router.back()} style={{ minWidth: 'auto' }}>← Back</button>
        <h1 style={{ fontWeight: 800, fontSize: '18px' }}>Checkout</h1>
        <div />
      </div>

      {/* Active order info banner */}
      {activeOrder && (
        <div style={{ maxWidth: '480px', margin: '12px auto 0', padding: '0 16px' }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
            padding: '12px 14px',
            borderRadius: '12px',
            background: '#EFF6FF',
            border: '1px solid #BFDBFE',
          }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '13px', fontWeight: 800, color: '#1E3A8A' }}>
                  Active Order #{String(activeOrder.ticket_number).padStart(3, '0')}
                </span>
                <span style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '1px 6px',
                  borderRadius: '6px',
                  background: '#DBEAFE',
                  color: '#1D4ED8'
                }}>
                  {activeOrder.status}
                </span>
              </div>
              <p style={{ fontSize: '12px', color: '#2563EB', margin: '2px 0 0', fontWeight: 500 }}>
                {addToMode 
                  ? 'Adding items to your active table ticket' 
                  : 'Active order in progress'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => router.push(`/${slug}/order-status/${activeOrder.id}`)}
              style={{
                fontSize: '11px',
                fontWeight: 700,
                color: '#1D4ED8',
                background: '#FFFFFF',
                border: '1px solid #BFDBFE',
                borderRadius: '6px',
                padding: '5px 10px',
                whiteSpace: 'nowrap',
                cursor: 'pointer'
              }}
            >
              View Order
            </button>
          </div>
        </div>
      )}

      <div style={{ maxWidth: '480px', margin: '0 auto', padding: '16px', paddingBottom: '140px' }}>
        <OrderSummary 
          items={items}
          subtotal={subtotal}
          gstAmount={gstAmount}
          gstRate={restaurant?.gst_rate}
          gstType={restaurant?.gst_type}
          discountAmount={discountAmount}
          appliedRewardName={selectedReward?.name}
          total={total}
          addToMode={addToMode}
          activeOrder={activeOrder}
        />

        {addToMode && activeOrder ? (
          <div className="card" style={{ marginBottom: '16px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <span style={{ fontSize: '11px', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Adding to Active Ticket
              </span>
              <span style={{ fontSize: '13px', fontWeight: 800, color: '#0F172A' }}>
                #{String(activeOrder.ticket_number).padStart(3, '0')}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px', color: '#334155' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748B' }}>Customer:</span>
                <span style={{ fontWeight: 600 }}>{activeOrder.customer_name || form.customer_name || 'Customer'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748B' }}>Phone:</span>
                <span style={{ fontWeight: 600 }}>{activeOrder.phone || form.phone}</span>
              </div>
              {activeOrder.table_number && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748B' }}>Table:</span>
                  <span style={{ fontWeight: 700, color: 'var(--primary)' }}>Table {activeOrder.table_number}</span>
                </div>
              )}
            </div>
            <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px dashed #CBD5E1', fontSize: '12px', color: '#64748B' }}>
              💡 Items will be appended directly to this order and routed to the kitchen.
            </div>
          </div>
        ) : (
          <CustomerDetails 
            slug={slug}
            subtotal={subtotal}
            form={form}
            setForm={setForm}
            isVerified={isVerified}
            onVerified={async (user) => {
              setCurrentUser(user);
              if (user?.phone) {
                await checkActiveOrderForPhone(user.phone);
              }
            }}
            onSubmit={handleNewOrder}
            totalQty={items.reduce((s, i) => s + i.quantity, 0)}
            onOtpStepChange={setInOtpStep}
            selectedReward={selectedReward}
            onSelectReward={setSelectedReward}
          />
        )}
      </div>

      <CheckoutActions 
        addToMode={addToMode}
        loading={loading}
        isVerified={isVerified}
        inOtpStep={inOtpStep}
        itemsCount={items.length}
        total={finalTotal}
        ticketNumber={activeOrder?.ticket_number}
        onAddToOrder={handleAddToOrder}
        onSubmitNewOrder={handleNewOrder}
        hasActiveOrder={!!activeOrder}
      />
    </div>
  );
}

