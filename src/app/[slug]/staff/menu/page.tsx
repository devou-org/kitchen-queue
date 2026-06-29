'use client';
import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { formatPrice } from '@/lib/format';
import { Product, CartItem, ProductStatus } from '@/types';
import { pusherClient } from '@/lib/pusher-client';
import { productService } from '@/app/services/products.api';
import { orderService } from '@/app/services/orders.api';
import { useRestaurant } from '@/hooks/useRestaurant';

const STATUS_BADGE: Record<ProductStatus, { label: string; class: string }> = {
  AVAILABLE: { label: 'AVAILABLE', class: 'badge badge-available' },
  LOW_STOCK: { label: 'LOW STOCK', class: 'badge badge-low-stock' },
  OUT_OF_STOCK: { label: 'OUT OF STOCK', class: 'badge badge-out-of-stock' },
};

const STATUS_ORDER: Record<ProductStatus, number> = {
  AVAILABLE: 1,
  LOW_STOCK: 2,
  OUT_OF_STOCK: 3,
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
      cursor: 'pointer'
    }} onClick={() => { if (!isOut) onUpdate(product.id, 1) }}>
      {/* Image */}
      <div style={{
        position: 'relative',
        height: '120px',
        background: 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '14px 8px 6px 8px',
      }}>
        <img
          src={product.image_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop'}
          alt={product.name}
          style={{
            maxWidth: '100%',
            maxHeight: '100%',
            objectFit: 'contain',
            objectPosition: 'center',
            display: 'block',
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
        <h3 style={{ fontWeight: 700, fontSize: '14px', marginBottom: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{product.name}</h3>
        <p style={{ color: 'var(--primary)', fontWeight: 700, fontSize: '14px', marginBottom: '10px' }}>
          {formatPrice(product.price)}
        </p>

        {/* Quantity Controls */}
        {quantity > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }} onClick={e => e.stopPropagation()}>
            <button
              className="qty-btn"
              onClick={() => onUpdate(product.id, -1)}
            >−</button>
            <span style={{
              flex: 1, textAlign: 'center', fontWeight: 700, fontSize: '14px',
              color: 'var(--primary)'
            }}>{quantity}</span>
            <button
              className="qty-btn"
              onClick={() => onUpdate(product.id, 1)}
              disabled={isOut}
            >+</button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function StaffMenuPage() {
  const { restaurant } = useRestaurant();
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<Map<string, CartItem>>(new Map());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [categories, setCategories] = useState<string[]>(['All']);

  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [orderForm, setOrderForm] = useState({
    customer_name: '',
    phone: '',
    table_number: '',
    party_size: 1,
    notes: ''
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const initPage = async () => {
      try {
        const res = await productService.getProducts();
        if (res.success && res.data) {
          const parsedData = res.data.map(p => ({
            ...p,
            price: Number(p.price),
            stock_quantity: Number(p.stock_quantity),
            buffer_quantity: Number(p.buffer_quantity)
          }));
          setProducts(parsedData);
          const uniqueCats = Array.from(new Set(
            parsedData
              .map((p: Product) => p.category?.trim())
              .filter((cat: string) => cat && cat !== 'All')
          ));
          setCategories(['All', ...uniqueCats]);
        }
      } catch {
        toast.error('Failed to load menu');
      } finally {
        setLoading(false);
      }
    };
    initPage();
  }, []);

  // Pusher for real-time updates
  useEffect(() => {
    if (!pusherClient || !restaurant?.pusher_channel) return;
    const channelName = restaurant.pusher_channel;
    const channel = pusherClient.subscribe(channelName);

    channel.bind('product_updated', (updatedProduct: Product) => {
      const parsedProduct = {
        ...updatedProduct,
        price: Number(updatedProduct.price),
        stock_quantity: Number(updatedProduct.stock_quantity),
        buffer_quantity: Number(updatedProduct.buffer_quantity)
      };
      setProducts(prev => {
        const exists = prev.find(p => p.id === parsedProduct.id);
        if (exists) {
          return prev.map(p => p.id === parsedProduct.id ? { ...p, ...parsedProduct } : p);
        }
        return [...prev, parsedProduct];
      });
    });

    channel.bind('product_deleted', (data: { id: string }) => {
      setProducts(prev => prev.filter(p => p.id !== data.id));
    });

    return () => {
      channel.unbind('product_updated');
      channel.unbind('product_deleted');
      pusherClient?.unsubscribe(channelName);
    };
  }, [restaurant?.pusher_channel]);

  // Keep cart aligned with latest product availability and details
  useEffect(() => {
    if (products.length === 0 || cart.size === 0) return;

    const byId = new Map(products.map((p) => [p.id, p]));
    const newCart = new Map(cart);
    const removedNames: string[] = [];
    let changed = false;

    for (const [id, item] of cart.entries()) {
      const product = byId.get(id);

      if (!product || product.status === 'OUT_OF_STOCK') {
        newCart.delete(id);
        removedNames.push(item.name);
        changed = true;
        continue;
      }

      if (
        item.status !== product.status ||
        item.price !== product.price ||
        item.name !== product.name ||
        item.image_url !== product.image_url
      ) {
        newCart.set(id, {
          ...item,
          status: product.status,
          price: product.price,
          name: product.name,
          image_url: product.image_url,
        });
        changed = true;
      }
    }

    if (changed) {
      setCart(newCart);
    }

    if (removedNames.length > 0) {
      toast.error(`${removedNames.join(', ')} removed from cart (out of stock/deleted)`);
    }
  }, [products, cart]);

  const handleUpdate = (id: string, delta: number) => {
    const product = products.find(p => p.id === id);
    if (!product) return;

    if (delta > 0 && product.status === 'OUT_OF_STOCK') {
      toast.error('This item is out of stock');
      return;
    }

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
        quantity: Math.min(newQty, 50), // allow staff to order more
        image_url: product.image_url,
        status: product.status,
      });
    }
    setCart(newCart);
  };

  const submitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.size === 0) return toast.error('Cart is empty');
    if (!orderForm.customer_name && !orderForm.table_number) {
      return toast.error('Please provide a Customer Name or Table Number');
    }

    setSubmitting(true);
    try {
      const items = Array.from(cart.values()).map(item => ({
        product_id: item.product_id,
        quantity: item.quantity,
        price_at_purchase: item.price
      }));

      // Generate a mock phone if not provided for staff orders
      const phoneToUse = orderForm.phone || `+910000000000`;
      const nameToUse = orderForm.customer_name || `Table ${orderForm.table_number}`;

      const res = await orderService.createOrder({
        customer_name: nameToUse,
        phone: phoneToUse,
        items,
        party_size: orderForm.party_size,
        notes: orderForm.notes
      });

      if (res.success && res.data) {
        toast.success(`Order placed successfully! Ticket #${res.data.ticket_number}`);
        setCart(new Map());
        setCheckoutOpen(false);
        setOrderForm({ customer_name: '', phone: '', table_number: '', party_size: 1, notes: '' });
      } else {
        toast.error(res.error || 'Failed to place order');
      }
    } catch (err) {
      toast.error('Network error');
    } finally {
      setSubmitting(false);
    }
  };

  const totalItems = Array.from(cart.values()).reduce((s, i) => s + i.quantity, 0);
  const totalPrice = Array.from(cart.values()).reduce((s, i) => s + i.price * i.quantity, 0);

  const filtered = products
    .filter(p => {
      const matchCat = category === 'All' || p.category === category;
      const matchSearch = p.name.toLowerCase().includes(search.toLowerCase());
      return matchCat && matchSearch;
    })
    .sort((a, b) => {
      const statusDiff = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
      if (statusDiff !== 0) return statusDiff;
      return a.name.localeCompare(b.name);
    });

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '16px' }}>
      <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
        <input
          type="search"
          className="input"
          placeholder="Search products..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ flex: 1 }}
        />
      </div>

      {/* Categories */}
      <div style={{ paddingBottom: '16px', display: 'flex', gap: '8px', overflowX: 'auto', scrollbarWidth: 'none' }}>
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
              fontSize: '13px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap'
            }}
          >{cat}</button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '12px' }}>
        {filtered.map(product => (
          <ProductCard
            key={product.id}
            product={product}
            quantity={cart.get(product.id)?.quantity || 0}
            onUpdate={handleUpdate}
          />
        ))}
      </div>

      {totalItems > 0 && (
        <div style={{ position: 'fixed', bottom: '80px', left: 0, right: 0, padding: '0 16px', zIndex: 40, display: 'flex', justifyContent: 'center' }}>
          <button
            className="btn btn-primary"
            onClick={() => setCheckoutOpen(true)}
            style={{ width: '100%', maxWidth: '400px', borderRadius: '999px', height: '48px', fontSize: '15px', fontWeight: 700, display: 'flex', justifyContent: 'space-between', padding: '0 20px', boxShadow: '0 8px 20px rgba(0,0,0,0.2)' }}
          >
            <span>{totalItems} items</span>
            <span>Checkout {formatPrice(totalPrice)}</span>
          </button>
        </div>
      )}

      {checkoutOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          <div style={{ background: 'var(--bg)', borderTopLeftRadius: '24px', borderTopRightRadius: '24px', padding: '24px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 800 }}>Complete Order</h2>
              <button onClick={() => setCheckoutOpen(false)} style={{ background: 'none', border: 'none', fontSize: '24px', color: 'var(--text-secondary)' }}>&times;</button>
            </div>

            <div style={{ marginBottom: '24px' }}>
              {Array.from(cart.values()).map(item => (
                <div key={item.product_id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px' }}>
                  <span>{item.quantity}x {item.name}</span>
                  <span style={{ fontWeight: 600 }}>{formatPrice(item.price * item.quantity)}</span>
                </div>
              ))}
              <div style={{ borderTop: '1px dashed var(--border)', margin: '12px 0', paddingTop: '12px', display: 'flex', justifyContent: 'space-between', fontWeight: 800 }}>
                <span>Total</span>
                <span style={{ color: 'var(--primary)' }}>{formatPrice(totalPrice)}</span>
              </div>
            </div>

            <form onSubmit={submitOrder} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <label className="label">Table Number *</label>
                  <input type="text" className="input" placeholder="e.g. 12" value={orderForm.table_number} onChange={e => setOrderForm({ ...orderForm, table_number: e.target.value })} />
                </div>
                <div style={{ width: '100px' }}>
                  <label className="label">Persons</label>
                  <select
                    className="input"
                    value={orderForm.party_size}
                    onChange={e => setOrderForm({ ...orderForm, party_size: parseInt(e.target.value) || 1 })}
                    style={{ paddingRight: '30px' }}
                  >
                    {[...Array(10)].map((_, i) => (
                      <option key={i + 1} value={i + 1}>{i + 1} {i === 0 ? 'Person' : 'Persons'}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="label">Customer Name (Optional)</label>
                <input type="text" className="input" placeholder="Name" value={orderForm.customer_name} onChange={e => setOrderForm({ ...orderForm, customer_name: e.target.value })} />
              </div>

              <div>
                <label className="label">Customer Phone (Optional)</label>
                <input type="text" className="input" placeholder="99xxxxxxxx" value={orderForm.phone} onChange={e => setOrderForm({ ...orderForm, phone: e.target.value })} />
              </div>

              <div>
                <label className="label">Notes</label>
                <input type="text" className="input" placeholder="Less spicy, extra napkins..." value={orderForm.notes} onChange={e => setOrderForm({ ...orderForm, notes: e.target.value })} />
              </div>

              <button type="submit" className="btn btn-primary btn-lg" style={{ marginTop: '8px' }} disabled={submitting}>
                {submitting ? 'Placing Order...' : 'Place Order Now'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
