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
import { UploadCloud, X, Loader2, Plus, Sparkles } from 'lucide-react';

interface ExtractedProduct {
  id: string;
  name: string;
  category: string;
  price: number;
  description: string;
  dietary_preference: string;
  selected: boolean;
}

export default function AdminProducts() {
  const { restaurant } = useRestaurant();
  const showOnlineOrdering = restaurant?.modules?.ONLINE_ORDERING !== false;
  const { slug } = useParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

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

  const handleDelete = async (id: string, name?: string) => {
    if (!confirm(`Are you sure you want to delete ${name || 'this product'}?`)) return;
    try {
      const res = await productService.deleteProduct(id);
      if (res.success) {
        toast.success('Product deleted');
        fetchProducts();
      }
    } catch {
      toast.error('Failed to delete product');
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
        const payload = {
          name: item.name,
          category: item.category,
          price: Number(item.price),
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

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.category.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AdminContentWrapper>
      <AdminPageHeader
        title="Products Inventory"
        description="Manage your menu items, categories, and availability."
        action={
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <style dangerouslySetInnerHTML={{ __html: `
              @keyframes iconPulse {
                0%, 100% { transform: scale(1); opacity: 1; }
                50% { transform: scale(1.22); opacity: 0.85; }
              }
              @keyframes spinLoader {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
            `}} />
            <button
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
                height: '42px',
                padding: '0 20px',
                borderRadius: '9999px',
                backgroundColor: aiEnabled ? 'var(--primary, #0f172a)' : '#475569',
                opacity: aiEnabled ? 1 : 0.6,
                color: '#ffffff',
                border: 'none',
                fontWeight: 700,
                fontSize: '13px',
                cursor: aiEnabled ? 'pointer' : 'not-allowed',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: aiEnabled ? '0 2px 8px rgba(0, 0, 0, 0.15)' : 'none',
                transition: 'all 0.2s ease',
                whiteSpace: 'nowrap'
              }}
            >
              <Sparkles size={16} style={{ color: aiEnabled ? '#ffffff' : '#cbd5e1', animation: aiEnabled ? 'iconPulse 2s infinite ease-in-out' : 'none' }} /> Upload Menu
            </button>
            <Link
              prefetch={false}
              href={`/${slug}/admin/products/new`}
              style={{
                height: '42px',
                padding: '0 20px',
                borderRadius: '9999px',
                backgroundColor: 'var(--primary, #0f172a)',
                color: '#ffffff',
                textDecoration: 'none',
                fontWeight: 700,
                fontSize: '13px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
                whiteSpace: 'nowrap'
              }}
            >
              <Plus size={16} /> Add Product
            </Link>
          </div>
        }
      />

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '20px', borderBottom: '1px solid var(--border)' }}>
          <input
            type="search"
            className="input"
            placeholder="Search products by name or category..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ maxWidth: '400px' }}
          />
        </div>

        <div className="table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
          {loading ? (
            <div style={{ padding: '40px', display: 'flex', justifyContent: 'center' }}><div className="loader" /></div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Category</th>
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
                        <img
                          src={p.image_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=100&h=100&fit=crop'}
                          alt={p.name}
                          style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover' }}
                        />
                        <div>
                          <strong style={{ fontWeight: 600, display: 'block' }}>{p.name}</strong>
                          <span style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {p.description}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td>{p.category}</td>
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
                            borderRadius: '999px',
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
                        <Link prefetch={false} href={`/${slug}/admin/products/${p.id}/edit`} className="btn btn-secondary btn-sm">Edit</Link>
                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(p.id, p.name)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: '40px' }}>No products found</td></tr>
                )}
              </tbody>
            </table>
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
            borderRadius: '20px',
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
                    borderRadius: '16px',
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
                    borderRadius: '14px',
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

                  <div style={{ maxHeight: '380px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
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
                                value={item.price}
                                onChange={e => handleUpdateExtractedItem(item.id, 'price', parseFloat(e.target.value) || 0)}
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
                      borderRadius: '9999px',
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
                      borderRadius: '9999px',
                      border: 'none',
                      backgroundColor: '#0f172a',
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

    </AdminContentWrapper>
  );
}
