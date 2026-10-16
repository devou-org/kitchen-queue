'use client';
import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { formatPrice } from '@/lib/format';
import { Product, CartItem, ProductStatus } from '@/types';
import { pusherClient } from '@/lib/pusher-client';
import { productService } from '@/app/services/products.api';
import { orderService } from '@/app/services/orders.api';
import { tableService } from '@/app/services/tables.api';
import { useRestaurant } from '@/hooks/useRestaurant';
import { useParams } from 'next/navigation';
import { Search, Banknote, CreditCard, QrCode, Check, Printer, Split } from 'lucide-react';
import OrderTypeSelector from '@/components/modules/orders/OrderTypeSelector';
import { OrderType } from '@/types';
import { DietaryFilter, DietaryPreferenceFilter } from '@/components/ui/DietaryFilter';
import { PrinterIllustration } from '@/components/ui/PrinterIllustration';
import { checkTableAssignment } from '@/lib/table-capacity';
import { printUnifiedThermalTicket, tryAutoConnectBluetooth } from '@/lib/hardware-printer';
import { printKotFromBrowser } from '@/lib/client-print';
import { sortCategoriesByConfig } from '@/lib/category-order';
import SplitPaymentBreakdown, { SplitAmounts, formatSplitSummary, parseSplitFromSummary } from '@/components/modules/orders/SplitPaymentBreakdown';

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
  const params = useParams();
  const slug = (params?.slug as string) || restaurant?.slug || '';

  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<Map<string, CartItem>>(new Map());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [categories, setCategories] = useState<string[]>(['All']);
  const [dietaryFilter, setDietaryFilter] = useState<DietaryPreferenceFilter>('ALL');

  useEffect(() => {
    tryAutoConnectBluetooth();
  }, []);

  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [tables, setTables] = useState<any[]>([]);
  const [orderForm, setOrderForm] = useState<{
    customer_name: string;
    phone: string;
    table_number: string;
    party_size: number;
    notes: string;
    order_type: OrderType | string;
    is_paid?: boolean;
    payment_method?: string;
    payment_split?: any;
  }>({
    customer_name: '',
    phone: '',
    table_number: '',
    party_size: 1,
    notes: '',
    order_type: 'DINE_IN',
    is_paid: false,
    payment_method: 'UPI',
    payment_split: null,
  });
  const [menuSplit, setMenuSplit] = useState<SplitAmounts>({ CASH: 0, UPI: 0, CARD: 0 });
  const [submitting, setSubmitting] = useState(false);

  const fetchTables = useCallback(async () => {
    try {
      const tablesRes = await tableService.getTables();
      if (tablesRes.success && tablesRes.data) {
        setTables(tablesRes.data);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    const initPage = async () => {
      try {
        const [res, catRes] = await Promise.all([
          productService.getProducts(),
          fetch('/api/categories', {
            headers: { 'x-restaurant-slug': slug as string },
            cache: 'no-store'
          }).then(r => r.json()).catch(() => ({ success: false, data: [] }))
        ]);

        if (res.success && res.data) {
          const parsedData = res.data.map(p => ({
            ...p,
            price: Number(p.price),
            stock_quantity: Number(p.stock_quantity),
            buffer_quantity: Number(p.buffer_quantity)
          }));
          setProducts(parsedData);

          const configured = (catRes.success && Array.isArray(catRes.data)) ? catRes.data : [];
          const productCats = parsedData.map((p: Product) => p.category?.trim()).filter(Boolean);
          const sortedCats = sortCategoriesByConfig(productCats, configured);

          setCategories(['All', ...sortedCats]);
        }

        await fetchTables();
      } catch {
        toast.error('Failed to load menu');
      } finally {
        setLoading(false);
      }
    };
    initPage();
  }, [fetchTables, slug]);

  // Pusher for real-time updates
  useEffect(() => {
    if (!pusherClient || !restaurant) return;
    const channelName = restaurant.pusher_channel || `queue-channel-${restaurant.id}`;
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

    channel.bind('new_order', () => {
      fetchTables();
    });

    channel.bind('order_update', () => {
      fetchTables();
    });

    const handleKotAutoPrint = async (data: any) => {
      const autoPrint = typeof window !== 'undefined' ? (localStorage.getItem('qdine_auto_print_kot') === 'true') : false;
      if (!autoPrint) return;

      const dedicatedStation = typeof window !== 'undefined' ? (localStorage.getItem('qdine_dedicated_kds_station') || '') : '';
      if (dedicatedStation && dedicatedStation !== '' && dedicatedStation.toLowerCase() !== (data.counter_name || '').toLowerCase()) {
        return;
      }

      toast(`Auto-printing KOT #${String(data.ticket_number).padStart(3, '0')} (${data.counter_name})...`, {
        icon: <PrinterIllustration size={22} status="printing" />,
        duration: 3000,
      });

      try {
        const result = await printUnifiedThermalTicket({
          base64Bytes: data.base64Bytes,
          kotData: data.kotData,
          printerName: data.printer_name,
          counterId: data.counter_id,
          counterName: data.counter_name,
          isAutoPrint: true,
        });
        const label = data.is_add_on ? `Add-on KOT (${data.counter_name || 'Counter'})` : (data.counter_name || 'KOT');
        if (result.success) {
          toast.success(`Auto-printed: ${label} #${String(data.ticket_number).padStart(3, '0')} (${result.method})`, {
            icon: <PrinterIllustration size={22} status="success" />,
            id: data.is_add_on ? `kot-auto-${data.ticket_number}-${data.counter_name}-${Date.now()}` : `kot-auto-${data.ticket_number}-${data.counter_name}`,
          });
        }
      } catch (err: any) {
        console.error('Auto-print execution error on staff menu:', err);
      }
    };

    channel.bind('kot_auto_print', handleKotAutoPrint);

    return () => {
      channel.unbind('product_updated');
      channel.unbind('product_deleted');
      channel.unbind('new_order');
      channel.unbind('order_update');
      channel.unbind('kot_auto_print', handleKotAutoPrint);
      pusherClient?.unsubscribe(channelName);
    };
  }, [restaurant, fetchTables]);

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

    const currentStock = typeof product.stock_quantity === 'number' ? product.stock_quantity : null;

    if (delta > 0 && (product.status === 'OUT_OF_STOCK' || (currentStock !== null && currentStock <= 0))) {
      toast.error(`"${product.name}" is out of stock (0 available)`);
      return;
    }

    const newCart = new Map(cart);
    const existing = newCart.get(id);
    const newQty = (existing?.quantity || 0) + delta;

    if (delta > 0 && currentStock !== null && newQty > currentStock) {
      toast.error(`"${product.name}" only has ${currentStock} available`);
      return;
    }

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
    const isTakeaway = orderForm.order_type === 'TAKEAWAY';
    if (!isTakeaway && !orderForm.customer_name && !orderForm.table_number) {
      return toast.error('Please provide a Customer Name or Table Number');
    }

    // Pre-validate cart items against current product stock
    const stockErrors: string[] = [];
    for (const [productId, cartItem] of cart.entries()) {
      const prod = products.find(p => p.id === productId);
      if (prod) {
        const avail = typeof prod.stock_quantity === 'number' ? prod.stock_quantity : null;
        if (prod.status === 'OUT_OF_STOCK' || (avail !== null && avail <= 0)) {
          stockErrors.push(`"${prod.name}" is out of stock (0 available)`);
        } else if (avail !== null && cartItem.quantity > avail) {
          stockErrors.push(`"${prod.name}" only has ${avail} available (${cartItem.quantity} selected)`);
        }
      }
    }
    if (stockErrors.length > 0) {
      toast.error(stockErrors.join(' • '));
      return;
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
      const nameToUse = orderForm.customer_name || (isTakeaway ? 'Takeaway Customer' : `Table ${orderForm.table_number}`);

      const res = await orderService.createOrder({
        customer_name: nameToUse,
        phone: phoneToUse,
        table_number: isTakeaway ? undefined : (orderForm.table_number || undefined),
        items,
        party_size: isTakeaway ? 0 : orderForm.party_size,
        notes: orderForm.notes,
        order_type: orderForm.order_type,
        is_pos: true,
        is_paid: Boolean(orderForm.is_paid),
        payment_method: orderForm.is_paid ? (orderForm.payment_method || 'UPI') : undefined,
        payment_split: orderForm.is_paid ? orderForm.payment_split : undefined,
      });

      if (res.success && res.data) {
        const createdOrder = res.data;
        toast.success(`Order placed successfully! Ticket #${createdOrder.ticket_number}`);
        setCart(new Map());
        setCheckoutOpen(false);
        setOrderForm({ customer_name: '', phone: '', table_number: '', party_size: 1, notes: '', order_type: 'DINE_IN', is_paid: false, payment_method: 'UPI', payment_split: null });
        setMenuSplit({ CASH: 0, UPI: 0, CARD: 0 });
        await fetchTables();
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
  let subtotal = Array.from(cart.values()).reduce((s, i) => s + i.price * i.quantity, 0);
  
  let gstAmount = 0;
  let totalPrice = subtotal;
  if (restaurant?.gst_type === 'REGULAR') {
    const rate = Number(restaurant.gst_rate) || 0;
    gstAmount = Math.round((subtotal * rate / 100) * 100) / 100;
    totalPrice = subtotal + gstAmount;
  }

  const filtered = products
    .filter(p => {
      const matchCat = category === 'All' || p.category === category;
      const matchSearch = p.name.toLowerCase().includes(search.toLowerCase());
      const pref = p.dietary_preference || 'NON_VEG';
      const matchDietary = dietaryFilter === 'ALL' || (dietaryFilter === 'VEG' ? pref === 'VEG' : pref === 'NON_VEG');
      return matchCat && matchSearch && matchDietary;
    })
    .sort((a, b) => {
      const statusDiff = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
      if (statusDiff !== 0) return statusDiff;
      return a.name.localeCompare(b.name);
    });

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '16px' }}>
      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
          <Search size={18} color="var(--text-secondary)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
          <input
            type="search"
            className="input"
            placeholder="Search item name..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: '100%', paddingLeft: '40px' }}
          />
        </div>
        <DietaryFilter value={dietaryFilter} onChange={setDietaryFilter} />
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
            style={{ width: '100%', maxWidth: '400px', borderRadius: '8px', height: '48px', fontSize: '15px', fontWeight: 700, display: 'flex', justifyContent: 'space-between', padding: '0 20px', boxShadow: '0 8px 20px rgba(0,0,0,0.2)' }}
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
              <div style={{ borderTop: '1px dashed var(--border)', margin: '12px 0', paddingTop: '12px' }}>
                {gstAmount > 0 ? (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                      <span>Subtotal</span>
                      <span>{formatPrice(subtotal)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                      <span>GST ({restaurant?.gst_rate || 0}%)</span>
                      <span>{formatPrice(gstAmount)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '18px', paddingTop: '4px' }}>
                      <span>Total</span>
                      <span style={{ color: 'var(--primary)' }}>{formatPrice(totalPrice)}</span>
                    </div>
                  </>
                ) : (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '18px' }}>
                    <span>Total</span>
                    <span style={{ color: 'var(--primary)' }}>{formatPrice(totalPrice)}</span>
                  </div>
                )}
              </div>
            </div>

            <form onSubmit={submitOrder} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <OrderTypeSelector
                value={(orderForm.order_type as OrderType) || 'DINE_IN'}
                onChange={(val) => {
                  const isTakeaway = val === 'TAKEAWAY';
                  setOrderForm((prev) => ({
                    ...prev,
                    order_type: val,
                    is_paid: isTakeaway ? true : false,
                    payment_method: isTakeaway ? (prev.payment_method || 'CASH') : prev.payment_method,
                  }));
                }}
              />

              {orderForm.order_type !== 'TAKEAWAY' && (
                <div style={{ display: 'flex', gap: '12px' }}>
                  <div style={{ flex: 1 }}>
                    <label className="label">Table Number *</label>
                    {tables.length > 0 ? (
                      <select
                        className="input"
                        value={orderForm.table_number}
                        onChange={e => {
                          const selectedNum = e.target.value;
                          const matchedTable = tables.find((t: any) => String(t.table_number) === String(selectedNum));
                          const check = matchedTable ? checkTableAssignment(matchedTable, 1, {
                            phone: orderForm.phone,
                            customerName: orderForm.customer_name,
                          }) : null;
                          const maxFree = matchedTable ? Math.max(1, (Number(matchedTable.capacity) || 1) - (check?.occupiedSeats || 0)) : 1;
                          setOrderForm({
                            ...orderForm,
                            table_number: selectedNum,
                            party_size: maxFree
                          });
                        }}
                      >
                        <option value="">-- Select Table --</option>
                        {tables
                          .filter((t: any) => {
                            const check = checkTableAssignment(t, 1, {
                              phone: orderForm.phone,
                              customerName: orderForm.customer_name,
                            });
                            const isCurrent = t.table_number === orderForm.table_number;
                            return check.allowed || isCurrent;
                          })
                          .map((t: any) => {
                            const check = checkTableAssignment(t, 1, {
                              phone: orderForm.phone,
                              customerName: orderForm.customer_name,
                            });
                            const cap = Number(t.capacity) || 0;
                            const seated = check.occupiedSeats;

                            const rawNum = String(t.table_number || '').trim();
                            let tableLabel = rawNum;
                            if (/^\d+$/.test(rawNum)) {
                              tableLabel = `T${rawNum}`;
                            } else if (rawNum.toLowerCase().startsWith('t-')) {
                              tableLabel = `T-${rawNum.slice(2)}`;
                            } else if (rawNum.toLowerCase().startsWith('t') && !rawNum.toLowerCase().startsWith('table')) {
                              tableLabel = `T${rawNum.slice(1)}`;
                            } else if (rawNum.toLowerCase().startsWith('table #')) {
                              const c = rawNum.slice(7).trim();
                              tableLabel = /^\d+$/.test(c) ? `T${c}` : c;
                            } else if (rawNum.toLowerCase().startsWith('table ')) {
                              const c = rawNum.slice(6).trim();
                              tableLabel = /^\d+$/.test(c) ? `T${c}` : c;
                            }

                            const freeSeats = Math.max(0, cap - seated);

                            return (
                              <option key={t.id} value={t.table_number}>
                                {tableLabel} · {seated}/{cap} · {freeSeats} Free
                              </option>
                            );
                          })}
                      </select>
                    ) : (
                      <input
                        type="text"
                        className="input"
                        placeholder="e.g. 12"
                        value={orderForm.table_number}
                        onChange={e => setOrderForm({ ...orderForm, table_number: e.target.value })}
                      />
                    )}
                  </div>
                  <div style={{ width: '100px' }}>
                    <label className="label">Persons</label>
                    <select
                      className="input"
                      value={orderForm.party_size}
                      onChange={e => setOrderForm({ ...orderForm, party_size: parseInt(e.target.value) || 1 })}
                      style={{ paddingRight: '30px' }}
                    >
                      {(() => {
                        const currentTable = tables.find((t: any) => String(t.table_number) === String(orderForm.table_number));
                        const check = currentTable ? checkTableAssignment(currentTable, 1, {
                          phone: orderForm.phone,
                          customerName: orderForm.customer_name,
                        }) : null;
                        const maxCount = currentTable ? Math.max(1, (Number(currentTable.capacity) || 1) - (check?.occupiedSeats || 0)) : 10;
                        return [...Array(maxCount)].map((_, i) => (
                          <option key={i + 1} value={i + 1}>{i + 1} {i === 0 ? 'Person' : 'Persons'}</option>
                        ));
                      })()}
                    </select>
                  </div>
                </div>
              )}

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

              {/* Payment Selection */}
              <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '12px 14px', marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>PAYMENT</span>
                  {orderForm.is_paid ? (
                    <span style={{ fontSize: '10.5px', fontWeight: 700, color: '#15803D', background: '#DCFCE7', padding: '2px 7px', borderRadius: '4px' }}>Pay Now</span>
                  ) : (
                    <span style={{ fontSize: '10.5px', fontWeight: 700, color: '#64748B', background: '#F1F5F9', padding: '2px 7px', borderRadius: '4px' }}>Pay Later (Unpaid)</span>
                  )}
                </div>

                {/* Pay Later / Pay Now Radios */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '28px', padding: '2px 0' }}>
                  <label
                    onClick={() => setOrderForm({ ...orderForm, is_paid: false })}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer', userSelect: 'none', fontSize: '13.5px', fontWeight: !orderForm.is_paid ? 700 : 500, color: !orderForm.is_paid ? '#0F172A' : '#64748B' }}
                  >
                    <div style={{ width: '16px', height: '16px', borderRadius: '50%', border: !orderForm.is_paid ? '2px solid var(--primary, #059669)' : '2px solid #CBD5E1', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FFFFFF', flexShrink: 0 }}>
                      {!orderForm.is_paid && <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--primary, #059669)' }} />}
                    </div>
                    <span>Pay Later</span>
                  </label>

                  <label
                    onClick={() => setOrderForm({ ...orderForm, is_paid: true, payment_method: orderForm.payment_method || 'UPI' })}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer', userSelect: 'none', fontSize: '13.5px', fontWeight: orderForm.is_paid ? 700 : 500, color: orderForm.is_paid ? '#0F172A' : '#64748B' }}
                  >
                    <div style={{ width: '16px', height: '16px', borderRadius: '50%', border: orderForm.is_paid ? '2px solid var(--primary, #059669)' : '2px solid #CBD5E1', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FFFFFF', flexShrink: 0 }}>
                      {orderForm.is_paid && <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--primary, #059669)' }} />}
                    </div>
                    <span>Pay Now</span>
                  </label>
                </div>

                {/* Payment Method Sub-selection */}
                {orderForm.is_paid ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingTop: '8px', borderTop: '1px solid #F1F5F9' }}>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', letterSpacing: '0.02em' }}>Payment Method</label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                      {[
                        { id: 'CASH', label: 'Cash', icon: Banknote },
                        { id: 'UPI', label: 'UPI / QR', icon: QrCode },
                        { id: 'CARD', label: 'Card', icon: CreditCard },
                        { id: 'SPLIT', label: 'Split', icon: Split },
                      ].map((m) => {
                        const Icon = m.icon;
                        const selected = m.id === 'SPLIT'
                          ? (orderForm.payment_method === 'SPLIT' || orderForm.payment_method?.toUpperCase().startsWith('SPLIT'))
                          : (orderForm.payment_method || 'UPI') === m.id;
                        return (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => {
                              if (m.id === 'SPLIT') {
                                if (menuSplit.CASH === 0 && menuSplit.UPI === 0 && menuSplit.CARD === 0) {
                                  const half = Math.round((totalPrice / 2) * 100) / 100;
                                  const other = Math.round((totalPrice - half) * 100) / 100;
                                  const init = { CASH: half, UPI: other, CARD: 0 };
                                  setMenuSplit(init);
                                  setOrderForm({ ...orderForm, payment_method: formatSplitSummary(init), payment_split: init });
                                } else {
                                  setOrderForm({ ...orderForm, payment_method: formatSplitSummary(menuSplit), payment_split: menuSplit });
                                }
                              } else {
                                setOrderForm({ ...orderForm, payment_method: m.id, payment_split: null });
                              }
                            }}
                            style={{
                              height: '36px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '4px',
                              borderRadius: '6px',
                              fontSize: '11.5px',
                              fontWeight: 600,
                              cursor: 'pointer',
                              border: selected ? '1.5px solid var(--primary, #059669)' : '1px solid #CBD5E1',
                              background: selected ? '#FFFFFF' : '#F8FAFC',
                              color: selected ? 'var(--primary, #059669)' : '#475569',
                              boxShadow: selected ? '0 1px 3px rgba(0, 0, 0, 0.08)' : 'none',
                              transition: 'all 0.15s ease',
                            }}
                          >
                            {selected ? <Check size={13} strokeWidth={2.5} /> : <Icon size={13} />}
                            <span>{m.label}</span>
                          </button>
                        );
                      })}
                    </div>

                    {(orderForm.payment_method === 'SPLIT' || orderForm.payment_method?.toUpperCase().startsWith('SPLIT')) && (
                      <SplitPaymentBreakdown
                        totalAmount={totalPrice}
                        split={menuSplit}
                        onChange={(newSplit, summary) => {
                          setMenuSplit(newSplit);
                          setOrderForm((prev) => ({
                            ...prev,
                            payment_method: summary,
                            payment_split: newSplit,
                          }));
                        }}
                        theme="emerald"
                      />
                    )}
                  </div>
                ) : (
                  <div style={{ fontSize: '11.5px', color: '#64748B', paddingTop: '6px', borderTop: '1px solid #F1F5F9' }}>
                    Order will be placed as <strong>Unpaid</strong>. Settle payment upon customer departure.
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
                <button
                  type="submit"
                  className="btn btn-primary btn-lg"
                  style={{ height: '46px', fontSize: '15px', fontWeight: 700 }}
                  disabled={submitting}
                >
                  {submitting ? 'Placing Order...' : `Place Order · ${formatPrice(totalPrice)}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
