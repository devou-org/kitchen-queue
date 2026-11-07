'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { formatPrice } from '@/lib/format';
import { Product, CartItem, ProductStatus, SelectedCustomizationSnapshot } from '@/types';

import { pusherClient } from '@/lib/pusher-client';
import { productService } from '@/app/services/products.api';
import { useRestaurant } from '@/hooks/useRestaurant';
import { Search, MapPin, Ticket, ClipboardList } from 'lucide-react';
import { DietaryFilter, DietaryPreferenceFilter } from '@/components/ui/DietaryFilter';
import { sortCategoriesByConfig } from '@/lib/category-order';
import { ProductCustomizationModal, ProductCustomizationResult } from '@/components/modules/products/ProductCustomizationModal';

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

function ProductCard({ product, quantity, onUpdate, onCustomize, showOrdering = true, layout = 'LIST' }: {
  product: Product;
  quantity: number;
  onUpdate: (id: string, delta: number) => void;
  onCustomize?: (product: Product) => void;
  showOrdering?: boolean;
  layout?: 'LIST' | 'GRID';
}) {
  const computedStatus = showOrdering
    ? ((product.stock_quantity ?? 0) <= 0 ? 'OUT_OF_STOCK' : (product.stock_quantity ?? 0) <= (product.buffer_quantity ?? 0) ? 'LOW_STOCK' : 'AVAILABLE')
    : product.status;
  const isOut = computedStatus === 'OUT_OF_STOCK';
  const isCustomizable = Boolean(
    product.has_customizations ||
    (Array.isArray(product.variants) && product.variants.length > 0) ||
    (Array.isArray(product.customization_groups) && product.customization_groups.length > 0)
  );

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
              {isCustomizable ? `From ${formatPrice(product.price)}` : formatPrice(product.price)}
            </p>

            {/* Quantity Controls */}
            {showOrdering && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '100%' }}>
                {quantity === 0 ? (
                  <div style={{ width: '100%', textAlign: 'center' }}>
                    <button
                      type="button"
                      onClick={() => {
                        if (isCustomizable && onCustomize) {
                          onCustomize(product);
                        } else {
                          onUpdate(product.id, 1);
                        }
                      }}
                      disabled={isOut}
                      style={{
                        width: '100%',
                        padding: '5px 12px',
                        borderRadius: '6px',
                        backgroundColor: '#ffffff',
                        border: '1.5px solid var(--primary)',
                        color: 'var(--primary)',
                        fontWeight: 800,
                        fontSize: '11.5px',
                        cursor: isOut ? 'not-allowed' : 'pointer',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
                      }}
                    >
                      ADD
                    </button>
                    {isCustomizable && (
                      <span style={{ fontSize: '9px', color: '#64748b', display: 'block', marginTop: '2px', fontWeight: 600 }}>
                        customisable
                      </span>
                    )}
                  </div>
                ) : (
                  <>
                    <button
                      className="qty-btn"
                      onClick={() => onUpdate(product.id, -1)}
                      style={{
                        width: '24px', height: '24px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        border: '1px solid #e2e8f0', background: 'white', color: 'var(--primary)', fontWeight: 'bold'
                      }}
                    >−</button>
                    <span style={{
                      flex: 1, textAlign: 'center', fontWeight: 800, fontSize: '13px',
                      color: 'var(--primary)',
                    }}>{quantity}</span>
                    <button
                      className="qty-btn"
                      onClick={() => {
                        if (isCustomizable && onCustomize) {
                          onCustomize(product);
                        } else {
                          onUpdate(product.id, 1);
                        }
                      }}
                      disabled={isOut || quantity >= 10}
                      style={{
                        width: '24px', height: '24px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        border: '1px solid #e2e8f0', background: 'white', color: isOut ? '#cbd5e1' : 'var(--primary)', fontWeight: 'bold'
                      }}
                    >+</button>
                  </>
                )}
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
          {isCustomizable ? `From ${formatPrice(product.price)}` : formatPrice(product.price)}
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
            bottom: isCustomizable && quantity === 0 ? '-18px' : '-12px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 10,
          }}>
            {quantity === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={() => {
                    if (isCustomizable && onCustomize) {
                      onCustomize(product);
                    } else {
                      onUpdate(product.id, 1);
                    }
                  }}
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
                {isCustomizable && (
                  <span style={{ fontSize: '9px', color: '#64748b', marginTop: '2px', fontWeight: 600, letterSpacing: '-0.02em', whiteSpace: 'nowrap' }}>
                    customisable
                  </span>
                )}
              </div>
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
                  type="button"
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
                  type="button"
                  onClick={() => {
                    if (isCustomizable && onCustomize) {
                      onCustomize(product);
                    } else {
                      onUpdate(product.id, 1);
                    }
                  }}
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
  const [customizingProduct, setCustomizingProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [categories, setCategories] = useState<string[]>(['All']);
  const [dietaryFilter, setDietaryFilter] = useState<DietaryPreferenceFilter>('ALL');
  const [isServiceActive, setIsServiceActive] = useState(true);
  const [serviceMessage, setServiceMessage] = useState('');

  // Load cart and sync table query param from URL
  useEffect(() => {
    if (!slug) return;

    // Sync table query param with localStorage
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const tableParam = urlParams.get('table');
      if (tableParam) {
        // If customer scanned a specific table QR, update stored table number
        localStorage.setItem(`table_number_${slug}`, tableParam);
      } else {
        // If customer accessed generic menu URL (without QR table param), clear previous table session
        localStorage.removeItem(`table_number_${slug}`);
      }
    }

    const saved = localStorage.getItem(`cart_${slug}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setCart(new Map(Object.entries(parsed)));
      } catch { }
    }
  }, [slug]);

  // Save cart to localStorage
  const saveCart = useCallback((newCart: Map<string, CartItem>) => {
    if (!slug) return;
    const obj: Record<string, CartItem> = {};
    newCart.forEach((v, k) => { obj[k] = v; });
    localStorage.setItem(`cart_${slug}`, JSON.stringify(obj));
    setCart(new Map(newCart));
  }, [slug]);

  // Fetch products & Service Status
  useEffect(() => {
    const initPage = async () => {
      try {
        const currentSlug = Array.isArray(slug) ? slug[0] : (slug || '');
        // Fetch products and categories in parallel
        const [res, catRes] = await Promise.all([
          productService.getProducts(),
          fetch('/api/categories', {
            headers: { 'x-restaurant-slug': currentSlug },
            cache: 'no-store'
          }).then(r => r.json()).catch(() => ({ success: false, data: [] }))
        ]);

        if (res.success && res.data) {
          const parsedData = res.data.map((p: any) => ({
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

  // Keep cart aligned with latest product availability and details.
  useEffect(() => {
    if (products.length === 0 || cart.size === 0) return;

    const byId = new Map(products.map((p) => [p.id, p]));
    const newCart = new Map(cart);
    const removedNames: string[] = [];
    let changed = false;

    for (const [key, item] of cart.entries()) {
      const productId = item.product_id || key;
      const product = byId.get(productId);

      if (!product) {
        newCart.delete(key);
        removedNames.push(item.name);
        changed = true;
        continue;
      }

      const pStatus = showOrdering
        ? ((product.stock_quantity ?? 0) <= 0 ? 'OUT_OF_STOCK' : (product.stock_quantity ?? 0) <= (product.buffer_quantity ?? 0) ? 'LOW_STOCK' : 'AVAILABLE')
        : product.status;

      if (pStatus === 'OUT_OF_STOCK') {
        newCart.delete(key);
        removedNames.push(item.name);
        changed = true;
        continue;
      }

      const hasCust = item.selected_variant || (item.selected_customizations && item.selected_customizations.length > 0);
      const updatedPrice = hasCust ? item.price : product.price;

      if (
        item.status !== pStatus ||
        item.price !== updatedPrice ||
        item.name !== product.name ||
        item.image_url !== product.image_url
      ) {
        newCart.set(key, {
          ...item,
          status: pStatus,
          price: updatedPrice,
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
  }, [products, cart, saveCart, showOrdering]);

  const handleUpdate = (id: string, delta: number) => {
    const product = products.find(p => p.id === id);
    if (!product) return;

    const isCustomizable = Boolean(
      product.has_customizations ||
      (Array.isArray(product.variants) && product.variants.length > 0) ||
      (Array.isArray(product.customization_groups) && product.customization_groups.length > 0)
    );

    if (isCustomizable && delta > 0) {
      setCustomizingProduct(product);
      return;
    }

    const pStatus = showOrdering
      ? ((product.stock_quantity ?? 0) <= 0 ? 'OUT_OF_STOCK' : (product.stock_quantity ?? 0) <= (product.buffer_quantity ?? 0) ? 'LOW_STOCK' : 'AVAILABLE')
      : product.status;

    const currentStock = typeof product.stock_quantity === 'number' ? product.stock_quantity : null;

    if (delta > 0 && (pStatus === 'OUT_OF_STOCK' || (currentStock !== null && currentStock <= 0))) {
      toast.error(`"${product.name}" is out of stock (0 available)`);
      return;
    }

    const newCart = new Map(cart);

    if (delta < 0) {
      // Find matching items for this product
      const matching = Array.from(newCart.entries()).filter(([_, item]) => (item.product_id || _) === id);
      if (matching.length === 0) return;
      const [targetKey, targetItem] = matching[matching.length - 1];
      const newQty = targetItem.quantity + delta;
      if (newQty <= 0) {
        newCart.delete(targetKey);
      } else {
        newCart.set(targetKey, { ...targetItem, quantity: newQty });
      }
      saveCart(newCart);
      return;
    }

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
        cart_item_key: id,
        name: product.name,
        price: product.price,
        quantity: Math.min(newQty, 10),
        image_url: product.image_url,
        status: pStatus,
      });
    }
    saveCart(newCart);
  };

  const handleCustomizationConfirm = (result: ProductCustomizationResult) => {
    const { product, selected_variant, selected_customizations, customization_summary, quantity, notes, total_unit_price } = result;

    const variantId = selected_variant ? selected_variant.id : 'base';
    const custKeys = (selected_customizations || []).map((c: SelectedCustomizationSnapshot) => c.option_id).sort().join('_');
    const cartItemKey = `${product.id}:::${variantId}:::${custKeys}`;

    const newCart = new Map(cart);
    const existing = newCart.get(cartItemKey);
    const newQty = (existing?.quantity || 0) + quantity;

    newCart.set(cartItemKey, {
      product_id: product.id,
      cart_item_key: cartItemKey,
      name: product.name,
      price: total_unit_price,
      quantity: Math.min(newQty, 10),
      image_url: product.image_url,
      status: product.status,
      selected_variant: selected_variant || undefined,
      selected_customizations: selected_customizations,
      customization_summary: customization_summary,
      notes: notes || undefined,
      item_note: notes || undefined,
    });

    saveCart(newCart);
    setCustomizingProduct(null);
    toast.success(`Added ${product.name} to cart`);
  };

  const getProductQuantity = (productId: string) => {
    let count = 0;
    cart.forEach((item, key) => {
      if ((item.product_id || key) === productId) {
        count += item.quantity;
      }
    });
    return count;
  };

  const totalItems = Array.from(cart.values()).reduce((s, i) => s + i.quantity, 0);
  const totalPrice = Array.from(cart.values()).reduce((s, i) => s + i.price * i.quantity, 0);

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

  if (restaurantLoading || loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
        <div className="loader" />
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
      <link rel="manifest" href={`/api/manifest?slug=${slug}&type=customer`} />
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

        {/* Dietary Preference Filter (Veg / Non-Veg / All) */}
        <div style={{ padding: '0 16px 10px', display: 'flex', alignItems: 'center', gap: '8px', overflowX: 'auto', scrollbarWidth: 'none' }}>
          <DietaryFilter variant="pills" value={dietaryFilter} onChange={setDietaryFilter} />
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
                  quantity={getProductQuantity(product.id)}
                  onUpdate={isServiceActive ? handleUpdate : () => toast.error('Service is not started')}
                  onCustomize={isServiceActive ? setCustomizingProduct : () => toast.error('Service is not started')}
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
          bottom: 0,
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
              position: "fixed",
              left: "50%",
              transform: "translateX(-50%)",
              bottom: "16px",
              width: "calc(100% - 32px)",
              maxWidth: "410px",
              padding: '4px 20px 4px 6px',
              display: "flex",
              justifyContent: "space-between",
              zIndex: 1000,
              pointerEvents: "auto",
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
            <span style={{ fontWeight: 700, fontSize: '16px', color: 'white' }}>Continue →</span>
            <span style={{ fontWeight: 800, fontSize: '16px', color: 'white' }}>{formatPrice(totalPrice)}</span>
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

      {/* Product Customization Modal */}
      <ProductCustomizationModal
        isOpen={Boolean(customizingProduct)}
        product={customizingProduct}
        onClose={() => setCustomizingProduct(null)}
        onConfirm={handleCustomizationConfirm}
      />

    </div>
  );
}
