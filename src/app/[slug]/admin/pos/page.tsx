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
import { Search, X } from 'lucide-react';
import { OrderType } from '@/types';
import { printUnifiedThermalTicket, tryAutoConnectBluetooth } from '@/lib/hardware-printer';
import { LayoutMaximizeToggle } from '@/components/LayoutMaximizeToggle';
import { AdminContentWrapper } from '@/components/AdminContentWrapper';
import { AdminPageHeader } from '@/components/AdminPageHeader';
import { POSCheckoutDrawer, POSOrderFormData } from '@/components/modules/pos/POSCheckoutDrawer';

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

export default function AdminPosPage() {
  const { restaurant } = useRestaurant();
  const params = useParams();
  const slug = (params?.slug as string) || restaurant?.slug || '';

  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<Map<string, CartItem>>(new Map());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [categories, setCategories] = useState<string[]>(['All']);

  useEffect(() => {
    tryAutoConnectBluetooth();
  }, []);

  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [tables, setTables] = useState<any[]>([]);
  const [orderForm, setOrderForm] = useState<POSOrderFormData>({
    customer_name: '',
    phone: '',
    table_number: '',
    party_size: 1,
    notes: '',
    order_type: 'DINE_IN',
    is_paid: false,
    payment_method: 'CASH',
  });
  const [submitting, setSubmitting] = useState(false);
  const [loyaltyCustomer, setLoyaltyCustomer] = useState<any>(null);
  const [loyaltyDiscount, setLoyaltyDiscount] = useState<number>(0);

  useEffect(() => {
    if (orderForm.phone && orderForm.phone.trim().length >= 10 && restaurant?.modules?.LOYALTY_PROGRAM !== false) {
      const slugStr = Array.isArray(slug) ? slug[0] : slug;
      fetch(`/api/admin/loyalty/customers?slug=${slugStr}&search=${encodeURIComponent(orderForm.phone.trim())}`)
        .then(res => res.json())
        .then(json => {
          if (json.success && json.data && json.data.length > 0) {
            setLoyaltyCustomer(json.data[0]);
            if (json.data[0].name && !orderForm.customer_name) {
              setOrderForm(prev => ({ ...prev, customer_name: json.data[0].name }));
            }
          } else {
            setLoyaltyCustomer(null);
          }
        })
        .catch(() => setLoyaltyCustomer(null));
    } else {
      setLoyaltyCustomer(null);
    }
  }, [orderForm.phone, slug, restaurant]);

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

        await fetchTables();
      } catch {
        toast.error('Failed to load menu');
      } finally {
        setLoading(false);
      }
    };
    initPage();
  }, [fetchTables]);

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
      const autoPrint = typeof window !== 'undefined' ? (localStorage.getItem('qdine_auto_print_kot') !== 'false') : true;
      if (!autoPrint) return;

      const dedicatedStation = typeof window !== 'undefined' ? (localStorage.getItem('qdine_dedicated_kds_station') || '') : '';
      if (dedicatedStation && dedicatedStation !== '' && dedicatedStation.toLowerCase() !== (data.counter_name || '').toLowerCase()) {
        return;
      }

      toast(`🖨️ Auto-printing KOT #${String(data.ticket_number).padStart(3, '0')} (${data.counter_name})...`, {
        icon: '🖨️',
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
          toast.success(`🖨️ Auto-printed: ${label} #${String(data.ticket_number).padStart(3, '0')} (${result.method})`, {
            id: data.is_add_on ? `kot-auto-${data.ticket_number}-${data.counter_name}-${Date.now()}` : `kot-auto-${data.ticket_number}-${data.counter_name}`,
          });
        }
      } catch (err: any) {
        console.error('Auto-print execution error on admin POS menu:', err);
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
        quantity: Math.min(newQty, 50), // allow staff/admin to order more
        image_url: product.image_url,
        status: product.status,
      });
    }
    setCart(newCart);
  };

  const submitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.size === 0) {
      toast.error('Cart is empty');
      return;
    }
    const isTakeaway = orderForm.order_type === 'TAKEAWAY';
    if (!isTakeaway && !orderForm.customer_name && !orderForm.table_number) {
      toast.error('Please provide a Customer Name or Table Number');
      return;
    }

    setSubmitting(true);
    try {
      const items = Array.from(cart.values()).map(item => ({
        product_id: item.product_id,
        quantity: item.quantity,
        price_at_purchase: item.price
      }));

      // Generate a mock phone if not provided for admin/staff orders
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
        payment_method: orderForm.is_paid ? (orderForm.payment_method || 'CASH') : undefined,
      });

      if (res.success && res.data) {
        const createdOrder = res.data;
        toast.success(`Order placed successfully! Ticket #${createdOrder.ticket_number}`);
        setCart(new Map());
        setCheckoutOpen(false);
        setOrderForm({ customer_name: '', phone: '', table_number: '', party_size: 1, notes: '', order_type: 'DINE_IN', is_paid: false, payment_method: 'CASH' });
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
      return matchCat && matchSearch;
    })
    .sort((a, b) => {
      const statusDiff = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
      if (statusDiff !== 0) return statusDiff;
      return a.name.localeCompare(b.name);
    });

  return (
    <AdminContentWrapper fullWidth style={{ paddingTop: 0, paddingLeft: 0, paddingRight: 0, maxWidth: '100%', paddingBottom: '90px' }}>
      <style>{`
        .pos-page-header {
          height: 68px !important;
          min-height: 68px !important;
          display: flex !important;
          align-items: center !important;
          margin: 0 !important;
          padding: 0 20px !important;
          border-bottom: 1px solid var(--border) !important;
          background: #FFFFFF !important;
          box-sizing: border-box !important;
        }

        .pos-page-header .admin-page-header-container {
          height: 68px !important;
          min-height: 68px !important;
          display: flex !important;
          align-items: center !important;
          margin: 0 !important;
          padding: 0 !important;
          gap: 12px !important;
          width: 100% !important;
        }

        .pos-toolbar {
          display: flex !important;
          flex-wrap: nowrap !important;
          align-items: center !important;
          gap: 10px !important;
          width: 100% !important;
          min-width: 0 !important;
        }

        .pos-search-control {
          position: relative !important;
          width: 240px !important;
          flex: 0 0 240px !important;
          min-width: 140px !important;
          max-width: 300px !important;
          flex-shrink: 0 !important;
        }

        .pos-actions {
          display: flex !important;
          flex-wrap: nowrap !important;
          align-items: center !important;
          gap: 8px !important;
          margin-left: auto !important;
          flex-shrink: 0 !important;
        }

        @media (max-width: 768px) {
          .pos-page-header {
            height: auto !important;
            min-height: auto !important;
            padding: 12px 16px !important;
          }

          .pos-toolbar {
            flex-direction: row !important;
            align-items: center !important;
            gap: 10px !important;
          }

          .pos-search-control {
            flex: 1 !important;
            width: auto !important;
            min-width: 0 !important;
          }
        }
      `}</style>
      <AdminPageHeader
        className="pos-page-header"
        style={{ paddingTop: 0, minHeight: '68px', display: 'flex', alignItems: 'center', marginBottom: 0 }}
        hideMaximize={true}
        search={
          <div className="pos-toolbar">
            {/* Search Input */}
            <div className="pos-search-control">
              <Search
                size={14}
                style={{
                  position: 'absolute',
                  left: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#94A3B8',
                  pointerEvents: 'none',
                }}
              />
              <input
                type="text"
                placeholder="Search item name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  height: '38px',
                  paddingLeft: '30px',
                  paddingRight: search ? '26px' : '8px',
                  fontSize: '12px',
                  borderRadius: '8px',
                  background: 'white',
                  border: '1px solid var(--border)',
                  width: '100%',
                  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
                  outline: 'none',
                  color: 'var(--text-primary)',
                }}
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  style={{
                    position: 'absolute',
                    right: '6px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '4px',
                    borderRadius: '4px',
                    color: '#94A3B8',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  title="Clear search"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Right: Maximize Toggle should be last */}
            <div className="pos-actions">
              <div style={{ borderLeft: '1px solid #E2E8F0', paddingLeft: '8px', display: 'flex', alignItems: 'center', height: '32px' }}>
                <LayoutMaximizeToggle />
              </div>
            </div>
          </div>
        }
      />

      <div style={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box', margin: 0, padding: '20px' }}>

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
        <div style={{ position: 'fixed', bottom: '24px', left: 0, right: 0, padding: '0 16px', zIndex: 40, display: 'flex', justifyContent: 'center' }}>
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

      <POSCheckoutDrawer
        isOpen={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        cart={cart}
        onUpdateCart={handleUpdate}
        tables={tables}
        restaurant={restaurant}
        orderForm={orderForm}
        setOrderForm={setOrderForm}
        onSubmitOrder={submitOrder}
        submitting={submitting}
      />
      </div>
    </AdminContentWrapper>
  );
}

