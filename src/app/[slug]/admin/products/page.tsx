'use client';
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Product, ProductStatus } from '@/types';
import { formatPrice } from '@/lib/format';
import { productService } from '@/app/services/products.api';
import { AdminContentWrapper } from '@/components/AdminContentWrapper';
import { AdminPageHeader } from '@/components/AdminPageHeader';
import { useParams } from 'next/navigation';
import { useRestaurant } from '@/hooks/useRestaurant';
import { UploadCloud, X, Loader2, Plus, Sparkles, Trash2, Store, ChefHat, Boxes, Layers, ArrowUpDown, Search, Utensils } from 'lucide-react';
import AdminProductForm from '@/components/AdminProductForm';
import { CounterDrawer } from '@/components/CounterDrawer';
import { DietaryFilter, DietaryPreferenceFilter } from '@/components/ui/DietaryFilter';
import { CategoryReorderModal } from '@/components/modules/products/CategoryReorderModal';
import { LayoutMaximizeToggle } from '@/components/LayoutMaximizeToggle';

interface ExtractedProduct {
  id: string;
  name: string;
  category: string;
  price: number;
  description: string;
  dietary_preference: string;
  selected: boolean;
}

function ProductImageThumbnail({ src, alt, size = 40 }: { src?: string; alt: string; size?: number }) {
  const [error, setError] = useState(false);

  if (!src || error) {
    return (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: 8,
          background: '#F1F5F9',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          border: '1px solid #E2E8F0',
          color: '#64748B',
        }}
      >
        <Utensils size={Math.max(14, Math.round(size * 0.42))} strokeWidth={2} />
      </div>
    );
  }

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 8,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        overflow: 'hidden',
        border: '1px solid var(--border)',
        background: '#FFFFFF',
      }}
    >
      <img
        src={src}
        alt={alt}
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        onError={() => setError(true)}
      />
    </div>
  );
}

