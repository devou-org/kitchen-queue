'use client';
import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import { formatPrice } from '@/lib/format';
import { Product, CartItem, ProductStatus } from '@/types';
import { pusherClient } from '@/lib/pusher-client';
import { productService } from '@/app/services/products.api';
import { orderService } from '@/app/services/orders.api';
import { tableService } from '@/app/services/tables.api';
import { useRestaurant } from '@/hooks/useRestaurant';
import { useParams, useSearchParams } from 'next/navigation';
import { Search, X, MapPin } from 'lucide-react';
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
  const searchParams = useSearchParams();
  const slug = (params?.slug as string) || restaurant?.slug || '';
  const tableParam = searchParams?.get('table') || searchParams?.get('table_number') || '';

  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<Map<string, CartItem>>(new Map());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [categories, setCategories] = useState<string[]>(['All']);

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    tryAutoConnectBluetooth();
  }, []);

  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [tables, setTables] = useState<any[]>([]);
  const [orderForm, setOrderForm] = useState<POSOrderFormData>({
    customer_name: '',
    phone: '',
    table_number: tableParam || '',
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
    if (tableParam) {
      setOrderForm(prev => ({
        ...prev,
        table_number: tableParam,
        order_type: 'DINE_IN',
        is_paid: false,
      }));
      toast.success(`Table #${tableParam} selected for order`, { id: `pos-table-param` });
    }
  }, [tableParam]);

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

      const label = data.is_add_on ? `Add-on KOT (${data.counter_name || 'Counter'})` : (data.counter_name || 'KOT');

      // If server already printed directly via Wi-Fi TCP or Windows spooler
      if (data.server_printed) {
        toast.success(`🖨️ Auto-printed: ${label} #${String(data.ticket_number).padStart(3, '0')} (Wi-Fi)`, {
          id: data.is_add_on ? `kot-auto-${data.ticket_number}-${data.counter_name}-${Date.now()}` : `kot-auto-${data.ticket_number}-${data.counter_name}`,
        });
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
        quantity: Math.min(newQty, 50), // allow staff/admin to order more
        image_url: product.image_url,
        status: product.status,
      });
    }
    setCart(newCart);
  };

  const triggerAutoPrintBill = async (order: any, restaurantSlug: string) => {
    const savedPrinter = typeof window !== 'undefined'
      ? (localStorage.getItem('qdine_bill_printer_name') || localStorage.getItem('qdine_kot_printer_name') || 'POS-80C')
      : 'POS-80C';

    try {
      const res = await fetch('/api/print/bill', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-restaurant-slug': restaurantSlug,
        },
        body: JSON.stringify({
          orderId: order.id,
          printerName: savedPrinter,
          orderData: order,
          slug: restaurantSlug,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        console.warn('Auto-print bill server response:', data);
        return;
      }

      if (data.mode === 'server' || data.mode === 'agent') {
        toast.success(`🖨️ Bill #${String(order.ticket_number).padStart(3, '0')} sent to printer!`);
        return;
      }

      const { printBillFromBrowser } = await import('@/lib/client-print');
      const savedBridgeUrl = typeof window !== 'undefined' ? localStorage.getItem('qdine_printer_bridge_url') : undefined;
      const clientRes = await printBillFromBrowser({
        base64Bytes: data.base64Bytes,
        billHtml: data.billHtml,
        orderData: order,
        billData: data.billData,
        printerName: data.printer || savedPrinter,
        ticketNumber: order.ticket_number,
        localBridgeUrl: savedBridgeUrl ? `${savedBridgeUrl.replace(/\/+$/, '')}/print` : undefined,
      });

      if (clientRes.success) {
        toast.success(`🖨️ Auto-printed Bill #${String(order.ticket_number).padStart(3, '0')}!`);
      }
    } catch (err) {
      console.error('Auto-print bill execution error:', err);
    }
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

      // Generate a mock phone if not provided for admin/staff orders
      const phoneToUse = orderForm.phone || `+910000000000`;
      const nameToUse = orderForm.customer_name || (isTakeaway ? 'Takeaway Customer' : `Table ${orderForm.table_number}`);

      const discountAmount = Math.max(0, Number(orderForm.discount_amount) || 0);

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
        payment_split: orderForm.is_paid ? orderForm.payment_split : undefined,
        discount_amount: discountAmount,
      });

      if (res.success && res.data) {
        const createdOrder = res.data;

        // If a loyalty reward was selected, trigger redemption API
        if (orderForm.selected_reward_id && orderForm.phone) {
          try {
            const slugStr = Array.isArray(slug) ? slug[0] : slug;
            await fetch('/api/admin/loyalty/redeem', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                slug: slugStr,
                phone: orderForm.phone.trim(),
                reward_id: orderForm.selected_reward_id,
              }),
            });
          } catch (err) {
            console.error('Loyalty reward redemption call error:', err);
          }
        }

        toast.success(`Order placed successfully! Ticket #${createdOrder.ticket_number}`);

        // Check if Print Bill button was clicked
        const willPrintBill = Boolean((e as any)?.auto_print_bill ?? orderForm.auto_print_bill);

        if (willPrintBill) {
          triggerAutoPrintBill(createdOrder, slug as string);
        }

        setCart(new Map());
        setCheckoutOpen(false);
        setOrderForm({
          customer_name: '',
          phone: '',
          table_number: '',
          party_size: 1,
          notes: '',
          order_type: 'DINE_IN',
          is_paid: false,
          payment_method: 'CASH',
          discount_amount: 0,
          selected_reward_id: undefined,
          auto_print_bill: willPrintBill,
        });
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

            {/* Right: Selected Table Badge & Maximize Toggle */}
            <div className="pos-actions">
              {orderForm.table_number && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '4px 10px',
                    borderRadius: '8px',
                    background: '#FEF3C7',
                    border: '1px solid #FDE68A',
                    color: '#92400E',
                    fontSize: '12px',
                    fontWeight: 700,
                  }}
                >
                  <MapPin size={13} style={{ color: '#D97706' }} />
                  <span>Table #{orderForm.table_number}</span>
                  <button
                    type="button"
                    onClick={() => setOrderForm((prev) => ({ ...prev, table_number: '' }))}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: '#B45309',
                      padding: '2px',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                    title="Clear selected table"
                  >
                    <X size={12} />
                  </button>
                </div>
              )}
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

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '12px', paddingBottom: totalItems > 0 ? '90px' : '24px' }}>
        {filtered.map(product => (
          <ProductCard
            key={product.id}
            product={product}
            quantity={cart.get(product.id)?.quantity || 0}
            onUpdate={handleUpdate}
          />
        ))}
      </div>

      {mounted && totalItems > 0 && typeof document !== 'undefined' && createPortal(
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            left: 0,
            right: 0,
            padding: '0 20px',
            zIndex: 99999,
            pointerEvents: 'none',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setCheckoutOpen(true)}
            style={{
              pointerEvents: 'auto',
              width: '100%',
              maxWidth: '460px',
              borderRadius: '12px',
              height: '52px',
              fontSize: '15px',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0 20px',
              boxShadow: '0 12px 30px -4px rgba(0, 0, 0, 0.4), 0 4px 14px rgba(5, 150, 105, 0.45)',
              cursor: 'pointer',
              border: 'none',
              background: 'var(--primary, #059669)',
              color: '#FFFFFF',
              letterSpacing: '-0.01em',
              transition: 'all 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px) scale(1.01)';
              e.currentTarget.style.boxShadow = '0 16px 36px -4px rgba(0, 0, 0, 0.45), 0 6px 18px rgba(5, 150, 105, 0.55)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0) scale(1)';
              e.currentTarget.style.boxShadow = '0 12px 30px -4px rgba(0, 0, 0, 0.4), 0 4px 14px rgba(5, 150, 105, 0.45)';
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span
                style={{
                  background: 'rgba(255, 255, 255, 0.25)',
                  padding: '3px 10px',
                  borderRadius: '999px',
                  fontSize: '13px',
                  fontWeight: 900,
                }}
              >
                {totalItems} {totalItems === 1 ? 'item' : 'items'}
              </span>
              <span style={{ fontSize: '15px', fontWeight: 800 }}>View Cart &amp; Checkout</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '16px', fontWeight: 900 }}>
              <span>{formatPrice(totalPrice)}</span>
              <span style={{ fontSize: '19px', lineHeight: 1 }}>→</span>
            </div>
          </button>
        </div>,
        document.body
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

