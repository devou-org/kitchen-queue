'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { formatPrice } from '@/lib/format';
import { CartItem } from '@/types';
import { TAX_RATE } from '@/lib/constants';


import { use } from 'react';
import { useRestaurant } from '@/hooks/useRestaurant';

export default function CartPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const router = useRouter();
  const [cart, setCart] = useState<Map<string, CartItem>>(new Map());
  const { restaurant, loading: resLoading } = useRestaurant();

  useEffect(() => {
    if (!resLoading && restaurant && restaurant.modules?.ONLINE_ORDERING === false) {
      router.replace(`/${slug}/menu`);
    }
  }, [restaurant, resLoading, router, slug]);

  useEffect(() => {
    if (!slug) return;
    const saved = localStorage.getItem(`cart_${slug}`);
    if (saved) {
      try { setCart(new Map(Object.entries(JSON.parse(saved)))); } catch { }
    }
  }, [slug]);

  const saveCart = (newCart: Map<string, CartItem>) => {
    if (!slug) return;
    const obj: Record<string, CartItem> = {};
    newCart.forEach((v, k) => { obj[k] = v; });
    localStorage.setItem(`cart_${slug}`, JSON.stringify(obj));
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
  const total = subtotal;
  const totalItems = items.reduce((s, i) => s + i.quantity, 0);

  if (items.length === 0) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <div style={{ fontSize: '64px', marginBottom: '16px' }}>🛒</div>
        <h2 style={{ fontWeight: 800, marginBottom: '8px' }}>Your cart is empty</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>Add some delicious items from our menu!</p>
        <Link prefetch={false} href={`/${slug}/menu`} className="btn btn-primary btn-lg">Browse Menu</Link>
      </div>
    );
  }

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      {/* Header */}
      <div className="page-header">
        <button className="btn btn-ghost btn-sm" onClick={() => router.back()} style={{ minWidth: 'auto' }}>← Back</button>
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ fontWeight: 800, fontSize: '18px', margin: 0 }}>Your Order</h1>
          {typeof window !== 'undefined' && localStorage.getItem(`table_number_${slug}`) && (
            <span style={{ fontSize: '11px', fontWeight: 800, color: '#059669', background: '#ECFDF5', padding: '2px 8px', borderRadius: '12px', display: 'inline-block', marginTop: '2px' }}>
              TABLE #{localStorage.getItem(`table_number_${slug}`)}
            </span>
          )}
        </div>
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
              <span style={{ color: 'var(--text-secondary)' }}>Total Items</span>
              <span>{totalItems}</span>
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
        position: 'fixed',
        bottom: 'calc(24px + env(safe-area-inset-bottom))',
        left: 0,
        right: 0,
        margin: '0 auto',
        maxWidth: '480px',
        padding: '0 16px',
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}>
        <Link prefetch={false} href={`/${slug}/checkout`}
          className="btn btn-primary btn-lg"
          style={{
            width: '100%',
            borderRadius: '999px',
            background: 'var(--primary)',
            color: 'white',
            boxShadow: '0 8px 20px rgba(0,0,0,0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '4px 20px 4px 6px',
            height: '56px',
            border: 'none',
            textDecoration: 'none'
          }}
        >
          <div style={{
            width: '44px', height: '44px',
            borderRadius: '50%', background: 'rgba(255,255,255,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 800, fontSize: '15px', color: 'white'
          }}>
            {totalItems}
          </div>
          <span style={{ fontWeight: 700, fontSize: '16px', color: 'white' }}>Review & Order →</span>
          <span style={{ fontWeight: 800, fontSize: '16px', color: 'white' }}>{formatPrice(total)}</span>
        </Link>
        {/* <Link prefetch={false} href={`/${slug}/menu`} className="btn btn-ghost btn-sm" style={{ textAlign: 'center', height: '32px' }}>
          ← Back to Menu
        </Link> */}
      </div>


    </div>
  );
}
