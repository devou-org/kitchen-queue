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
import OtpModal from './components/OtpModal';
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

  const [currentUser, setCurrentUser] = useState<any>(null);

  // OTP Verification State
  const [otpStep, setOtpStep] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpToken, setOtpToken] = useState('');
  const [verifyingOtp, setVerifyingOtp] = useState(false);

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

        // 3. Check for Active Order
        if (user.phone) {
          try {
            const data = await orderService.getHistory(user.phone);
            if (data.success && data.data) {
              const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
              const active = (data.data as Order[]).find(o => {
                const orderDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(o.created_at));
                return ADDABLE_STATUSES.includes(o.status) && orderDate === todayStr;
              });
              if (active) {
                // setActiveOrder(active);
                // Always add to existing order automatically
                // setAddToMode(true);
              }
            }
          } catch (e) {}
        }
      }
      setCheckingActive(false);
    };

    init();
  }, [checkAuth]);

  const items = Array.from(cart.values());
  const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const total = subtotal;

  const isVerified = currentUser && currentUser.phone === form.phone;

  // ── HANDLE VERIFY CLICK ──────────────────────────────────────────
  const handleVerifyClick = async () => {
    const cleanedPhone = form.phone.replace(/\D/g, '');
    if (!cleanedPhone || cleanedPhone.length < 10) {
      toast.error('Please enter a valid 10-digit phone number');
      return;
    }
    
    setLoading(true);
    try {
      const data = await authService.sendOtp(form.phone);
      if (data.success && data.otp_token) {
        setOtpToken(data.otp_token);
        setOtpStep(true);
        toast.success('OTP sent to your phone');
      } else {
        toast.error(data.error || 'Failed to send OTP');
      }
    } catch (err) {
      toast.error('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const verifyOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otpCode.length !== 6) {
      toast.error('Please enter a valid 6-digit OTP');
      return;
    }
    
    setVerifyingOtp(true);
    try {
      const data = await authService.verifyOtp(otpCode, otpToken);
      if (data.success) {
        toast.success('Phone verified successfully!');
        setOtpStep(false);
        const updatedUser = authService.getUser();
        setCurrentUser(updatedUser);
      } else {
        toast.error(data.error || 'Invalid OTP');
      }
    } catch (err) {
      toast.error('Network error. Please try again.');
    } finally {
      setVerifyingOtp(false);
    }
  };

  // ── PLACE NEW ORDER ──────────────────────────────────────────────
  const handleNewOrder = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    // Always check auth before proceeding to ensure session is valid
    const user = await checkAuth();
    
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
    if (!form.party_size || parseInt(form.party_size) < 1) {
      toast.error('Please select number of persons');
      return;
    }
    if (items.length === 0) {
      toast.error('Your cart is empty');
      return;
    }

    // Dynamic verification check (user may have changed phone number)
    const verified = user && user.phone === form.phone;
    if (!verified) {
      toast.error('Please verify your phone number first.');
      return;
    }

    setLoading(true);
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
    if (!activeOrder) return;
    if (items.length === 0) {
      toast.error('Your cart is empty');
      return;
    }

    // Always check auth before proceeding
    const user = await checkAuth();
    if (!user) {
      toast.error('Session expired. Please verify again.');
      return;
    }

    setLoading(true);
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
            display: 'flex', alignItems: 'center', gap: '10px',
            padding: '10px 14px',
            borderRadius: '12px',
            background: 'rgba(59,130,246,0.06)',
            border: '1px solid rgba(59,130,246,0.18)',
          }}>
            <span style={{ fontSize: '16px', flexShrink: 0 }}>ℹ️</span>
            <p style={{ fontSize: '13px', color: '#1E40AF', fontWeight: 600, lineHeight: 1.5, margin: 0 }}>
              These items will be added to your existing order{' '}
              <span style={{ fontWeight: 800 }}>#{String(activeOrder.ticket_number).padStart(3, '0')}</span>.
            </p>
          </div>
        </div>
      )}

      <div style={{ maxWidth: '480px', margin: '0 auto', padding: '16px', paddingBottom: '140px' }}>
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
            loading={loading}
            handleVerifyClick={handleVerifyClick}
            onSubmit={handleNewOrder}
          />
        )}
      </div>

      <CheckoutActions 
        addToMode={addToMode}
        loading={loading}
        isVerified={isVerified}
        itemsCount={items.length}
        total={total}
        ticketNumber={activeOrder?.ticket_number}
        onAddToOrder={handleAddToOrder}
        onSubmitNewOrder={handleNewOrder}
      />

      {otpStep && (
        <OtpModal 
          phone={form.phone}
          otpCode={otpCode}
          setOtpCode={setOtpCode}
          verifyingOtp={verifyingOtp}
          loading={loading}
          onSubmit={verifyOtpSubmit}
          onClose={() => setOtpStep(false)}
        />
      )}

      <BottomNav />
    </div>
  );
}
