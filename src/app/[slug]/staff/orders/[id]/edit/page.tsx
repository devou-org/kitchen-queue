'use client';
import { use, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Order, Product } from '@/types';
import { formatPrice } from '@/lib/format';
import { validatePhone } from '@/lib/validators';
import { orderService } from '@/app/services/orders.api';
import { productService } from '@/app/services/products.api';
import { Search } from 'lucide-react';

type EditableItem = {
  product_id: string;
  quantity: number;
};

export default function StaffEditOrderPage({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = use(params);
  const router = useRouter();

  const [order, setOrder] = useState<Order | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newProductId, setNewProductId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);

  const [form, setForm] = useState({
    customer_name: '',
    phone: '',
    notes: '',
    party_size: '1',
  });
  const [items, setItems] = useState<EditableItem[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [orderRes, productsRes] = await Promise.all([
          orderService.getOrderById(id),
          productService.getAllProductsAdmin(),
        ]);

        if (!orderRes.success || !orderRes.data) {
          toast.error(orderRes.error || 'Order not found');
          setLoading(false);
          return;
        }

        const loadedOrder: Order = orderRes.data;
        setOrder(loadedOrder);
        setForm({
          customer_name: loadedOrder.customer_name || '',
          phone: loadedOrder.phone || '',
          notes: loadedOrder.notes || '',
          party_size: String(loadedOrder.party_size || 1),
        });

        const initialItems = (loadedOrder.items || []).map((item) => ({
          product_id: item.product_id,
          quantity: item.quantity,
        }));
        setItems(initialItems);

        if (productsRes.success) {
          setProducts(productsRes.data || []);
        }
      } catch {
        toast.error('Failed to load order data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

  const productById = useMemo(() => {
    const map = new Map<string, Product>();
    for (const product of products) {
      map.set(product.id, product);
    }
    return map;
  }, [products]);

  const total = useMemo(() => {
    return items.reduce((sum, item) => {
      const product = productById.get(item.product_id);
      return sum + ((product?.price || 0) * item.quantity);
    }, 0);
  }, [items, productById]);

  const updateItemQuantity = (productId: string, delta: number) => {
    setItems((prev) => prev.map((item) =>
      item.product_id === productId
        ? { ...item, quantity: Math.max(1, Math.min(99, item.quantity + delta)) }
        : item
    ));
  };

  const removeItem = (productId: string) => {
    setItems((prev) => prev.filter((item) => item.product_id !== productId));
  };

  const addItem = () => {
    if (!newProductId) {
       toast.error('Please select a product first');
       return;
    }
    if (items.some((item) => item.product_id === newProductId)) {
      toast.error('Product already added');
      return;
    }
    setItems((prev) => [...prev, { product_id: newProductId, quantity: 1 }]);
    setNewProductId('');
    setSearchQuery('');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    const customerName = form.customer_name.trim();
    const phone = form.phone.trim();
    const partySize = Number(form.party_size);

    if (!customerName) {
      toast.error('Customer name is required');
      return;
    }

    const phoneValidation = validatePhone(phone);
    if (!phoneValidation.valid) {
      toast.error(phoneValidation.message || 'Invalid phone number');
      return;
    }

    if (!Number.isInteger(partySize) || partySize <= 0) {
      toast.error('Party size must be a positive whole number');
      return;
    }

    if (items.length === 0) {
      toast.error('Order must include at least one item');
      return;
    }

    const phoneToUse = phone || `+910000000000`;

    setSaving(true);
    try {
      const data = await orderService.updateOrder(id, {
        customer_name: customerName,
        phone: phoneToUse,
        notes: form.notes.trim(),
        party_size: partySize,
        items,
      });

      if (!data.success) {
        toast.error(data.error || 'Failed to update order');
        return;
      }

      toast.success('Order updated successfully');
      router.push(`/${slug}/staff/orders`);
    } catch {
      toast.error('Network error while updating order');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
        <div className="loader" style={{ width: 40, height: 40, borderWidth: 4 }} />
      </div>
    );
  }

  if (!order) {
    return (
      <div style={{ textAlign: 'center', padding: '60px' }}>
        <p>Order not found.</p>
        <Link prefetch={false} href={`/${slug}/staff/orders`} className="btn btn-primary" style={{ marginTop: '20px' }}>Back to Orders</Link>
      </div>
    );
  }

  return (
    <div className="animate-fade-in" style={{ position: 'relative', padding: '16px', maxWidth: '800px', margin: '0 auto', paddingBottom: '80px' }}>
      {/* Top Right Close Button */}
      <Link prefetch={false} href={`/${slug}/staff/orders`} 
        style={{ 
          position: 'absolute', 
          top: '16px', 
          right: '16px', 
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '36px',
          height: '36px',
          borderRadius: '50%',
          background: 'var(--card)',
          boxShadow: 'var(--shadow)',
          color: 'var(--text-secondary)',
          textDecoration: 'none',
          fontSize: '24px',
          fontWeight: 300,
          zIndex: 10
        }}
        title="Close and return to orders"
      >
        ×
      </Link>

      <div style={{ marginBottom: '24px', paddingTop: '8px' }}>
        <Link prefetch={false} href={`/${slug}/staff/orders`} style={{ color: 'var(--text-secondary)', fontSize: '14px', textDecoration: 'none', display: 'inline-block', marginBottom: '12px' }}>
          ← Back to Orders
        </Link>
        <h1 style={{ fontSize: '24px', fontWeight: 800 }}>
          Edit Order #{String(order.ticket_number).padStart(3, '0')}
        </h1>
      </div>

      <div className="card">
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ flex: 2, minWidth: '220px' }}>
              <label className="label">Customer Name *</label>
              <input
                type="text"
                className="input"
                value={form.customer_name}
                onChange={(e) => setForm((prev) => ({ ...prev, customer_name: e.target.value }))}
                required
              />
            </div>
            <div style={{ flex: 2, minWidth: '220px' }}>
              <label className="label">Phone *</label>
              <input
                type="text"
                className="input"
                value={form.phone}
                onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
                required
              />
            </div>
            <div style={{ width: '140px' }}>
              <label className="label">Party Size *</label>
              <input
                type="number"
                min={1}
                step={1}
                className="input"
                value={form.party_size}
                onChange={(e) => setForm((prev) => ({ ...prev, party_size: e.target.value }))}
                required
              />
            </div>
          </div>

          <div>
            <label className="label">Notes</label>
            <textarea
              className="input"
              rows={3}
              value={form.notes}
              onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
              placeholder="Kitchen notes, preferences, etc"
              style={{ resize: 'vertical', minHeight: '80px' }}
            />
          </div>

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '14px' }}>
            <p className="label" style={{ marginBottom: '8px' }}>Order Items *</p>

            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', alignItems: 'flex-start' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <div style={{ position: 'relative' }}>
                  <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                  <input 
                     type="text" 
                     className="input" 
                     placeholder="Search and select product..." 
                     value={searchQuery}
                     onChange={e => { 
                       setSearchQuery(e.target.value); 
                       setShowDropdown(true); 
                       setNewProductId(''); 
                     }}
                     onFocus={() => setShowDropdown(true)}
                     onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                     style={{ width: '100%', paddingLeft: '40px' }}
                  />
                </div>
                {showDropdown && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', maxHeight: '200px', overflowY: 'auto', zIndex: 50, marginTop: '4px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                    {products.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 ? (
                      <div style={{ padding: '12px', color: 'var(--text-secondary)', fontSize: '14px' }}>No products found.</div>
                    ) : (
                      products.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase())).map(product => (
                         <div 
                           key={product.id} 
                           style={{ padding: '10px 12px', cursor: 'pointer', borderBottom: '1px solid var(--border)', fontSize: '14px', background: newProductId === product.id ? '#f0fdf4' : 'transparent' }}
                           onMouseDown={(e) => {
                              e.preventDefault(); // Prevent blur from firing before mouse down
                              setNewProductId(product.id);
                              setSearchQuery(`${product.name}`);
                              setShowDropdown(false);
                           }}
                         >
                           <div style={{ fontWeight: 600, color: newProductId === product.id ? 'var(--success)' : 'inherit' }}>{product.name}</div>
                           <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{formatPrice(product.price)}</div>
                         </div>
                      ))
                    )}
                  </div>
                )}
              </div>
              <button type="button" className="btn btn-secondary" onClick={addItem} style={{ height: '42px' }}>Add Item</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {items.map((item) => {
                const product = productById.get(item.product_id);
                return (
                  <div
                    key={item.product_id}
                    style={{
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '12px 14px',
                      background: 'white',
                    }}
                  >
                    {/* Product name + price + remove */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '15px' }}>{product?.name || 'Unknown Product'}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                          {formatPrice(product?.price || 0)} each
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeItem(item.product_id)}
                        style={{
                          background: 'none', border: 'none',
                          fontSize: '18px', cursor: 'pointer',
                          color: '#EF4444', lineHeight: 1, padding: '2px 4px',
                          flexShrink: 0,
                        }}
                        title="Remove item"
                      >
                        ×
                      </button>
                    </div>

                    {/* Stepper + subtotal */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0' }}>
                        <button
                          type="button"
                          onClick={() => updateItemQuantity(item.product_id, -1)}
                          disabled={item.quantity <= 1}
                          style={{
                            width: '40px', height: '40px',
                            borderRadius: '10px 0 0 10px',
                            border: '1.5px solid var(--border)',
                            borderRight: 'none',
                            background: item.quantity <= 1 ? '#f9fafb' : 'white',
                            color: item.quantity <= 1 ? '#9CA3AF' : 'var(--primary)',
                            fontSize: '20px', fontWeight: 700,
                            cursor: item.quantity <= 1 ? 'not-allowed' : 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}
                        >
                          −
                        </button>
                        <span style={{
                          width: '48px', height: '40px',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          border: '1.5px solid var(--border)',
                          fontWeight: 800, fontSize: '16px',
                          color: 'var(--text-primary)',
                          background: '#fafafa',
                          userSelect: 'none',
                        }}>
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateItemQuantity(item.product_id, 1)}
                          disabled={item.quantity >= 99}
                          style={{
                            width: '40px', height: '40px',
                            borderRadius: '0 10px 10px 0',
                            border: '1.5px solid var(--border)',
                            borderLeft: 'none',
                            background: 'white',
                            color: 'var(--primary)',
                            fontSize: '20px', fontWeight: 700,
                            cursor: item.quantity >= 99 ? 'not-allowed' : 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}
                        >
                          +
                        </button>
                      </div>
                      <span style={{ fontWeight: 800, fontSize: '16px', color: 'var(--primary)' }}>
                        {formatPrice((product?.price || 0) * item.quantity)}
                      </span>
                    </div>
                  </div>
                );
              })}
              {items.length === 0 && (
                <p style={{ color: 'var(--text-secondary)', fontSize: '14px', padding: '8px 0' }}>No items selected yet.</p>
              )}
            </div>

            <div style={{ marginTop: '12px', textAlign: 'right', fontSize: '20px', fontWeight: 800 }}>
              Total: <span style={{ color: 'var(--primary)' }}>{formatPrice(total)}</span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving...' : 'Save Order Changes'}
            </button>
            <Link prefetch={false} href={`/${slug}/staff/orders`} className="btn btn-ghost">Cancel</Link>
          </div>
        </form>
      </div>
    </div>
  );
}