export default function AdminProducts() {
  const { restaurant } = useRestaurant();
  const showOnlineOrdering = restaurant?.modules?.ONLINE_ORDERING !== false;
  const showInventory = restaurant?.modules?.INVENTORY === true;
  const { slug } = useParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dietaryFilter, setDietaryFilter] = useState<DietaryPreferenceFilter>('ALL');

  // Delete Confirmation Modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // AI Menu Upload Modal state
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiExtracting, setAiExtracting] = useState(false);
  const [extractedProducts, setExtractedProducts] = useState<ExtractedProduct[]>([]);
  const [aiSaving, setAiSaving] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [aiEnabled, setAiEnabled] = useState(true);
  const [aiDisabledReason, setAiDisabledReason] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Product Form Modal state (Add / Edit)
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Counter Drawer state (Manage / Add Counters)
  const [counterDrawerOpen, setCounterDrawerOpen] = useState(false);

  // Category Reorder Modal state
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const res = await productService.getAllProductsAdmin();
      if (res.success && res.data) setProducts(res.data);
    } catch {
      toast.error('Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  // Check global AI status when modal opens or on mount
  useEffect(() => {
    async function checkAiStatus() {
      try {
        const res = await fetch('/api/ai/status', { cache: 'no-store' });
        const data = await res.json();
        if (data.success) {
          setAiEnabled(data.is_enabled);
          setAiDisabledReason(data.disabled_reason || null);
        }
      } catch (err) {
        console.error('Failed to check AI status:', err);
      }
    }
    checkAiStatus();
  }, [aiModalOpen]);

  const handleToggleStatus = async (id: string, currentStatus: ProductStatus) => {
    const nextStatus: ProductStatus = currentStatus === 'AVAILABLE' ? 'OUT_OF_STOCK' : 'AVAILABLE';
    
    // Optimistic UI Update
    setProducts(prevProducts =>
      prevProducts.map(p =>
        p.id === id ? { ...p, status: nextStatus } : p
      )
    );
    
    try {
      const res = await productService.updateProduct(id, { status: nextStatus });
      if (res.success) {
        toast.success(`Product marked as ${nextStatus === 'AVAILABLE' ? 'available' : 'out of stock'}`);
      } else {
        throw new Error(res.error || 'Failed to update status');
      }
    } catch (err: any) {
      // Revert Optimistic Update
      setProducts(prevProducts =>
        prevProducts.map(p =>
          p.id === id ? { ...p, status: currentStatus } : p
        )
      );
      toast.error(err.message || 'Failed to update product status');
    }
  };

  const handleDeleteClick = (product: Product) => {
    setDeletingProduct(product);
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deletingProduct) return;
    setIsDeleting(true);
    try {
      const res = await productService.deleteProduct(deletingProduct.id);
      if (res.success) {
        toast.success(`"${deletingProduct.name}" deleted successfully`);
        setDeleteModalOpen(false);
        setDeletingProduct(null);
        fetchProducts();
      } else {
        toast.error(res.error || 'Failed to delete product');
      }
    } catch {
      toast.error('Failed to delete product');
    } finally {
      setIsDeleting(false);
    }
  };

  // Handle AI Menu Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const processFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload a valid image file (JPEG, PNG, WebP).');
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      await processMenuImage(base64);
    };
    reader.readAsDataURL(file);
  };

  const processMenuImage = async (imageBase64: string) => {
    setAiExtracting(true);
    try {
      const res = await fetch('/api/ai/upload-menu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurant_id: restaurant?.id,
          slug,
          image: imageBase64
        })
      });

      const data = await res.json();

      if (!data.success) {
        if (data.code === 'GEMINI_DAILY_LIMIT_REACHED') {
          toast.error(data.message || 'Menu processing is temporarily unavailable. Please try again later.');
        } else {
          toast.error(data.message || 'Failed to extract menu from image.');
        }
        return;
      }

      const items = (data.products || []).map((p: any, idx: number) => ({
        id: `extracted-${idx}-${Date.now()}`,
        name: p.name || 'Unnamed Item',
        category: p.category || 'General',
        price: parseFloat(p.price) || 0,
        description: p.description || '',
        dietary_preference: (p.dietary_preference === 'NON_VEG' || p.dietary_preference === 'NON-VEG') ? 'NON_VEG' : 'VEG',
        selected: true
      }));

      if (items.length === 0) {
        toast.error('No readable items found in the menu image.');
      } else {
        toast.success(`Extracted ${items.length} menu items successfully!`);
        setExtractedProducts(items);
      }
    } catch (err: any) {
      toast.error('Network error while processing menu image.');
    } finally {
      setAiExtracting(false);
    }
  };

  const handleToggleSelectItem = (id: string) => {
    setExtractedProducts(prev =>
      prev.map(item => item.id === id ? { ...item, selected: !item.selected } : item)
    );
  };

  const handleSelectAll = (select: boolean) => {
    setExtractedProducts(prev => prev.map(item => ({ ...item, selected: select })));
  };

  const handleUpdateExtractedItem = (id: string, field: string, value: any) => {
    setExtractedProducts(prev =>
      prev.map(item => item.id === id ? { ...item, [field]: value } : item)
    );
  };

  const handleBulkAddProducts = async () => {
    const selected = extractedProducts.filter(p => p.selected);
    if (selected.length === 0) {
      toast.error('Please select at least one item to import.');
      return;
    }

    setAiSaving(true);
    let successCount = 0;

    for (const item of selected) {
      try {
        const itemPrice = parseFloat(String(item.price));
        const cleanPrice = isNaN(itemPrice) ? 0 : Math.round(itemPrice * 100) / 100;

        const payload = {
          name: item.name,
          category: item.category,
          price: cleanPrice,
          description: item.description,
          dietary_preference: item.dietary_preference || 'VEG',
          status: 'AVAILABLE' as ProductStatus,
          is_vegetarian: item.dietary_preference === 'VEG',
          preparation_time: 15
        };
        const res = await productService.createProduct(payload);
        if (res.success) successCount++;
      } catch {
        console.error(`Failed to create product: ${item.name}`);
      }
    }

    setAiSaving(false);
    toast.success(`Successfully imported ${successCount} products into inventory!`);
    setAiModalOpen(false);
    setExtractedProducts([]);
    fetchProducts();
  };

  const primaryColor = restaurant?.primary_color || '#800020';

  const filtered = products.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.category.toLowerCase().includes(search.toLowerCase());
    const pref = p.dietary_preference || 'NON_VEG';
    const matchDietary = dietaryFilter === 'ALL' || (dietaryFilter === 'VEG' ? pref === 'VEG' : pref === 'NON_VEG');
    return matchSearch && matchDietary;
  });

  return (
    <AdminContentWrapper fullWidth style={{ paddingTop: 0, paddingLeft: 0, paddingRight: 0, maxWidth: '100%' }}>
      <style>{`
        @keyframes iconPulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.22); opacity: 0.85; }
        }
        @keyframes spinLoader {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        /* Header toolbar styling */
        .products-page-header {
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

        .products-page-header .admin-page-header-container {
          height: 68px !important;
          min-height: 68px !important;
          display: flex !important;
          align-items: center !important;
          margin: 0 !important;
          padding: 0 !important;
          gap: 12px !important;
          width: 100% !important;
        }

        .products-toolbar {
          display: flex !important;
          flex-wrap: nowrap !important;
          align-items: center !important;
          gap: 8px !important;
          width: 100% !important;
        }

        .products-search-control {
          position: relative !important;
          height: 38px !important;
        }

        .products-filters-row {
          display: flex !important;
          align-items: center !important;
          gap: 0 !important;
        }

        .products-dietary-wrapper {
          border-left: 1px solid #E2E8F0;
          padding-left: 8px;
          display: flex;
          align-items: center;
          height: 32px;
          flex-shrink: 0;
        }

        .products-reorder-btn-wrapper {
          border-left: 1px solid #E2E8F0;
          padding-left: 8px;
          display: flex;
          align-items: center;
          height: 32px;
          flex-shrink: 0;
        }

        .products-reorder-btn {
          width: 38px;
          height: 38px;
          padding: 0;
          border-radius: 8px;
          border: 1px solid var(--border, #cbd5e1);
          background-color: #FFFFFF;
          color: var(--primary, #0f172a);
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
          transition: all 0.15s ease;
          flex-shrink: 0;
        }

        .products-actions {
          display: flex !important;
          flex-wrap: nowrap !important;
          align-items: center !important;
          gap: 8px !important;
          margin-left: auto !important;
          flex-shrink: 0 !important;
        }

        .products-table-scroll-hint {
          display: none;
        }

        .products-mobile-card-list {
          display: none !important;
        }

        /* Mobile Screens: Compact structured toolbar & native card list below 768px */
        @media (max-width: 768px) {
          .products-page-header,
          .products-page-header.admin-page-header-container,
          .products-page-header .admin-page-header-container {
            height: auto !important;
            min-height: auto !important;
            padding: 12px 14px !important;
          }

          .products-page-header .admin-header-left,
          .products-page-header .admin-header-search {
            height: auto !important;
            min-height: auto !important;
            width: 100% !important;
          }

          .products-toolbar {
            display: flex !important;
            flex-direction: column !important;
            flex-wrap: wrap !important;
            align-items: stretch !important;
            gap: 10px !important;
            width: 100% !important;
          }

          .products-search-control {
            flex: none !important;
            height: 38px !important;
            width: 100% !important;
            max-width: 100% !important;
            min-width: 0 !important;
          }

          .products-filters-row {
            display: flex !important;
            align-items: center !important;
            justify-content: space-between !important;
            width: 100% !important;
            gap: 8px !important;
          }

          .products-dietary-wrapper {
            border-left: none !important;
            padding-left: 0 !important;
            height: auto !important;
            flex: 1 !important;
          }

          .products-dietary-wrapper .dietary-filter-container {
            width: 100% !important;
            display: flex !important;
          }

          .products-dietary-wrapper .dietary-filter-container button {
            flex: 1 !important;
            justify-content: center !important;
            padding: 6px 8px !important;
            font-size: 12px !important;
          }

          .products-reorder-btn-wrapper {
            border-left: none !important;
            padding-left: 0 !important;
            height: auto !important;
            flex-shrink: 0 !important;
          }

          .products-actions {
            display: grid !important;
            grid-template-columns: 1fr 1fr !important;
            gap: 8px !important;
            width: 100% !important;
            margin-left: 0 !important;
          }

          .products-upload-btn,
          .products-counters-btn {
            width: 100% !important;
            height: 38px !important;
            justify-content: center !important;
          }

          .products-add-btn {
            grid-column: 1 / -1 !important;
            width: 100% !important;
            height: 40px !important;
            justify-content: center !important;
            font-size: 13px !important;
          }

          .products-maximize-wrapper {
            display: none !important;
          }

          /* Hide desktop table and scroll hint on mobile */
          .products-table-viewport {
            display: none !important;
          }

          .products-table-scroll-hint {
            display: none !important;
          }

          /* Show mobile card list */
          .products-mobile-card-list {
            display: flex !important;
            flex-direction: column !important;
            width: 100% !important;
          }
        }

        /* Desktop & Tablet Table scrolling and sizing */
        .products-table-card {
          width: 100% !important;
          max-width: 100% !important;
          overflow-x: auto !important;
        }

        .products-table-viewport {
          width: 100% !important;
          max-width: 100% !important;
          overflow-x: auto !important;
          -webkit-overflow-scrolling: touch !important;
        }

        .products-table {
          width: 100% !important;
          min-width: 800px !important;
        }

        @media (min-width: 769px) and (max-width: 1120px) {
          .products-table th,
          .products-table td {
            padding: 10px 10px !important;
            font-size: 13px !important;
          }

          .products-table .product-desc {
            max-width: 140px !important;
          }
        }
      `}</style>
      <AdminPageHeader
        className="products-page-header"
        style={{ paddingTop: 0, minHeight: '68px', display: 'flex', alignItems: 'center', marginBottom: 0 }}
        hideMaximize={true}
        search={
          <div className="products-toolbar" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'nowrap', width: '100%', minWidth: 0 }}>
            {/* Search Input */}
            <div className="products-search-control" style={{ position: 'relative', width: '240px', flex: '0 0 240px', minWidth: '140px', maxWidth: '300px', flexShrink: 0 }}>
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
                placeholder="Search products..."
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

            {/* Filters Row: Dietary & Reorder */}
            <div className="products-filters-row">
              <div className="products-dietary-wrapper">
                <DietaryFilter value={dietaryFilter} onChange={setDietaryFilter} />
              </div>

              <div className="products-reorder-btn-wrapper">
                <button
                  type="button"
                  onClick={() => setCategoryModalOpen(true)}
                  title="Reorder Categories"
                  className="products-reorder-btn"
                >
                  <ArrowUpDown size={15} style={{ color: 'var(--primary, #0f172a)' }} />
                </button>
              </div>
            </div>

            {/* Right Action Buttons */}
            <div className="products-actions">
              {/* Upload Menu */}
              <button
                type="button"
                className="products-upload-btn"
                onClick={() => {
                  if (!aiEnabled) {
                    toast.error(aiDisabledReason || 'AI Menu Scanner is currently disabled by administrator.');
                    return;
                  }
                  setExtractedProducts([]);
                  setAiModalOpen(true);
                }}
                title={!aiEnabled ? (aiDisabledReason || 'AI Menu Scanner is currently disabled') : 'Upload Menu Image'}
                style={{
                  height: '38px',
                  padding: '0 14px',
                  borderRadius: '8px',
                  backgroundColor: aiEnabled ? 'var(--primary, #0f172a)' : '#475569',
                  opacity: aiEnabled ? 1 : 0.6,
                  color: '#ffffff',
                  border: 'none',
                  fontWeight: 700,
                  fontSize: '12px',
                  cursor: aiEnabled ? 'pointer' : 'not-allowed',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: aiEnabled ? '0 1px 2px rgba(0, 0, 0, 0.08)' : 'none',
                  transition: 'all 0.15s ease',
                  whiteSpace: 'nowrap',
                }}
              >
                <Sparkles size={14} style={{ color: aiEnabled ? '#ffffff' : '#cbd5e1', animation: aiEnabled ? 'iconPulse 2s infinite ease-in-out' : 'none' }} />
                <span>Upload Menu</span>
              </button>

              {/* Counters Drawer */}
              <button
                type="button"
                className="products-counters-btn"
                onClick={() => setCounterDrawerOpen(true)}
                style={{
                  height: '38px',
                  padding: '0 12px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--primary, #0f172a)',
                  color: '#ffffff',
                  border: 'none',
                  fontWeight: 700,
                  fontSize: '12px',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: aiEnabled ? '0 1px 2px rgba(0, 0, 0, 0.08)' : 'none',
                  transition: 'all 0.15s ease',
                  whiteSpace: 'nowrap',
                }}
              >
                <Store size={15} style={{ color: '#ffffff' }} />
                <span>Counters</span>
              </button>

              {/* Add Product */}
              <button
                type="button"
                onClick={() => {
                  setEditingProduct(null);
                  setFormModalOpen(true);
                }}
                className="btn btn-primary products-add-btn"
                style={{
                  height: '38px',
                  padding: '0 14px',
                  borderRadius: '8px',
                  fontWeight: 700,
                  fontSize: '12px',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  whiteSpace: 'nowrap',
                  background: primaryColor,
                  borderColor: primaryColor,
                }}
              >
                <Plus size={15} />
                <span>Add Product</span>
              </button>

              {/* Maximize Layout Toggle */}
              <div className="products-maximize-wrapper">
                <LayoutMaximizeToggle />
              </div>
            </div>
          </div>
        }
      />

      <div
        className="card products-table-card"
        style={{
          width: '100%',
          maxWidth: '100%',
          padding: 0,
          margin: 0,
          overflowX: 'auto',
          overflowY: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          borderRadius: 0,
          border: 'none',
          boxShadow: 'none',
          background: '#FFFFFF',
        }}
      >
        {/* Desktop Table View */}
        <div className="table-wrapper products-table-viewport" style={{ border: 'none', borderRadius: 0, width: '100%', flex: 1, overflowX: 'auto' }}>
          {loading ? (
            <div style={{ padding: '40px', display: 'flex', justifyContent: 'center' }}><div className="loader" /></div>
          ) : (
            <table className="products-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Category</th>
                  <th>Counter</th>
                  <th>Price</th>
                  {showOnlineOrdering && <th>Stock / Buffer</th>}
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => (
                  <tr key={p.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <ProductImageThumbnail src={p.image_url} alt={p.name} size={40} />
                        <div>
                          <strong style={{ fontWeight: 600, display: 'block' }}>{p.name}</strong>
                          <span className="product-desc" style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {p.description}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td>{p.category}</td>
                    <td>
                      {p.counter ? (
                        <span style={{ padding: '4px 8px', backgroundColor: '#f1f5f9', borderRadius: '4px', fontSize: '12px', fontWeight: 600, color: '#334155' }}>
                          {p.counter}
                        </span>
                      ) : (
                        <span style={{ fontSize: '12px', color: '#94a3b8' }}>Unassigned</span>
                      )}
                    </td>
                    <td style={{ fontWeight: 600 }}>{formatPrice(p.price)}</td>
                    {showOnlineOrdering && (
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontWeight: 700, fontSize: '15px' }}>{p.stock_quantity}</span>
                          <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>/</span>
                          <span style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>{p.buffer_quantity}</span>
                        </div>
                      </td>
                    )}
                    <td>
                      {!showOnlineOrdering ? (
                        <button
                          onClick={() => handleToggleStatus(p.id, p.status)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            padding: 0,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '10px',
                            outline: 'none'
                          }}
                          title={`Click to mark as ${p.status === 'AVAILABLE' ? 'Out of Stock' : 'Available'}`}
                        >
                          <div style={{
                            position: 'relative',
                            width: '38px',
                            height: '20px',
                            background: p.status === 'AVAILABLE' ? '#10b981' : '#cbd5e1',
                            borderRadius: '8px',
                            transition: 'background-color 0.2s ease',
                            cursor: 'pointer'
                          }}>
                            <div style={{
                              position: 'absolute',
                              top: '2px',
                              left: p.status === 'AVAILABLE' ? '20px' : '2px',
                              width: '16px',
                              height: '16px',
                              background: 'white',
                              borderRadius: '50%',
                              boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
                              transition: 'left 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                            }} />
                          </div>
                          <span className={`badge badge-${p.status.toLowerCase().replace(/_/g, '-')}`} style={{ margin: 0, cursor: 'pointer' }}>
                            {p.status.replace(/_/g, ' ')}
                          </span>
                        </button>
                      ) : (
                        <span className={`badge badge-${p.status.toLowerCase().replace(/_/g, '-')}`} style={{ margin: 0 }}>
                          {p.status.replace(/_/g, ' ')}
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => {
                            setEditingProduct(p);
                            setFormModalOpen(true);
                          }}
                        >
                          Edit
                        </button>
                        <button className="btn btn-danger btn-sm" onClick={() => handleDeleteClick(p)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={showOnlineOrdering ? 7 : 6} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>No products found</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Mobile Product Cards View */}
        <div className="products-mobile-card-list">
          {loading ? (
            <div style={{ padding: '40px', display: 'flex', justifyContent: 'center' }}><div className="loader" /></div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px' }}>
              No products found matching your filters
            </div>
          ) : (
            filtered.map((p) => (
              <div
                key={p.id}
                className="product-mobile-card"
                style={{
                  background: '#FFFFFF',
                  borderBottom: '1px solid var(--border)',
                  padding: '12px 14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}
              >
                {/* Top Row: Thumbnail + Details + Price */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                  <ProductImageThumbnail src={p.image_url} alt={p.name} size={46} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '8px' }}>
                      <strong style={{ fontSize: '14px', fontWeight: 600, color: '#0F172A', lineHeight: 1.3 }}>
                        {p.name}
                      </strong>
                      <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', flexShrink: 0 }}>
                        {formatPrice(p.price)}
                      </span>
                    </div>

                    {p.description && (
                      <p style={{ margin: '2px 0 6px 0', fontSize: '11.5px', color: '#64748B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {p.description}
                      </p>
                    )}

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginTop: p.description ? 0 : '4px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 600, color: '#475569', background: '#F1F5F9', padding: '2px 7px', borderRadius: '4px' }}>
                        {p.category}
                      </span>
                      {p.counter && (
                        <span style={{ fontSize: '11px', fontWeight: 600, color: '#0369A1', background: '#E0F2FE', padding: '2px 7px', borderRadius: '4px' }}>
                          {p.counter}
                        </span>
                      )}
                      {showOnlineOrdering && (
                        <span style={{ fontSize: '11px', color: '#64748B', marginLeft: 'auto' }}>
                          Stock: <strong>{p.stock_quantity}</strong> / {p.buffer_quantity}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Bottom Row: Availability Status Toggle + Actions */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingTop: '8px',
                    borderTop: '1px solid #F1F5F9',
                  }}
                >
                  <div>
                    {!showOnlineOrdering ? (
                      <button
                        onClick={() => handleToggleStatus(p.id, p.status)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          padding: 0,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '8px',
                          outline: 'none',
                        }}
                        title={`Click to mark as ${p.status === 'AVAILABLE' ? 'Out of Stock' : 'Available'}`}
                      >
                        <div
                          style={{
                            position: 'relative',
                            width: '36px',
                            height: '20px',
                            background: p.status === 'AVAILABLE' ? '#10B981' : '#CBD5E1',
                            borderRadius: '10px',
                            transition: 'background-color 0.2s ease',
                          }}
                        >
                          <div
                            style={{
                              position: 'absolute',
                              top: '2px',
                              left: p.status === 'AVAILABLE' ? '18px' : '2px',
                              width: '16px',
                              height: '16px',
                              background: 'white',
                              borderRadius: '50%',
                              boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
                              transition: 'left 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                            }}
                          />
                        </div>
                        <span
                          className={`badge badge-${p.status.toLowerCase().replace(/_/g, '-')}`}
                          style={{ margin: 0, fontSize: '11px', padding: '2px 8px' }}
                        >
                          {p.status.replace(/_/g, ' ')}
                        </span>
                      </button>
                    ) : (
                      <span
                        className={`badge badge-${p.status.toLowerCase().replace(/_/g, '-')}`}
                        style={{ margin: 0, fontSize: '11px', padding: '2px 8px' }}
                      >
                        {p.status.replace(/_/g, ' ')}
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      style={{ height: '30px', padding: '0 12px', fontSize: '12px', borderRadius: '6px' }}
                      onClick={() => {
                        setEditingProduct(p);
                        setFormModalOpen(true);
                      }}
                    >
                      Edit
                    </button>
                    <button
                      className="btn btn-danger btn-sm"
                      style={{ height: '30px', padding: '0 10px', fontSize: '12px', borderRadius: '6px' }}
                      onClick={() => handleDeleteClick(p)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Upload Menu Modal */}
      {aiModalOpen && mounted && createPortal(
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 99999,
          padding: '20px'
        }} onClick={() => setAiModalOpen(false)}>
          
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '8px',
            width: '100%',
            maxWidth: '900px',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.2)',
            border: '1px solid #e2e8f0'
          }} onClick={e => e.stopPropagation()}>
            
            {/* Modal Header */}
            <div style={{
              padding: '20px 24px',
              backgroundColor: '#ffffff',
              borderBottom: '1px solid #f1f5f9',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: 800, margin: 0, color: '#0f172a' }}>
                  Upload Menu Image
                </h2>
                <p style={{ fontSize: '13px', color: '#64748b', margin: '2px 0 0 0' }}>
                  Upload your printed menu photo to extract and import items automatically.
                </p>
              </div>
              <button
                onClick={() => setAiModalOpen(false)}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  color: '#64748b',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer'
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Content Body */}
            <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>

              {/* Upload Dropzone */}
              {extractedProducts.length === 0 && !aiExtracting && (
                <div
                  onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
                  onDragLeave={() => setIsDragOver(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    border: `2px dashed ${isDragOver ? '#0f172a' : '#cbd5e1'}`,
                    borderRadius: '8px',
                    padding: '50px 24px',
                    textAlign: 'center',
                    backgroundColor: isDragOver ? '#f1f5f9' : '#f8fafc',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease-in-out'
                  }}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept="image/jpeg,image/png,image/webp"
                    style={{ display: 'none' }}
                  />
                  <div style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '8px',
                    backgroundColor: '#e2e8f0',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '14px',
                    color: '#0f172a'
                  }}>
                    <UploadCloud size={28} />
                  </div>
                  <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', margin: '0 0 4px 0' }}>
                    Upload Menu Image
                  </h3>
                  <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 14px 0' }}>
                    Click to select a menu photo (JPG, PNG, WebP)
                  </p>
                  <div style={{ display: 'inline-flex', gap: '6px' }}>
                    {['JPEG', 'PNG', 'WEBP'].map(format => (
                      <span key={format} style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        padding: '3px 8px',
                        borderRadius: '6px',
                        backgroundColor: '#ffffff',
                        border: '1px solid #e2e8f0',
                        color: '#64748b'
                      }}>
                        {format}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Loading State */}
              {aiExtracting && (
                <div style={{ padding: '50px 24px', textAlign: 'center' }}>
                  <div style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '50%',
                    backgroundColor: '#f1f5f9',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '16px'
                  }}>
                    <Loader2 size={28} style={{ color: '#0f172a', animation: 'spinLoader 1s linear infinite' }} />
                  </div>
                  <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', margin: '0 0 6px 0' }}>
                    Processing Menu Image...
                  </h3>
                  <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>
                    Extracting items, categories, prices, and descriptions...
                  </p>
                </div>
              )}

              {/* Extracted Product List Preview Table */}
              {extractedProducts.length > 0 && !aiExtracting && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                    <div>
                      <h4 style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                        Review Extracted Products
                      </h4>
                      <span style={{ fontSize: '12px', color: '#64748b' }}>
                        {extractedProducts.filter(p => p.selected).length} of {extractedProducts.length} items selected for import
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <button
                        onClick={() => handleSelectAll(true)}
                        style={{ fontSize: '12px', fontWeight: 800, color: '#0f172a', background: '#f1f5f9', border: '1px solid #cbd5e1', padding: '6px 14px', borderRadius: '8px', cursor: 'pointer' }}
                      >
                        Select All
                      </button>
                      <button
                        onClick={() => handleSelectAll(false)}
                        style={{ fontSize: '12px', fontWeight: 800, color: '#0f172a', background: '#ffffff', border: '1px solid #cbd5e1', padding: '6px 14px', borderRadius: '8px', cursor: 'pointer' }}
                      >
                        Deselect All
                      </button>
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        style={{ fontSize: '12px', fontWeight: 800, color: '#0f172a', background: '#ffffff', border: '1px solid #cbd5e1', padding: '6px 14px', borderRadius: '8px', cursor: 'pointer' }}
                      >
                        + Scan Another Image
                      </button>
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileUpload}
                        accept="image/jpeg,image/png,image/webp"
                        style={{ display: 'none' }}
                      />
                    </div>
                  </div>

                  <div style={{ maxHeight: '380px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 700, textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.04em' }}>
                          <th style={{ padding: '12px', width: '44px', textAlign: 'center' }}>Import</th>
                          <th style={{ padding: '12px', width: '22%' }}>Product Name</th>
                          <th style={{ padding: '12px', width: '18%' }}>Category</th>
                          <th style={{ padding: '12px', width: '15%' }}>Type</th>
                          <th style={{ padding: '12px', width: '14%' }}>Price (₹)</th>
                          <th style={{ padding: '12px' }}>Description</th>
                        </tr>
                      </thead>
                      <tbody>
                        {extractedProducts.map(item => (
                          <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: item.selected ? '#ffffff' : '#f8fafc', opacity: item.selected ? 1 : 0.6 }}>
                            <td style={{ padding: '12px', textAlign: 'center' }}>
                              <input
                                type="checkbox"
                                checked={item.selected}
                                onChange={() => handleToggleSelectItem(item.id)}
                                style={{ cursor: 'pointer', width: '17px', height: '17px', accentColor: '#0f172a' }}
                              />
                            </td>
                            <td style={{ padding: '10px 12px' }}>
                              <input
                                type="text"
                                value={item.name}
                                onChange={e => handleUpdateExtractedItem(item.id, 'name', e.target.value)}
                                style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', fontWeight: 600 }}
                              />
                            </td>
                            <td style={{ padding: '10px 12px' }}>
                              <input
                                type="text"
                                value={item.category}
                                onChange={e => handleUpdateExtractedItem(item.id, 'category', e.target.value)}
                                style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                              />
                            </td>
                            <td style={{ padding: '10px 12px' }}>
                              <select
                                value={item.dietary_preference}
                                onChange={e => handleUpdateExtractedItem(item.id, 'dietary_preference', e.target.value)}
                                style={{ width: '100%', padding: '8px 8px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12px', fontWeight: 600, color: item.dietary_preference === 'VEG' ? '#16a34a' : '#dc2626' }}
                              >
                                <option value="VEG">🟢 Veg</option>
                                <option value="NON_VEG">🔴 Non-Veg</option>
                              </select>
                            </td>
                            <td style={{ padding: '10px 12px' }}>
                              <input
                                type="number"
                                step="0.01"
                                value={item.price}
                                onWheel={(e) => (e.target as HTMLInputElement).blur()}
                                onChange={e => handleUpdateExtractedItem(item.id, 'price', e.target.value === '' ? '' : parseFloat(e.target.value))}
                                style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', fontWeight: 700, color: '#0f172a' }}
                              />
                            </td>
                            <td style={{ padding: '10px 12px' }}>
                              <input
                                type="text"
                                value={item.description || ''}
                                placeholder="Enter the product description..."
                                onChange={e => handleUpdateExtractedItem(item.id, 'description', e.target.value)}
                                style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12px', color: '#334155' }}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                </div>
              )}

            </div>

            {/* Footer Bar */}
            {extractedProducts.length > 0 && !aiExtracting && (
              <div style={{
                padding: '16px 24px',
                borderTop: '1px solid #e2e8f0',
                backgroundColor: '#f8fafc',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 500 }}>
                  Ready to import {extractedProducts.filter(p => p.selected).length} products into your menu inventory.
                </span>

                <div style={{ display: 'flex', gap: '12px' }}>
                  <button
                    onClick={() => setAiModalOpen(false)}
                    style={{
                      padding: '10px 18px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      backgroundColor: '#ffffff',
                      color: '#475569',
                      fontWeight: 700,
                      fontSize: '13px',
                      cursor: 'pointer'
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleBulkAddProducts}
                    disabled={aiSaving}
                    style={{
                      padding: '10px 22px',
                      borderRadius: '8px',
                      border: 'none',
                      backgroundColor: 'var(--primary, #971345)',
                      color: '#ffffff',
                      fontWeight: 700,
                      fontSize: '13px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      boxShadow: '0 2px 8px rgba(15, 23, 42, 0.15)'
                    }}
                  >
                    {aiSaving ? <Loader2 size={16} style={{ animation: 'spinLoader 1s linear infinite' }} /> : <Plus size={16} />}
                    Import Selected Products ({extractedProducts.filter(p => p.selected).length})
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>,
        document.body
      )}

      {/* Product Add / Edit Modal Popup */}
      {formModalOpen && mounted && createPortal(
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(4px)',
          zIndex: 99999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          overflowY: 'auto'
        }}>
          <div style={{
            backgroundColor: '#f8fafc',
            borderRadius: '8px',
            maxWidth: '1050px',
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            padding: '28px',
            position: 'relative'
          }}>
            <AdminProductForm
              initialData={editingProduct || undefined}
              isModal={true}
              onSuccess={() => {
                setFormModalOpen(false);
                setEditingProduct(null);
                fetchProducts();
              }}
              onCancel={() => {
                setFormModalOpen(false);
                setEditingProduct(null);
              }}
            />
          </div>
        </div>,
        document.body
      )}

      {/* Delete Confirmation Modal */}
      {deleteModalOpen && deletingProduct && mounted && createPortal(
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
            zIndex: 999999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
          onClick={() => !isDeleting && setDeleteModalOpen(false)}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '8px',
              maxWidth: '420px',
              width: '100%',
              overflow: 'hidden',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
              border: '1px solid #e2e8f0',
              position: 'relative'
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Top-Right Close Button */}
            <button
              type="button"
              onClick={() => !isDeleting && setDeleteModalOpen(false)}
              disabled={isDeleting}
              style={{
                position: 'absolute',
                top: '14px',
                right: '14px',
                width: '28px',
                height: '28px',
                borderRadius: '6px',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                color: '#64748b',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: isDeleting ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s ease'
              }}
              title="Close"
            >
              <X size={15} />
            </button>

            {/* Modal Body */}
            <div style={{ padding: '24px 24px 20px 24px', textAlign: 'center' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a', margin: '0 0 6px 0' }}>
                Delete Product?
              </h3>
              
              <p style={{ fontSize: '14px', color: '#64748b', margin: '0 0 16px 0', lineHeight: 1.5 }}>
                Are you sure you want to permanently delete this product? This cannot be undone.
              </p>

              {/* Product Preview Card */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '10px 12px',
                backgroundColor: '#f8fafc',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                textAlign: 'left'
              }}>
                <img
                  src={deletingProduct.image_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=100&h=100&fit=crop'}
                  alt={deletingProduct.name}
                  style={{ width: 40, height: 40, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: '14px', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {deletingProduct.name}
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                    {deletingProduct.category} • <strong style={{ color: '#0f172a' }}>{formatPrice(deletingProduct.price)}</strong>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div style={{
              padding: '14px 24px',
              backgroundColor: '#f8fafc',
              borderTop: '1px solid #f1f5f9',
              display: 'flex',
              gap: '10px',
              justifyContent: 'flex-end'
            }}>
              <button
                type="button"
                onClick={() => setDeleteModalOpen(false)}
                disabled={isDeleting}
                style={{
                  flex: 1,
                  padding: '9px 16px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  color: '#475569',
                  fontWeight: 600,
                  fontSize: '13px',
                  cursor: isDeleting ? 'not-allowed' : 'pointer'
                }}
              >
                Cancel
              </button>
              
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                style={{
                  flex: 1,
                  padding: '9px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: '#dc2626',
                  color: '#ffffff',
                  fontWeight: 600,
                  fontSize: '13px',
                  cursor: isDeleting ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                {isDeleting ? <Loader2 size={15} style={{ animation: 'spinLoader 1s linear infinite' }} /> : null}
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Slide-over Counters Management Drawer */}
      <CounterDrawer
        isOpen={counterDrawerOpen}
        onClose={() => setCounterDrawerOpen(false)}
        slug={Array.isArray(slug) ? slug[0] : (slug || '')}
        onCountersChange={fetchProducts}
      />

      {/* Reorder Food Categories Modal */}
      <CategoryReorderModal
        isOpen={categoryModalOpen}
        onClose={() => {
          setCategoryModalOpen(false);
          fetchProducts();
        }}
        slug={Array.isArray(slug) ? slug[0] : (slug || '')}
        onReordered={fetchProducts}
      />

    </AdminContentWrapper>
  );
}
