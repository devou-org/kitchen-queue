'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { formatPrice } from '@/lib/format';
import { Product, CartItem, ProductStatus } from '@/types';

import { pusherClient } from '@/lib/pusher-client';
import { productService } from '@/app/services/products.api';
import { useRestaurant } from '@/hooks/useRestaurant';
import { Search, MapPin, Ticket, ClipboardList } from 'lucide-react';

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

const DietaryIcon = ({ preference }: { preference?: string }) => {
  if (!preference) return null;
  if (preference === 'VEG') {
    return (
      <div style={{ flexShrink: 0, width: '14px', height: '14px', border: '1px solid #16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '3px', background: 'white' }}>
        <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#16a34a' }} />
      </div>
    );
  }
  if (preference === 'NON_VEG') {
    return (
      <div style={{ flexShrink: 0, width: '14px', height: '14px', border: '1px solid #dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '3px', background: 'white' }}>
        <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#dc2626' }} />
      </div>
    );
  }
  if (preference === 'EGG') {
    return (
      <div style={{ flexShrink: 0, width: '14px', height: '14px', border: '1px solid #d97706', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '3px', background: 'white' }}>
        <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#d97706' }} />
      </div>
    );
  }
  return null;
};

function ProductCard({ product, quantity, onUpdate, showOrdering = true, layout = 'LIST' }: {
  product: Product;
  quantity: number;
  onUpdate: (id: string, delta: number) => void;
  showOrdering?: boolean;
  layout?: 'LIST' | 'GRID';
}) {
  const computedStatus = showOrdering
    ? ((product.stock_quantity ?? 0) <= 0 ? 'OUT_OF_STOCK' : (product.stock_quantity ?? 0) <= (product.buffer_quantity ?? 0) ? 'LOW_STOCK' : 'AVAILABLE')
    : product.status;
  const isOut = computedStatus === 'OUT_OF_STOCK';

  if (layout === 'GRID') {
    return (
      <div className="card animate-fade-in" style={{
        padding: 0,
        overflow: 'hidden',
        opacity: isOut ? 0.75 : 1,
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
        backgroundColor: '#ffffff',
        borderRadius: '12px',
        border: '1px solid #f1f5f9',
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box'
      }}>
        {/* Image */}
        <div style={{
          position: 'relative',
          height: '140px',
          background: '#f8fafc',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '8px',
        }}>
          <img
            src={product.image_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop'}
            alt={product.name}
            style={{
              maxWidth: '100%',
              maxHeight: '100%',
              objectFit: 'contain',
              borderRadius: '8px',
            }}
            onError={(e) => {
              (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop';
            }}
          />
          <span style={{
            position: 'absolute',
            top: 8,
            left: 8,
            fontSize: '8px',
            fontWeight: 800,
            letterSpacing: '0.04em',
            padding: '2px 5px',
            borderRadius: '4px',
            textTransform: 'uppercase',
            backgroundColor: computedStatus === 'AVAILABLE' ? '#ecfdf5' : computedStatus === 'LOW_STOCK' ? '#fffbeb' : '#fef2f2',
            color: computedStatus === 'AVAILABLE' ? '#059669' : computedStatus === 'LOW_STOCK' ? '#d97706' : '#dc2626',
          }}>
            {STATUS_BADGE[computedStatus].label}
          </span>
        </div>

        {/* Info */}
        <div style={{ padding: '10px', flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '100%' }}>
            <h3 style={{
              fontWeight: 800,
              fontSize: '14px',
              color: '#0f172a',
              marginBottom: '2px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flexShrink: 1,
              minWidth: 0
            }}>{product.name}</h3>
            <DietaryIcon preference={product.dietary_preference} />
          </div>

          {product.description && (
            <p style={{
              fontSize: '11px',
              color: '#64748b',
              marginBottom: '0px',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              lineHeight: '1.3',
              height: 'auto'
            }}>
              {product.description}
            </p>
          )}

          <div style={{ marginTop: '0px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <p style={{ color: 'var(--primary)', fontWeight: 800, fontSize: '14px', margin: 0 }}>
              {formatPrice(product.price)}
            </p>

            {/* Quantity Controls */}
            {showOrdering && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '100%' }}>
                <button
                  className="qty-btn"
                  onClick={() => onUpdate(product.id, -1)}
                  disabled={quantity === 0}
                  style={{
                    width: '24px', height: '24px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: '1px solid #e2e8f0', background: 'white', color: quantity > 0 ? 'var(--primary)' : '#cbd5e1', fontWeight: 'bold'
                  }}
                >−</button>
                <span style={{
                  flex: 1, textAlign: 'center', fontWeight: 800, fontSize: '13px',
                  color: quantity > 0 ? 'var(--primary)' : '#64748b',
                }}>{quantity}</span>
                <button
                  className="qty-btn"
                  onClick={() => onUpdate(product.id, 1)}
                  disabled={isOut || quantity >= 10}
                  style={{
                    width: '24px', height: '24px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: '1px solid #e2e8f0', background: 'white', color: isOut ? '#cbd5e1' : 'var(--primary)', fontWeight: 'bold'
                  }}
                >+</button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card animate-fade-in" style={{
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '14px',
      gap: '14px',
      backgroundColor: '#ffffff',
      borderRadius: '16px',
      border: '1px solid #f1f5f9',
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.02)',
      opacity: isOut ? 0.7 : 1,
      position: 'relative',
      minHeight: '120px',
      boxSizing: 'border-box'
    }}>
      {/* Left Details */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '3px', minWidth: 0 }}>
        {/* Availability Badge */}
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <span style={{
            fontSize: '9px',
            fontWeight: 800,
            letterSpacing: '0.04em',
            padding: '2px 6px',
            borderRadius: '4px',
            textTransform: 'uppercase',
            backgroundColor: computedStatus === 'AVAILABLE' ? '#ecfdf5' : computedStatus === 'LOW_STOCK' ? '#fffbeb' : '#fef2f2',
            color: computedStatus === 'AVAILABLE' ? '#059669' : computedStatus === 'LOW_STOCK' ? '#d97706' : '#dc2626',
          }}>
            {STATUS_BADGE[computedStatus].label}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '100%' }}>
          <h3 style={{
            fontWeight: 800,
            fontSize: '15px',
            color: '#0f172a',
            margin: '3px 0 1px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flexShrink: 1,
            minWidth: 0
          }}>
            {product.name}
          </h3>
          <DietaryIcon preference={product.dietary_preference} />
        </div>

        {product.description && (
          <p style={{
            fontSize: '11px',
            color: '#64748b',
            margin: '0 0 4px',
            lineHeight: '1.4',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            {product.description}
          </p>
        )}

        <p style={{
          color: 'var(--primary)',
          fontWeight: 800,
          fontSize: '15px',
          margin: 0,
        }}>
          {formatPrice(product.price)}
        </p>
      </div>

      {/* Right Image + Quantity Pill Selector */}
      <div style={{
        position: 'relative',
        width: '92px',
        height: '92px',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '12px',
        backgroundColor: '#f8fafc',
        border: '1px solid #f1f5f9',
        boxSizing: 'border-box'
      }}>
        <img
          src={product.image_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop'}
          alt={product.name}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            borderRadius: '12px',
          }}
          onError={(e) => {
            (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop';
          }}
        />

        {/* Floating Add/Qty Pill */}
        {showOrdering && (
          <div style={{
            position: 'absolute',
            bottom: '-12px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 10,
          }}>
            {quantity === 0 ? (
              <button
                onClick={() => onUpdate(product.id, 1)}
                disabled={isOut}
                style={{
                  padding: '5px 16px',
                  borderRadius: '6px',
                  backgroundColor: '#ffffff',
                  border: '1.5px solid var(--primary)',
                  color: 'var(--primary)',
                  fontWeight: 800,
                  fontSize: '11px',
                  boxShadow: '0 3px 8px rgba(0,0,0,0.06)',
                  cursor: isOut ? 'not-allowed' : 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.2s',
                  boxSizing: 'border-box'
                }}
              >
                ADD
              </button>
            ) : (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                backgroundColor: '#ffffff',
                border: '1.5px solid var(--primary)',
                borderRadius: '6px',
                padding: '2px',
                boxShadow: '0 4px 10px rgba(0,0,0,0.08)',
                boxSizing: 'border-box',
                minWidth: '70px',
                justifyContent: 'space-between'
              }}>
                <button
                  onClick={() => onUpdate(product.id, -1)}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    color: 'var(--primary)',
                    fontWeight: 900,
                    fontSize: '13px',
                    width: '20px',
                    height: '20px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 0
                  }}
                >
                  −
                </button>
                <span style={{
                  fontSize: '12px',
                  fontWeight: 800,
                  color: 'var(--primary)',
                  minWidth: '14px',
                  textAlign: 'center',
                }}>
                  {quantity}
                </span>
                <button
                  onClick={() => onUpdate(product.id, 1)}
                  disabled={isOut || quantity >= 10}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    color: 'var(--primary)',
                    fontWeight: 900,
                    fontSize: '13px',
                    width: '20px',
                    height: '20px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 0
                  }}
                >
                  +
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

import { use } from 'react';

export default function MenuPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const router = useRouter();
  const { restaurant, loading: restaurantLoading } = useRestaurant();
  const menuLayout = restaurant?.menu_layout || 'LIST';
  const showOrdering = restaurant?.modules?.ONLINE_ORDERING !== false;
  const showQueue = restaurant?.modules?.QUEUE_MANAGEMENT !== false;
  const showDigitalMenu = restaurant?.modules?.DIGITAL_MENU !== false;
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<Map<string, CartItem>>(new Map());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [categories, setCategories] = useState<string[]>(['All']);
  const [isServiceActive, setIsServiceActive] = useState(true);
  const [serviceMessage, setServiceMessage] = useState('');

  // Load cart from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('cart');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setCart(new Map(Object.entries(parsed)));
      } catch { }
    }
  }, []);

  // Save cart to localStorage
  const saveCart = useCallback((newCart: Map<string, CartItem>) => {
    const obj: Record<string, CartItem> = {};
    newCart.forEach((v, k) => { obj[k] = v; });
    localStorage.setItem('cart', JSON.stringify(obj));
    setCart(new Map(newCart));
  }, []);

  // Fetch products & Service Status
  useEffect(() => {
    const initPage = async () => {
      try {
        // Fetch products
        const res = await productService.getProducts();
        if (res.success && res.data) {
          setProducts(res.data);
          // Ensure categories are unique, trimmed, and "All" is not duplicated
          const uniqueCats = Array.from(new Set(
            res.data
              .map((p: Product) => p.category?.trim())
              .filter((cat: string) => cat && cat !== 'All')
          ));
          setCategories(['All', ...uniqueCats]);
        }

        // Fetch Service Status
        const settingsRes = await fetch('/api/admin/settings', {
          headers: { 'x-restaurant-slug': Array.isArray(slug) ? slug[0] : slug }
        });
        const settingsData = await settingsRes.json();
        if (settingsData.success) {
          setIsServiceActive(settingsData.isServiceActive);
          setServiceMessage(settingsData.serviceMessage || '');
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
  // useEffect(() => {
  //   if (!pusherClient) return;
  //   const channel = pusherClient.subscribe('queue-channel');

  //   channel.bind('product_update', (data: any) => {
  //     setProducts(prev => prev.map(p =>
  //       p.id === data.product_id ? { ...p, status: data.product_status } : p
  //     ));
  //   });

  //   return () => {
  //     channel.unbind_all();
  //     channel.unsubscribe();
  //   };
  // }, []);

  // Keep cart aligned with latest product availability and details.
  useEffect(() => {
    if (products.length === 0 || cart.size === 0) return;

    const byId = new Map(products.map((p) => [p.id, p]));
    const newCart = new Map(cart);
    const removedNames: string[] = [];
    let changed = false;

    for (const [id, item] of cart.entries()) {
      const product = byId.get(id);

      if (!product) {
        newCart.delete(id);
        removedNames.push(item.name);
        changed = true;
        continue;
      }

      const pStatus = showOrdering 
        ? ((product.stock_quantity ?? 0) <= 0 ? 'OUT_OF_STOCK' : (product.stock_quantity ?? 0) <= (product.buffer_quantity ?? 0) ? 'LOW_STOCK' : 'AVAILABLE')
        : product.status;

      if (pStatus === 'OUT_OF_STOCK') {
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
          status: pStatus,
          price: product.price,
          name: product.name,
          image_url: product.image_url,
        });
        changed = true;
      }
    }

    if (changed) {
      saveCart(newCart);
    }

    if (removedNames.length > 0) {
      toast.error(`${removedNames.join(', ')} removed from cart (out of stock)`);
    }
  }, [products, cart, saveCart]);

  const handleUpdate = (id: string, delta: number) => {
    const product = products.find(p => p.id === id);
    if (!product) return;

    const pStatus = showOrdering 
      ? ((product.stock_quantity ?? 0) <= 0 ? 'OUT_OF_STOCK' : (product.stock_quantity ?? 0) <= (product.buffer_quantity ?? 0) ? 'LOW_STOCK' : 'AVAILABLE')
      : product.status;

    if (delta > 0 && pStatus === 'OUT_OF_STOCK') {
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
        quantity: Math.min(newQty, 10),
        image_url: product.image_url,
        status: pStatus,
      });
    }
    saveCart(newCart);
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

  if (restaurantLoading || loading) {
    return (
      <div style={{ background: '#f8fafc', minHeight: '100vh', padding: '0 0 80px', fontFamily: "'Inter', sans-serif" }}>
        {/* Shimmer / Pulse inline style keyframes */}
        <style dangerouslySetInnerHTML={{
          __html: `
          @keyframes skeleton-pulse {
            0%, 100% { opacity: 0.6; }
            50% { opacity: 1; }
          }
          .skeleton-pulse {
            animation: skeleton-pulse 1.6s ease-in-out infinite;
          }
        `}} />

        {/* Skeleton Header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          padding: '12px 16px', borderBottom: '1px solid #e2e8f0',
          backgroundColor: '#ffffff', height: '57px', boxSizing: 'border-box'
        }}>
          <div className="skeleton-pulse" style={{ width: '32px', height: '32px', borderRadius: '6px', backgroundColor: '#e2e8f0' }} />
          <div className="skeleton-pulse" style={{ width: '120px', height: '16px', borderRadius: '4px', backgroundColor: '#e2e8f0' }} />
        </div>

        <div style={{ maxWidth: '480px', margin: '0 auto', padding: '0' }}>
          {/* Skeleton Hero Section */}
          <div style={{ padding: '20px 16px 12px' }}>
            <div className="skeleton-pulse" style={{ width: '180px', height: '28px', borderRadius: '6px', backgroundColor: '#e2e8f0', marginBottom: '8px' }} />
            <div className="skeleton-pulse" style={{ width: '280px', height: '14px', borderRadius: '4px', backgroundColor: '#e2e8f0' }} />
          </div>

          {/* Skeleton Search Box */}
          <div style={{ padding: '0 16px 12px' }}>
            <div className="skeleton-pulse" style={{ width: '100%', height: '42px', borderRadius: '8px', backgroundColor: '#e2e8f0' }} />
          </div>

          {/* Skeleton Categories */}
          <div style={{ padding: '0 16px 16px', display: 'flex', gap: '8px', overflowX: 'hidden' }}>
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="skeleton-pulse" style={{ width: '70px', height: '30px', borderRadius: '20px', backgroundColor: '#e2e8f0', flexShrink: 0 }} />
            ))}
          </div>

          {/* Skeleton Product Container */}
          {menuLayout === 'GRID' ? (
            <div style={{ padding: '0 16px 320px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {[1, 2, 3, 4].map(i => (
                <div key={i} style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #f1f5f9', overflow: 'hidden', padding: '0 0 12px', display: 'flex', flexDirection: 'column' }}>
                  <div className="skeleton-pulse" style={{ width: '100%', height: '140px', backgroundColor: '#f1f5f9' }} />
                  <div style={{ padding: '10px', flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div className="skeleton-pulse" style={{ width: '80%', height: '12px', borderRadius: '3px', backgroundColor: '#e2e8f0' }} />
                    <div className="skeleton-pulse" style={{ width: '60%', height: '8px', borderRadius: '2px', backgroundColor: '#e2e8f0' }} />
                    <div className="skeleton-pulse" style={{ width: '40%', height: '12px', borderRadius: '3px', backgroundColor: '#e2e8f0', marginTop: 'auto' }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: '0 16px 320px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {[1, 2, 3, 4].map(i => (
                <div key={i} style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: '16px', gap: '16px', backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid #f1f5f9', minHeight: '120px', boxSizing: 'border-box' }}>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div className="skeleton-pulse" style={{ width: '60px', height: '12px', borderRadius: '3px', backgroundColor: '#e2e8f0' }} />
                    <div className="skeleton-pulse" style={{ width: '140px', height: '16px', borderRadius: '4px', backgroundColor: '#e2e8f0' }} />
                    <div className="skeleton-pulse" style={{ width: '100px', height: '12px', borderRadius: '3px', backgroundColor: '#e2e8f0' }} />
                    <div className="skeleton-pulse" style={{ width: '50px', height: '16px', borderRadius: '4px', backgroundColor: '#e2e8f0' }} />
                  </div>
                  <div className="skeleton-pulse" style={{ width: '92px', height: '92px', borderRadius: '12px', backgroundColor: '#f1f5f9', flexShrink: 0 }} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!showDigitalMenu) {
    return (
      <div style={{ background: '#f8fafc', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px', textAlign: 'center', fontFamily: "'Inter', sans-serif" }}>
        <div style={{ backgroundColor: '#ffffff', padding: '40px', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)', maxWidth: '400px', width: '100%' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🍽️</div>
          <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#0f172a', marginBottom: '8px' }}>Menu Unavailable</h1>
          <p style={{ color: '#64748b', fontSize: '14px', lineHeight: '1.5' }}>The digital menu is currently disabled for this restaurant. Please check back later.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      {restaurant?.primary_color && (
        <style dangerouslySetInnerHTML={{
          __html: `
          :root {
            --primary: ${restaurant.primary_color};
            --primary-dark: ${restaurant.primary_color};
          }
        `}} />
      )}
      {/* Header */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Link href={`/${slug}/menu`} prefetch={false} style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
          {restaurant?.logo_url ? (
            <img
              src={restaurant.logo_url}
              alt={restaurant.name || 'Logo'}
              style={{ width: '32px', height: '32px', borderRadius: '6px', objectFit: 'cover' }}
            />
          ) : (
            <div style={{
              width: '32px', height: '32px', borderRadius: '6px',
              backgroundColor: restaurant?.primary_color || 'var(--primary)',
              color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 800, fontSize: '14px'
            }}>
              {restaurant?.name ? restaurant.name.charAt(0).toUpperCase() : '🌿'}
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontWeight: 800, fontSize: '18px', color: 'var(--text-primary)', lineHeight: 1.2 }}>
              {restaurant?.name || 'Loading...'}
            </span>
            {restaurant?.address && (
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '2px', marginTop: '2px', fontWeight: 600 }}>
                <MapPin size={10} style={{ color: 'var(--primary)' }} />
                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '200px' }}>
                  {(() => {
                    const parts = restaurant.address.split(',').map(s => s.trim());
                    if (parts.length >= 3) return `${parts[0]}, ${parts[2]}`;
                    if (parts.length >= 2) return `${parts[0]}, ${parts[1]}`;
                    return parts[0];
                  })()}
                </span>
              </span>
            )}
          </div>
        </Link>
        {!showQueue && (
          <Link href={`/${slug}/order-status`} prefetch={false} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
            padding: '6px 12px', borderRadius: '20px',
            backgroundColor: '#f1f5f9', color: 'var(--text-primary)',
            textDecoration: 'none', fontWeight: 700, fontSize: '13px'
          }}>
            <Ticket size={16} />
            My Tickets
          </Link>
        )}
      </div>

      <div style={{ maxWidth: '480px', margin: '0 auto', padding: '0' }}>
        {/* Hero Section */}
        <div style={{ padding: '20px 16px 12px' }}>
          <h1 style={{ fontSize: '26px', fontWeight: 800, marginBottom: '4px', color: 'var(--text-primary)' }}>
            {restaurant?.menu_title || "Today's Specials"}
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1.4 }}>
            {restaurant?.menu_description || "Hand-curated coastal delicacies prepared with traditional recipes."}
          </p>
        </div>

        {!isServiceActive && (
          <div className="service-closed-banner">
            <h3 style={{ fontWeight: 800, fontSize: '16px', marginBottom: '4px' }}>🍽️ Service is Not Started</h3>
            <p style={{ fontSize: '13px', opacity: 0.8 }}>
              {serviceMessage || "We are currently not accepting new orders. Please check back later!"}
            </p>
          </div>
        )}

        {/* Search */}
        <div style={{ padding: '0 16px 12px' }}>
          <div style={{ position: 'relative', width: '100%' }}>
            <Search
              size={18}
              style={{
                position: 'absolute',
                left: '14px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-secondary)',
                pointerEvents: 'none'
              }}
            />
            <input
              type="search"
              className="input"
              placeholder="Search dishes..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                paddingLeft: '40px',
                width: '100%',
                background: '#F9FAFB',
                border: '1px solid var(--border)',
                borderRadius: '12px',
                height: '44px',
                fontSize: '14px',
                transition: 'all 0.2s',
                outline: 'none'
              }}
            />
          </div>
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
        <div style={{ padding: '0 16px 320px' }}>
          {loading ? (
            <div style={{
              display: menuLayout === 'GRID' ? 'grid' : 'flex',
              gridTemplateColumns: menuLayout === 'GRID' ? '1fr 1fr' : undefined,
              flexDirection: menuLayout === 'GRID' ? undefined : 'column',
              gap: '12px'
            }}>
              {[1, 2, 3, 4].map(i => (
                <div key={i} style={{ height: menuLayout === 'GRID' ? '220px' : '120px', background: '#F3F4F6', borderRadius: '16px', animation: 'pulse 1.5s infinite' }} />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-secondary)' }}>
              <div style={{ fontSize: '48px', marginBottom: '12px' }}>🍽️</div>
              <p style={{ fontWeight: 600 }}>No items found</p>
            </div>
          ) : (
            <div style={{
              display: menuLayout === 'GRID' ? 'grid' : 'flex',
              gridTemplateColumns: menuLayout === 'GRID' ? '1fr 1fr' : undefined,
              flexDirection: menuLayout === 'GRID' ? undefined : 'column',
              gap: '12px'
            }}>
              {filtered.map(product => (
                <ProductCard
                  key={product.id}
                  product={product}
                  quantity={cart.get(product.id)?.quantity || 0}
                  onUpdate={isServiceActive ? handleUpdate : () => toast.error('Service is not started')}
                  showOrdering={showOrdering}
                  layout={menuLayout}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Cart Button */}
      {totalItems > 0 && isServiceActive && showOrdering && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          left: 0,
          right: 0,
          background: 'transparent',
          padding: '0 16px',
          zIndex: 40,
          pointerEvents: 'none',
          display: 'flex',
          justifyContent: 'center'
        }}>
          <Link prefetch={false} href={`/${slug}/cart`}
            className="cart-btn"
            style={{
              pointerEvents: 'auto',
              width: 'auto',
              minWidth: '260px',
              maxWidth: '400px',
              background: 'var(--primary)',
              borderRadius: '999px',
              height: '48px',
              display: 'flex',
              alignItems: 'center',
              padding: '0 20px',
              boxShadow: '0 8px 20px rgba(0, 0, 0, 0.12)',
              color: 'white',
              textDecoration: 'none',
              fontWeight: 800,
              fontSize: '14px',
              gap: '12px'
            }}
          >
            <span style={{
              background: 'rgba(255,255,255,0.2)',
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '11px',
              fontWeight: 900
            }}>{totalItems}</span>
            <span>Review & Order →</span>
            <span style={{ marginLeft: 'auto', opacity: 0.9 }}>{formatPrice(totalPrice)}</span>
          </Link>
        </div>
      )}

      {/* Join Waitlist Button (if queue enabled but ordering disabled) */}
      {!showOrdering && showQueue && isServiceActive && (
        <div style={{
          position: 'fixed',
          bottom: '30px',
          left: 0,
          right: 0,
          background: 'transparent',
          padding: '0 16px',
          zIndex: 40,
          pointerEvents: 'none',
          display: 'flex',
          justifyContent: 'center',
          gap: '12px'
        }}>
          <Link prefetch={false} href={`/${slug}/queue-status`}
            className="animate-fade-in"
            style={{
              pointerEvents: 'auto',
              background: 'white',
              border: '2px solid var(--primary)',
              borderRadius: '999px',
              height: '48px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 20px',
              boxShadow: '0 8px 20px rgba(0, 0, 0, 0.12)',
              color: 'var(--primary)',
              textDecoration: 'none',
              fontWeight: 800,
              fontSize: '15px',
              gap: '8px'
            }}
          >
            <Search size={18} />
            Check Status
          </Link>

          <Link prefetch={false} href={`/${slug}/queue`}
            className="animate-fade-in"
            style={{
              pointerEvents: 'auto',
              flex: 1,
              maxWidth: '220px',
              background: 'var(--primary)',
              borderRadius: '999px',
              height: '48px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 20px',
              boxShadow: '0 8px 20px rgba(0, 0, 0, 0.12)',
              color: 'white',
              textDecoration: 'none',
              fontWeight: 800,
              fontSize: '15px',
              gap: '8px'
            }}
          >
            <ClipboardList size={18} />
            Join Waitlist
          </Link>
        </div>
      )}

      
    </div>
  );
}
