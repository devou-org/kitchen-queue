'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { formatPrice } from '@/lib/format';
import { CartItem, Order } from '@/types';
import { authService } from '@/app/services/auth.api';
import { orderService } from '@/app/services/orders.api';
import { TAX_RATE } from '@/lib/constants';
import BottomNav from '@/components/BottomNav';

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

  useEffect(() => {
    const saved = localStorage.getItem('cart');
    if (saved) {
      try { setCart(new Map(Object.entries(JSON.parse(saved)))); } catch { }
    }

    const user = localStorage.getItem('user');
    const token = localStorage.getItem('auth_token');

    if (user) {
      const u = JSON.parse(user);
      const localName = u.name || '';
      const localPhone = u.phone || '';
      setForm(f => ({ ...f, phone: localPhone, customer_name: localName }));

      if (token && !localName && localPhone) {
        authService.me()
          .then(data => {
            if (data.success && data.user && data.user.name) {
              const userName = data.user.name;
              setForm(f => ({ ...f, customer_name: userName }));
              const updated = { ...u, name: userName };
              localStorage.setItem('user', JSON.stringify(updated));
            }
          })
          .catch(() => { });
      }

      // Check if user has an active PENDING/PREPARING order FROM TODAY
      if (localPhone) {
        orderService.getHistory(localPhone)
          .then(data => {
            if (data.success && data.data) {
              const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
              const active = (data.data as Order[]).find(o => {
                const orderDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(o.created_at));
                return ADDABLE_STATUSES.includes(o.status) && orderDate === todayStr;
              });
              
              if (active) {
                setActiveOrder(active);
                // Always add to existing order automatically
                setAddToMode(true);
              }
            }
          })
          .catch(() => { })
          .finally(() => setCheckingActive(false));
      } else {
        setCheckingActive(false);
      }
    } else {
      setCheckingActive(false);
    }
  }, []);

  const items = Array.from(cart.values());
  const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const total = subtotal;

  // ── PLACE NEW ORDER ──────────────────────────────────────────────
  const handleNewOrder = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!form.customer_name.trim() || form.customer_name.length < 2)
      return toast.error('Please enter your name (min 2 characters)');
    const cleanedPhone = form.phone.replace(/\D/g, '');
    if (!cleanedPhone) return toast.error('Phone number is required');
    if (cleanedPhone.length < 10) return toast.error('Please enter a valid 10-digit phone number');
    if (!form.party_size || parseInt(form.party_size) < 1)
      return toast.error('Please select number of persons');
    if (items.length === 0) return toast.error('Your cart is empty');

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
    if (items.length === 0) return toast.error('Your cart is empty');

    setLoading(true);
    try {
      // Merge existing order items + new cart items
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

      {/* Active order info banner — auto adds to existing order */}
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
        {/* Order Summary */}
        <div className="card" style={{ marginBottom: '16px' }}>
          <h3 style={{ fontWeight: 700, marginBottom: '14px', fontSize: '16px' }}>📋 Order Summary</h3>
          {items.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Your cart is empty. Go back to the menu to add items.</p>
          ) : (
            <>
              {items.map(item => (
                <div key={item.product_id} style={{
                  display: 'flex', justifyContent: 'space-between',
                  padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: '14px',
                }}>
                  <span>{item.name} × {item.quantity}</span>
                  <span style={{ fontWeight: 600 }}>{formatPrice(item.price * item.quantity)}</span>
                </div>
              ))}
              {addToMode && activeOrder && (
                <div style={{
                  marginTop: '10px', padding: '8px 10px',
                  background: 'rgba(151,19,69,0.04)', borderRadius: '8px',
                  border: '1px dashed rgba(151,19,69,0.2)',
                }}>
                  <p style={{ fontSize: '12px', color: 'var(--primary)', fontWeight: 600 }}>
                    + {(activeOrder.items || []).length} existing item(s) from order #{String(activeOrder.ticket_number).padStart(3, '0')}
                  </p>
                </div>
              )}
              <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--text-secondary)' }}>
                  <span>Subtotal (new items)</span><span>{formatPrice(subtotal)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '18px', paddingTop: '8px', borderTop: '2px solid var(--border)' }}>
                  <span>Total</span>
                  <span style={{ color: 'var(--primary)' }}>{formatPrice(total)}</span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Customer Details — only needed for new orders */}
        {!addToMode && (
          <form onSubmit={handleNewOrder} id="new-order-form">
            <div className="card">
              <h3 style={{ fontWeight: 700, marginBottom: '18px', fontSize: '16px' }}>👤 Your Details</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label className="label">Full Name *</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="Enter your name"
                    value={form.customer_name}
                    onChange={e => setForm(f => ({ ...f, customer_name: e.target.value }))}
                    maxLength={50}
                    required
                  />
                </div>
                <div>
                  <label className="label">Phone Number *</label>
                  <input
                    type="tel"
                    className="input"
                    placeholder="+91 9xxxxxxxxx"
                    value={form.phone}
                    onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <label className="label">Number of Persons *</label>
                  <select
                    className="select"
                    value={form.party_size}
                    onChange={e => setForm(f => ({ ...f, party_size: e.target.value }))}
                    required
                  >
                    <option value="" disabled>Select persons</option>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                      <option key={n} value={n}>{n} Party</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Special Instructions (optional)</label>
                  <textarea
                    className="textarea"
                    placeholder="Any allergies, dietary needs, or special requests..."
                    value={form.notes}
                    onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                    maxLength={200}
                    rows={3}
                  />
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px', textAlign: 'right' }}>
                    {form.notes.length}/200
                  </p>
                </div>
              </div>
            </div>
          </form>
        )}
      </div>

      {/* Fixed Bottom CTA */}
      <div style={{
        position: 'fixed', bottom: 64, left: 0, right: 0,
        background: 'white', borderTop: '1px solid var(--border)',
        padding: '16px',
        boxShadow: '0 -4px 10px rgba(0,0,0,0.05)',
        zIndex: 100,
      }}>
        {addToMode ? (
          <button
            type="button"
            className="btn btn-primary btn-lg"
            style={{ width: '100%' }}
            disabled={loading || items.length === 0}
            onClick={handleAddToOrder}
          >
            {loading ? (
              <><span className="loader" style={{ width: 18, height: 18, borderWidth: 2 }} /> Adding Items...</>
            ) : (
              <>➕ Add to Order #{String(activeOrder?.ticket_number || '').padStart(3, '0')} – {formatPrice(total)}</>
            )}
          </button>
        ) : (
          <button
            type="submit"
            form="new-order-form"
            className="btn btn-primary btn-lg"
            style={{ width: '100%' }}
            disabled={loading}
          >
            {loading ? (
              <><span className="loader" style={{ width: 18, height: 18, borderWidth: 2 }} /> Placing Order...</>
            ) : (
              <>🎉 Place Order – {formatPrice(total)}</>
            )}
          </button>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
