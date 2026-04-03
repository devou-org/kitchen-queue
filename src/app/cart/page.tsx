'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { formatPrice } from '@/lib/format';
import { CartItem } from '@/types';
import { TAX_RATE } from '@/lib/constants';

export default function CartPage() {
  const router = useRouter();
  const [cart, setCart] = useState<Map<string, CartItem>>(new Map());

  useEffect(() => {
    const saved = localStorage.getItem('cart');
    if (saved) {
      try { setCart(new Map(Object.entries(JSON.parse(saved)))); } catch {}
    }
  }, []);

  const saveCart = (newCart: Map<string, CartItem>) => {
    const obj: Record<string, CartItem> = {};
    newCart.forEach((v, k) => { obj[k] = v; });
    localStorage.setItem('cart', JSON.stringify(obj));
    setCart(new Map(newCart));
  };

  const updateQty = (id: string, delta: number) => {
    const newCart = new Map(cart);
    const item = newCart.get(id);
    if (!item) return;
    const newQty = item.quantity + delta;
    if (newQty <= 0) newCart.delete(id);
    else newCart.set(id, { ...item, quantity: Math.min(newQty, 10) });
    saveCart(newCart);
  };

  const items = Array.from(cart.values());
  const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const tax = Math.round(subtotal * TAX_RATE * 100) / 100;
  const total = subtotal + tax;
  const totalItems = items.reduce((s, i) => s + i.quantity, 0);

  if (items.length === 0) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <div style={{ fontSize: '64px', marginBottom: '16px' }}>🛒</div>
        <h2 style={{ fontWeight: 800, marginBottom: '8px' }}>Your cart is empty</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>Add some delicious items from our menu!</p>
        <Link href="/menu" className="btn btn-primary btn-lg">Browse Menu</Link>
      </div>
    );
  }

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      {/* Header */}
      <div className="page-header">
        <button className="btn btn-ghost btn-sm" onClick={() => router.back()} style={{ minWidth: 'auto' }}>← Back</button>
        <h1 style={{ fontWeight: 800, fontSize: '18px' }}>Your Order</h1>
        <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>{totalItems} items</span>
      </div>

      <div style={{ maxWidth: '480px', margin: '0 auto', padding: '16px', paddingBottom: '160px' }}>
        {/* Items */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
          {items.map(item => (
            <div key={item.product_id} className="card" style={{ padding: '16px' }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <img
                  src={item.image_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=100&h=100&fit=crop'}
                  alt={item.name}
                  style={{ width: '60px', height: '60px', borderRadius: '10px', objectFit: 'cover', flexShrink: 0 }}
                  onError={(e) => { (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=100&h=100&fit=crop'; }}
                />
                <div style={{ flex: 1 }}>
                  <h3 style={{ fontWeight: 700, fontSize: '15px' }}>{item.name}</h3>
                  <p style={{ color: 'var(--primary)', fontWeight: 600, fontSize: '14px' }}>{formatPrice(item.price)}</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <button className="qty-btn" onClick={() => updateQty(item.product_id, -1)}>−</button>
                  <span style={{ fontWeight: 700, minWidth: '20px', textAlign: 'center' }}>{item.quantity}</span>
                  <button className="qty-btn" onClick={() => updateQty(item.product_id, 1)}>+</button>
                </div>
              </div>
              <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>{item.quantity} × {formatPrice(item.price)}</span>
                <span style={{ fontWeight: 700 }}>{formatPrice(item.price * item.quantity)}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Summary */}
        <div className="card">
          <h3 style={{ fontWeight: 700, marginBottom: '14px' }}>Order Summary</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Subtotal</span>
              <span>{formatPrice(subtotal)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Tax (10%)</span>
              <span>{formatPrice(tax)}</span>
            </div>
            <hr style={{ border: 'none', borderTop: '1px solid var(--border)' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '18px' }}>
              <span>Total</span>
              <span style={{ color: 'var(--primary)' }}>{formatPrice(total)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Fixed Bottom */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: 'white', borderTop: '1px solid var(--border)',
        padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px',
      }}>
        <Link href="/checkout" className="btn btn-primary btn-lg" style={{ width: '100%' }}>
          Continue to Checkout →
        </Link>
        <Link href="/menu" className="btn btn-ghost btn-sm" style={{ textAlign: 'center' }}>
          ← Back to Menu
        </Link>
      </div>
    </div>
  );
}
