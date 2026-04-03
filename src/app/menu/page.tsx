'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { formatPrice } from '@/lib/format';
import { Product, CartItem, ProductStatus } from '@/types';
import BottomNav from '@/components/BottomNav';

const STATUS_BADGE: Record<ProductStatus, { label: string; class: string }> = {
  AVAILABLE: { label: 'AVAILABLE', class: 'badge badge-available' },
  LOW_STOCK: { label: 'LOW STOCK', class: 'badge badge-low-stock' },
  OUT_OF_STOCK: { label: 'OUT OF STOCK', class: 'badge badge-out-of-stock' },
};

function ProductCard({ product, quantity, onUpdate }: {
  product: Product;
  quantity: number;
  onUpdate: (id: string, delta: number) => void;
}) {
  const isOut = product.status === 'OUT_OF_STOCK';

  return (
    <div className="card animate-fade-in" style={{
      padding: 0, overflow: 'hidden', opacity: isOut ? 0.75 : 1,
      transition: 'transform 0.2s ease, box-shadow 0.2s ease',
    }}>
      {/* Image */}
      <div style={{ position: 'relative', height: '140px', overflow: 'hidden' }}>
        <img
          src={product.image_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop'}
          alt={product.name}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          onError={(e) => {
            (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop';
          }}
        />
        <span className={STATUS_BADGE[product.status].class} style={{
          position: 'absolute', top: 8, left: 8, fontSize: '10px',
        }}>
          {STATUS_BADGE[product.status].label}
        </span>
      </div>

      {/* Info */}
      <div style={{ padding: '12px' }}>
        <h3 style={{ fontWeight: 700, fontSize: '15px', marginBottom: '2px' }}>{product.name}</h3>
        <p style={{ color: 'var(--primary)', fontWeight: 700, fontSize: '15px', marginBottom: '10px' }}>
          {formatPrice(product.price)}
        </p>

        {/* Quantity Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            className="qty-btn"
            onClick={() => onUpdate(product.id, -1)}
            disabled={isOut || quantity === 0}
          >−</button>
          <span style={{
            flex: 1, textAlign: 'center', fontWeight: 700, fontSize: '15px',
            color: quantity > 0 ? 'var(--primary)' : 'var(--text-secondary)',
          }}>{quantity}</span>
          <button
            className="qty-btn"
            onClick={() => onUpdate(product.id, 1)}
            disabled={isOut || quantity >= 10}
            style={{ color: isOut ? 'var(--text-secondary)' : 'var(--primary)' }}
          >+</button>
        </div>
      </div>
    </div>
  );
}

export default function MenuPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<Map<string, CartItem>>(new Map());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [categories, setCategories] = useState<string[]>(['All']);

  // Load cart from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('cart');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setCart(new Map(Object.entries(parsed)));
      } catch {}
    }
  }, []);

  // Save cart to localStorage
  const saveCart = useCallback((newCart: Map<string, CartItem>) => {
    const obj: Record<string, CartItem> = {};
    newCart.forEach((v, k) => { obj[k] = v; });
    localStorage.setItem('cart', JSON.stringify(obj));
    setCart(new Map(newCart));
  }, []);

  // Fetch products
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await fetch('/api/products');
        const data = await res.json();
        if (data.success) {
          setProducts(data.data);
          const cats = ['All', ...new Set<string>(data.data.map((p: Product) => p.category))];
          setCategories(cats);
        }
      } catch {
        toast.error('Failed to load menu');
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, []);

  // SSE for real-time updates
  useEffect(() => {
    const es = new EventSource('/api/queue/stream');
    es.onmessage = (e) => {
      const event = JSON.parse(e.data);
      if (event.type === 'product_update') {
        setProducts(prev => prev.map(p =>
          p.id === event.product_id ? { ...p, status: event.product_status } : p
        ));
      }
    };
    return () => es.close();
  }, []);

  const handleUpdate = (id: string, delta: number) => {
    const product = products.find(p => p.id === id);
    if (!product) return;

    const newCart = new Map(cart);
    const existing = newCart.get(id);
    const newQty = (existing?.quantity || 0) + delta;

    if (newQty <= 0) {
      newCart.delete(id);
    } else {
      newCart.set(id, {
        product_id: id,
        name: product.name,
        price: product.price,
        quantity: Math.min(newQty, 10),
        image_url: product.image_url,
        status: product.status,
      });
    }
    saveCart(newCart);
  };

  const totalItems = Array.from(cart.values()).reduce((s, i) => s + i.quantity, 0);
  const totalPrice = Array.from(cart.values()).reduce((s, i) => s + i.price * i.quantity, 0);

  const filtered = products.filter(p => {
    const matchCat = category === 'All' || p.category === category;
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      {/* Header */}
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '20px' }}>🍴</span>
          <span style={{ fontWeight: 800, fontSize: '16px' }}>Culinary Conductor</span>
        </div>
        <button
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '20px' }}
          onClick={() => toast('Notifications coming soon', { icon: '🔔' })}
        >🔔</button>
      </div>

      <div style={{ maxWidth: '480px', margin: '0 auto', padding: '0' }}>
        {/* Hero Section */}
        <div style={{ padding: '20px 16px 12px' }}>
          <h1 style={{ fontSize: '26px', fontWeight: 800, marginBottom: '4px' }}>Today's Specials</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            Hand-curated coastal delicacies prepared with traditional recipes.
          </p>
        </div>

        {/* Search */}
        <div style={{ padding: '0 16px 12px' }}>
          <input
            type="search"
            className="input"
            placeholder="🔍  Search dishes..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Category Filter */}
        <div style={{ padding: '0 16px 16px', display: 'flex', gap: '8px', overflowX: 'auto', scrollbarWidth: 'none' }}>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              style={{
                padding: '6px 16px',
                borderRadius: 'var(--radius-full)',
                border: '1.5px solid',
                borderColor: cat === category ? 'var(--primary)' : 'var(--border)',
                background: cat === category ? 'var(--primary)' : 'white',
                color: cat === category ? 'white' : 'var(--text-secondary)',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.2s',
              }}
            >{cat}</button>
          ))}
        </div>

        {/* Product Grid */}
        <div style={{ padding: '0 16px 140px' }}>
          {loading ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {[1,2,3,4].map(i => (
                <div key={i} style={{ height: '220px', background: '#F3F4F6', borderRadius: '12px', animation: 'pulse 1.5s infinite' }} />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-secondary)' }}>
              <div style={{ fontSize: '48px', marginBottom: '12px' }}>🍽️</div>
              <p style={{ fontWeight: 600 }}>No items found</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {filtered.map(product => (
                <ProductCard
                  key={product.id}
                  product={product}
                  quantity={cart.get(product.id)?.quantity || 0}
                  onUpdate={handleUpdate}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Cart Button */}
      {totalItems > 0 && (
        <Link href="/cart" className="cart-btn">
          <span style={{
            background: 'rgba(255,255,255,0.25)',
            width: '24px', height: '24px', borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '12px', fontWeight: 900,
          }}>{totalItems}</span>
          Review & Order →
          <span style={{ marginLeft: 'auto', opacity: 0.9 }}>{formatPrice(totalPrice)}</span>
        </Link>
      )}

      <BottomNav />
    </div>
  );
}
