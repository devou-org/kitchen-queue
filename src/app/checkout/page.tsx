'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { CartItem, Order } from '@/types';
import { authService } from '@/app/services/auth.api';
import { orderService } from '@/app/services/orders.api';
import BottomNav from '@/components/BottomNav';

// Modular Components
import OrderSummary from './components/OrderSummary';
import CustomerDetails from './components/CustomerDetails';
import CheckoutActions from './components/CheckoutActions';

// Statuses where adding to an existing order is allowed
const ADDABLE_STATUSES = ['PENDING', 'PREPARING', 'READY'];

export default function CheckoutPage() {
  const router = useRouter();
  const [cart, setCart] = useState<Map<string, CartItem>>(new Map());
  const [loading, setLoading] = useState(false);
  const [checkingActive, setCheckingActive] = useState(true);
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [addToMode, setAddToMode] = useState(false); // true = adding to existing order
  const [form, setForm] = useState({
    customer_name: '',
    phone: '',
    party_size: '',
    notes: '',
  });
  const [otpActive, setOtpActive] = useState(false);

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

  useEffect(() => {
    const init = async () => {
      // 1. Load Cart
      const saved = localStorage.getItem('cart');
      if (saved) {
        try { setCart(new Map(Object.entries(JSON.parse(saved)))); } catch { }
      }

      // 2. Check Auth & Load User
      const user = await checkAuth();
      if (user) {
        setForm(f => ({ 
          ...f, 
          phone: user.phone || f.phone, 
          customer_name: user.name || f.customer_name 
        }));
      }
      setCheckingActive(false);
    };

    init();
  }, [checkAuth]);

  // 3. Check for Active Order when user is known
  useEffect(() => {
    const fetchActive = async () => {
      if (currentUser?.phone) {
        try {
          const data = await orderService.getHistory(currentUser.phone);
          if (data.success && data.data) {
            const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
            const active = (data.data as Order[]).find(o => {
              const orderDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(o.created_at));
              return ADDABLE_STATUSES.includes(o.status) && orderDate === todayStr;
            });
            if (active) {
              setActiveOrder(active);
            }
          }
        } catch (e) {}
      }
    };
    fetchActive();
  }, [currentUser]);

  const items = Array.from(cart.values());
  const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const total = subtotal;

  const isVerified = currentUser && currentUser.phone === form.phone;


  // ── PLACE NEW ORDER ──────────────────────────────────────────────
  const handleNewOrder = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (loading) return;
    
    setLoading(true);

    // Use existing user state for verification check
    const user = currentUser;
    
    if (!form.customer_name.trim() || form.customer_name.length < 2) {
      toast.error('Please enter your name (min 2 characters)');
      setLoading(false);
      return;
    }
    const cleanedPhone = form.phone.replace(/\D/g, '');
    if (!cleanedPhone) {
      toast.error('Phone number is required');
      setLoading(false);
      return;
    }
    if (cleanedPhone.length < 10) {
      toast.error('Please enter a valid 10-digit phone number');
      setLoading(false);
      return;
    }
    const partySize = parseInt(form.party_size);
    if (!form.party_size || partySize < 1) {
      toast.error('Please select number of persons');
      setLoading(false);
      return;
    }
    if (items.length === 0) {
      toast.error('Your cart is empty');
      setLoading(false);
      return;
    }

    // Dynamic verification check (user may have changed phone number)
    const verified = user && user.phone === form.phone;
    if (!verified) {
      toast.error('Please verify your phone number first.');
      setLoading(false);
      return;
    }

    try {
      const orderItems = items.map(i => ({
        product_id: i.product_id,
        quantity: i.quantity,
        price_at_purchase: i.price,
      }));

      const data = await orderService.createOrder({
        customer_name: form.customer_name.trim(),
        phone: form.phone,
        items: orderItems,
        notes: form.notes.trim() || undefined,
        party_size: parseInt(form.party_size),
      });

      if (data.success && data.data) {
        // Update user name in local storage if changed
        const existing = localStorage.getItem('user');
        if (existing) {
          try {
            const u = JSON.parse(existing);
            localStorage.setItem('user', JSON.stringify({ ...u, name: form.customer_name.trim() }));
          } catch { }
        }
        localStorage.removeItem('cart');
        localStorage.removeItem('add_to_order');
        toast.success('Order placed successfully! 🎉');
        router.push(`/order-status/${data.data.ticket_number}`);
      } else {
        toast.error(data.error || 'Failed to place order');
      }
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── ADD ITEMS TO EXISTING ORDER ──────────────────────────────────
  const handleAddToOrder = async () => {
    if (loading) return;
    
    setLoading(true);

    if (!activeOrder) {
      setLoading(false);
      return;
    }
    if (items.length === 0) {
      toast.error('Your cart is empty');
      setLoading(false);
      return;
    }

    // Use existing user state for verification check
    const user = currentUser;
    if (!user) {
      toast.error('Session expired. Please verify again.');
      setLoading(false);
      return;
    }

    try {
      const existingItems: { product_id: string; quantity: number }[] = (activeOrder.items || []).map(
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
        localStorage.removeItem('cart');
        localStorage.removeItem('add_to_order');
        toast.success('Items added to your order! 🎉');
        router.push(`/order-status/${activeOrder.ticket_number}`);
      } else {
        toast.error(data.error || 'Failed to update order');
      }
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
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
            display: 'flex', alignItems: 'flex-start', gap: '10px',
            padding: '12px 14px',
            borderRadius: '12px',
            background: '#fffbeb',
            border: '1px solid #fde68a',
          }}>
            <span style={{ fontSize: '16px', flexShrink: 0, marginTop: '2px' }}>⚠️</span>
            <p style={{ fontSize: '13px', color: '#92400e', fontWeight: 600, lineHeight: 1.5, margin: 0 }}>
              You already have an active order (<span style={{ fontWeight: 800 }}>#{String(activeOrder.ticket_number).padStart(3, '0')}</span>). 
              To add more items to your table, please contact the staff.
            </p>
          </div>
        </div>
      )}

      <div style={{ maxWidth: '480px', margin: '0 auto', padding: '16px', paddingBottom: '280px' }}>
        <OrderSummary 
          items={items}
          subtotal={subtotal}
          total={total}
          addToMode={addToMode}
          activeOrder={activeOrder}
        />

        {!addToMode && (
          <CustomerDetails 
            form={form}
            setForm={setForm}
            isVerified={isVerified}
            onVerified={(user) => setCurrentUser(user)}
            onSubmit={handleNewOrder}
            totalQty={items.reduce((s, i) => s + i.quantity, 0)}
            onOtpStepChange={setOtpActive}
          />
        )}
      </div>

      {!otpActive && (
        <CheckoutActions 
          addToMode={addToMode}
          loading={loading}
          isVerified={isVerified}
          itemsCount={items.length}
          total={total}
          ticketNumber={activeOrder?.ticket_number}
          onAddToOrder={handleAddToOrder}
          onSubmitNewOrder={handleNewOrder}
          isPartySizeValid={addToMode ? true : (items.reduce((s, i) => s + i.quantity, 0) >= parseInt(form.party_size || '1') - 1)}
          hasActiveOrder={!!activeOrder}
        />
      )}


      <BottomNav />
    </div>
  );
}
