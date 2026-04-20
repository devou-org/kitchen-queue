'use client';
import { use, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Order, Product } from '@/types';
import { formatPrice } from '@/lib/format';
import { validatePhone } from '@/lib/validators';

type EditableItem = {
  product_id: string;
  quantity: number;
};

export default function EditOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [order, setOrder] = useState<Order | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newProductId, setNewProductId] = useState('');

  const [form, setForm] = useState({
    customer_name: '',
    phone: '',
    notes: '',
    party_size: '1',
  });
  const [items, setItems] = useState<EditableItem[]>([]);
  const [quantityDrafts, setQuantityDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [orderRes, productsRes] = await Promise.all([
          fetch(`/api/orders/${id}`),
          fetch('/api/products'),
        ]);

        const orderData = await orderRes.json();
        const productsData = await productsRes.json();

        if (!orderData.success) {
          toast.error(orderData.error || 'Order not found');
          setLoading(false);
          return;
        }

        const loadedOrder: Order = orderData.data;
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
        setQuantityDrafts(
          initialItems.reduce<Record<string, string>>((acc, item) => {
            acc[item.product_id] = String(item.quantity);
            return acc;
          }, {})
        );

        if (productsData.success) {
          setProducts(productsData.data || []);
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

  const getEffectiveQuantity = (item: EditableItem) => {
    const draft = quantityDrafts[item.product_id];
    if (draft === undefined || draft.trim() === '') return item.quantity;
    const parsed = Number.parseInt(draft, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) return item.quantity;
    return parsed;
  };

  const total = useMemo(() => {
    return items.reduce((sum, item) => {
      const product = productById.get(item.product_id);
      return sum + ((product?.price || 0) * getEffectiveQuantity(item));
    }, 0);
  }, [items, productById, quantityDrafts]);

  const updateItemQuantity = (productId: string, quantity: number) => {
    if (!Number.isInteger(quantity)) return;
    const safeQuantity = Math.max(1, quantity);
    setItems((prev) => prev.map((item) => (
      item.product_id === productId ? { ...item, quantity: safeQuantity } : item
    )));
    setQuantityDrafts((prev) => ({ ...prev, [productId]: String(safeQuantity) }));
  };

  const commitItemQuantityDraft = (productId: string) => {
    const draft = quantityDrafts[productId];
    const parsed = Number.parseInt((draft || '').trim(), 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      updateItemQuantity(productId, 1);
      return;
    }
    updateItemQuantity(productId, parsed);
  };

  const removeItem = (productId: string) => {
    setItems((prev) => prev.filter((item) => item.product_id !== productId));
    setQuantityDrafts((prev) => {
      const next = { ...prev };
      delete next[productId];
      return next;
    });
  };

  const addItem = () => {
    if (!newProductId) return;
    if (items.some((item) => item.product_id === newProductId)) {
      toast.error('Product already added');
      return;
    }
    setItems((prev) => [...prev, { product_id: newProductId, quantity: 1 }]);
    setQuantityDrafts((prev) => ({ ...prev, [newProductId]: '1' }));
    setNewProductId('');
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

    const itemsToSave = items.map((item) => ({
      product_id: item.product_id,
      quantity: getEffectiveQuantity(item),
    }));

    setSaving(true);
    try {
      const res = await fetch(`/api/orders/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name: customerName,
          phone,
          notes: form.notes.trim(),
          party_size: partySize,
          items: itemsToSave,
        }),
      });
      const data = await res.json();

      if (!data.success) {
        toast.error(data.error || 'Failed to update order');
        return;
      }

      toast.success('Order updated successfully');
      router.push('/admin/orders');
    } catch {
      toast.error('Network error while updating order');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="page-content-admin" style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
        <div className="loader" style={{ width: 40, height: 40, borderWidth: 4 }} />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="page-content-admin">
        <div style={{ textAlign: 'center', padding: '60px' }}>
          <p>Order not found.</p>
          <Link href="/admin/orders" className="btn btn-primary" style={{ marginTop: '20px' }}>Back to Orders</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page-content-admin animate-fade-in">
      <div style={{ marginBottom: '24px' }}>
        <Link href="/admin/orders" style={{ color: 'var(--text-secondary)', fontSize: '14px', textDecoration: 'none' }}>
          ← Back to Orders
        </Link>
        <h1 style={{ fontSize: '28px', fontWeight: 800, marginTop: '8px' }}>
          Edit Order #{String(order.ticket_number).padStart(3, '0')}
        </h1>
      </div>

      <div className="card" style={{ maxWidth: '760px' }}>
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

            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
              <select
                className="input"
                value={newProductId}
                onChange={(e) => setNewProductId(e.target.value)}
                style={{ flex: 1 }}
              >
                <option value="">Select product to add</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name} ({formatPrice(product.price)})
                  </option>
                ))}
              </select>
              <button type="button" className="btn btn-secondary" onClick={addItem}>Add Item</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {items.map((item) => {
                const product = productById.get(item.product_id);
                const effectiveQty = getEffectiveQuantity(item);
                return (
                  <div
                    key={item.product_id}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '10px 12px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                      <div>
                        <div style={{ fontWeight: 600 }}>{product?.name || 'Unknown Product'}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                          {formatPrice(product?.price || 0)} each
                        </div>
                      </div>
                      <div style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
                        {formatPrice((product?.price || 0) * effectiveQty)}
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => updateItemQuantity(item.product_id, effectiveQty - 1)}
                          style={{ minWidth: '32px', width: '32px', height: '32px', padding: 0, borderRadius: '999px', border: '1px solid var(--border)' }}
                          aria-label="Decrease quantity"
                        >
                          −
                        </button>
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          className="input"
                          value={quantityDrafts[item.product_id] ?? String(item.quantity)}
                          onChange={(e) => {
                            const raw = e.target.value;
                            if (!/^\d*$/.test(raw)) return;
                            setQuantityDrafts((prev) => ({ ...prev, [item.product_id]: raw }));
                          }}
                          onBlur={() => commitItemQuantityDraft(item.product_id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              commitItemQuantityDraft(item.product_id);
                            }
                          }}
                          style={{ width: '64px', textAlign: 'center' }}
                        />
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => updateItemQuantity(item.product_id, effectiveQty + 1)}
                          style={{ minWidth: '32px', width: '32px', height: '32px', padding: 0, borderRadius: '999px', border: '1px solid var(--border)' }}
                          aria-label="Increase quantity"
                        >
                          +
                        </button>
                      </div>

                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => removeItem(item.product_id)}
                        style={{ color: 'var(--text-secondary)', minWidth: 'auto', padding: '4px 6px' }}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                );
              })}
              {items.length === 0 && (
                <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>No items selected yet.</p>
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
            <Link href="/admin/orders" className="btn btn-ghost">Cancel</Link>
          </div>
        </form>
      </div>
    </div>
  );
}
