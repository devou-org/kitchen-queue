'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { formatPrice } from '@/lib/format';
import { CartItem } from '@/types';
import { TAX_RATE } from '@/lib/constants';
import BottomNav from '@/components/BottomNav';

export default function CheckoutPage() {
  const router = useRouter();
  const [cart, setCart] = useState<Map<string, CartItem>>(new Map());
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    customer_name: '',
    phone: '',
    party_size: '1',
    notes: '',
  });

  useEffect(() => {
    const saved = localStorage.getItem('cart');
    if (saved) {
      try { setCart(new Map(Object.entries(JSON.parse(saved)))); } catch {}
    }
    const user = localStorage.getItem('user');
    if (user) {
      const u = JSON.parse(user);
      setForm(f => ({
        ...f,
        phone: u.phone || '',
        customer_name: u.name || '',
      }));
    }
  }, []);

  const items = Array.from(cart.values());
  const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const tax = Math.round(subtotal * TAX_RATE * 100) / 100;
  const total = subtotal + tax;

  const handleSubmit = async () => {
    if (!form.customer_name.trim() || form.customer_name.length < 2) {
      return toast.error('Please enter your name (min 2 characters)');
    }
    if (!form.phone.trim()) return toast.error('Phone number is required');
    if (!form.party_size || parseInt(form.party_size) < 1) {
      return toast.error('Please select number of persons');
    }
    if (items.length === 0) return toast.error('Your cart is empty');

    setLoading(true);
    try {
      const token = localStorage.getItem('auth_token');
      const orderItems = items.map(i => ({
        product_id: i.product_id,
        quantity: i.quantity,
        price_at_purchase: i.price,
      }));

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          customer_name: form.customer_name.trim(),
          phone: form.phone,
          items: orderItems,
          notes: form.notes.trim() || undefined,
          party_size: parseInt(form.party_size),
        }),
      });

      const data = await res.json();
      if (data.success) {
        localStorage.removeItem('cart');
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

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      {/* Header */}
      <div className="page-header">
        <button className="btn btn-ghost btn-sm" onClick={() => router.back()} style={{ minWidth: 'auto' }}>← Back</button>
        <h1 style={{ fontWeight: 800, fontSize: '18px' }}>Checkout</h1>
        <div />
      </div>

      <div style={{ maxWidth: '480px', margin: '0 auto', padding: '16px', paddingBottom: '140px' }}>
        {/* Order Summary */}
        <div className="card" style={{ marginBottom: '16px' }}>
          <h3 style={{ fontWeight: 700, marginBottom: '14px', fontSize: '16px' }}>📋 Order Summary</h3>
          {items.map(item => (
            <div key={item.product_id} style={{
              display: 'flex', justifyContent: 'space-between',
              padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: '14px',
            }}>
              <span>{item.name} × {item.quantity}</span>
              <span style={{ fontWeight: 600 }}>{formatPrice(item.price * item.quantity)}</span>
            </div>
          ))}
          <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--text-secondary)' }}>
              <span>Subtotal</span><span>{formatPrice(subtotal)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--text-secondary)' }}>
              <span>Tax (10%)</span><span>{formatPrice(tax)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '18px', paddingTop: '8px', borderTop: '2px solid var(--border)' }}>
              <span>Total</span>
              <span style={{ color: 'var(--primary)' }}>{formatPrice(total)}</span>
            </div>
          </div>
        </div>

        {/* Customer Details */}
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
              />
            </div>
            <div>
              <label className="label">Number of Persons *</label>
              <select
                className="select"
                value={form.party_size}
                onChange={e => setForm(f => ({ ...f, party_size: e.target.value }))}
              >
                {[1,2,3,4,5,6,7,8,9,10].map(n => (
                  <option key={n} value={n}>{n} person{n > 1 ? 's' : ''}</option>
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
      </div>

      {/* Fixed Bottom */}
      <div style={{
        position: 'fixed', bottom: 64, left: 0, right: 0,
        background: 'white', borderTop: '1px solid var(--border)',
        padding: '16px',
        boxShadow: '0 -4px 10px rgba(0,0,0,0.05)',
      }}>
        <button
          className="btn btn-primary btn-lg"
          style={{ width: '100%' }}
          onClick={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <><span className="loader" style={{ width: 18, height: 18, borderWidth: 2 }} /> Placing Order...</>
          ) : (
            <>🎉 Place Order – {formatPrice(total)}</>
          )}
        </button>
      </div>

      <BottomNav />
    </div>
  );
}
