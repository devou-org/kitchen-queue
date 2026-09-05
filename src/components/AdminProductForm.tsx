'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { Product } from '@/types';
import { inventoryService } from '@/app/services/inventory.api';
import { useRestaurant } from '@/hooks/useRestaurant';
import { X, UtensilsCrossed, ChefHat, Tag, Plus, Check, ImageIcon, Eye, Layers, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

interface Category {
  id: string;
  name: string;
}

interface AdminProductFormProps {
  initialData?: Product;
  onSuccess?: () => void;
  onCancel?: () => void;
  isModal?: boolean;
}

export default function AdminProductForm({ initialData, onSuccess, onCancel, isModal = false }: AdminProductFormProps) {
  const router = useRouter();
  const { slug } = useParams();
  const isEditing = !!initialData;
  const { restaurant } = useRestaurant();
  const showOnlineOrdering = restaurant?.modules?.ONLINE_ORDERING !== false;
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [addingCategory, setAddingCategory] = useState(false);

  const [form, setForm] = useState({
    name: initialData?.name || '',
    description: initialData?.description || '',
    category: initialData?.category || '',
    price: initialData?.price?.toString() || '',
    stock_quantity: initialData?.stock_quantity?.toString() || '0',
    buffer_quantity: initialData?.buffer_quantity?.toString() || '0',
    image_url: initialData?.image_url || '',
    dietary_preference: initialData?.dietary_preference || 'NON_VEG',
  });

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const res = await inventoryService.getCategories();
      if (res.success && res.data) {
        setCategories(res.data);
      }
    } catch (err) {
      console.error('Failed to load categories', err);
    }
  };

  const handleAddCategory = async () => {
    const trimmed = newCategoryName.trim();
    if (!trimmed) return;

    if (categories.some(c => c.name.toLowerCase() === trimmed.toLowerCase())) {
      toast.error('Category already exists');
      return;
    }

    setAddingCategory(true);
    try {
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('admin_token') || localStorage.getItem('staff_token') || localStorage.getItem('auth_token')}`,
          'x-restaurant-slug': slug as string
        },
        body: JSON.stringify({ name: newCategoryName.trim() }),
        cache: 'no-store'
      });
      const data = await res.json();
      if (data.success) {
        setCategories(prev => [...prev, data.data].sort((a,b) => a.name.localeCompare(b.name)));
        setForm(f => ({ ...f, category: data.data.name }));
        setNewCategoryName('');
        setShowAddCategory(false);
        toast.success('Category added');
      } else {
        toast.error(data.error || 'Failed to add category');
      }
    } catch {
      toast.error('Error adding category');
    } finally {
      setAddingCategory(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.price || !form.category) {
      return toast.error('Name, Category, and Price are required');
    }
    
    if (parseFloat(form.price) < 0) {
      return toast.error('Price cannot be negative');
    }

    setLoading(true);
    const stockVal = parseInt(form.stock_quantity);
    const bufferVal = parseInt(form.buffer_quantity);

    const parsedPrice = parseFloat(form.price);
    const cleanPrice = isNaN(parsedPrice) ? 0 : Math.round(parsedPrice * 100) / 100;

    const payload = {
      name: form.name.trim(),
      description: form.description.trim(),
      category: form.category,
      price: cleanPrice,
      stock_quantity: isNaN(stockVal) ? 0 : stockVal,
      buffer_quantity: isNaN(bufferVal) ? 0 : bufferVal,
      image_url: form.image_url.trim(),
      dietary_preference: form.dietary_preference,
    };

    try {
      const url = isEditing ? `/api/products/${initialData.id}` : '/api/products';
      const method = isEditing ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('admin_token') || localStorage.getItem('staff_token') || localStorage.getItem('auth_token')}`,
          'x-restaurant-slug': slug as string
        },
        body: JSON.stringify(payload),
        cache: 'no-store'
      });

      const data = await res.json();
      if (data.success) {
        toast.success(`Product ${isEditing ? 'updated' : 'created'} successfully!`);
        if (onSuccess) {
          onSuccess();
        } else {
          router.push(`/${slug}/admin/products`);
        }
      } else {
        toast.error(data.error || 'Failed to save product');
      }
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelClick = () => {
    if (onCancel) {
      onCancel();
    } else {
      router.push(`/${slug}/admin/products`);
    }
  };

  // Stock status calculator
  const stockNum = parseInt(form.stock_quantity) || 0;
  const bufferNum = parseInt(form.buffer_quantity) || 0;
  const calculatedStatus = !showOnlineOrdering || (stockNum === 0 && bufferNum === 0) ? 'AVAILABLE' : stockNum <= 0 ? 'OUT_OF_STOCK' : stockNum <= bufferNum ? 'LOW_STOCK' : 'AVAILABLE';

  return (
    <form onSubmit={handleSubmit} style={{ width: '100%', maxWidth: '1100px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <style>{`
        .product-form-container {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        .form-col-left, .form-col-right {
          display: contents;
        }
        .form-card-basic { order: 1; }
        .form-card-inventory { order: 2; }
        .form-card-pricing { order: 3; }
        .form-card-image { order: 4; }
        .form-card-preview { order: 5; }

        @media (min-width: 820px) {
          .product-form-container {
            display: grid;
            grid-template-columns: 1.15fr 0.85fr;
            gap: 24px;
            align-items: start;
          }
          .form-col-left {
            display: flex;
            flex-direction: column;
            gap: 24px;
          }
          .form-col-right {
            display: flex;
            flex-direction: column;
            gap: 24px;
          }
          .form-card-basic, .form-card-inventory, .form-card-pricing, .form-card-image, .form-card-preview {
            order: unset;
          }
        }
      `}</style>
      
      {/* Top Action Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', paddingBottom: '16px', borderBottom: '1px solid #e2e8f0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: '1 1 260px' }}>
          {!isModal ? (
            <Link 
              prefetch={false} 
              href={`/${slug}/admin/products`}
              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '38px', height: '38px', borderRadius: '10px', backgroundColor: '#ffffff', border: '1px solid #e2e8f0', color: '#475569', textDecoration: 'none', transition: 'all 0.2s ease' }}
              title="Back to Products"
            >
              <ArrowLeft size={18} />
            </Link>
          ) : (
            <div style={{ width: '38px', height: '38px', borderRadius: '10px', backgroundColor: '#f1f5f9', color: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <UtensilsCrossed size={20} />
            </div>
          )}
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a', margin: 0 }}>
              {isEditing ? `Edit Product: ${initialData.name}` : 'Add New Product'}
            </h1>
            <p style={{ fontSize: '13px', color: '#64748b', margin: '2px 0 0 0' }}>
              Configure product information, pricing, dietary preference, and stock inventory.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginLeft: 'auto', flexShrink: 0 }}>
          <button
            type="button"
            onClick={handleCancelClick}
            style={{
              padding: '10px 18px',
              borderRadius: '10px',
              border: '1px solid #cbd5e1',
              backgroundColor: '#ffffff',
              color: '#334155',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 22px',
              borderRadius: '10px',
              border: 'none',
              backgroundColor: 'var(--primary, #0f172a)',
              color: '#ffffff',
              fontWeight: 700,
              fontSize: '13px',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(15, 23, 42, 0.15)',
              transition: 'all 0.2s ease'
            }}
          >
            {loading ? <div className="loader" style={{ width: 16, height: 16, borderWidth: 2 }} /> : <Check size={16} />}
            {isEditing ? 'Update Product' : 'Save Product'}
          </button>

          {isModal && (
            <button
              type="button"
              onClick={handleCancelClick}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                backgroundColor: '#f1f5f9',
                border: '1px solid #cbd5e1',
                color: '#475569',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                marginLeft: '4px'
              }}
              title="Close Modal"
            >
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Main Responsive Grid Layout */}
      <div className="product-form-container">
        
        {/* Left Column: Basic Details & Pricing */}
        <div className="form-col-left">
          {/* Card 1: Basic Information */}
        <div className="form-card-basic" style={{ backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', paddingBottom: '12px', borderBottom: '1px solid #f1f5f9' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#f1f5f9', color: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ChefHat size={18} />
            </div>
            <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', margin: 0 }}>Basic Details</h2>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                Product Name <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Double Cheese Margherita Pizza"
                required
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  border: '1px solid #cbd5e1',
                  fontSize: '14px',
                  color: '#0f172a',
                  backgroundColor: '#ffffff',
                  outline: 'none'
                }}
              />
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>
                  Category <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setShowAddCategory(!showAddCategory)}
                  style={{ background: 'none', border: 'none', color: '#16a34a', fontSize: '12px', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                >
                  <Plus size={14} /> Add Category
                </button>
              </div>

              <select
                value={form.category}
                onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                required
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  border: '1px solid #cbd5e1',
                  fontSize: '14px',
                  color: '#0f172a',
                  backgroundColor: '#ffffff',
                  outline: 'none'
                }}
              >
                <option value="">Select a Category</option>
                {form.category && !categories.find(c => c.name === form.category) && (
                  <option value={form.category}>{form.category}</option>
                )}
                {categories.map(cat => (
                  <option key={cat.id} value={cat.name}>{cat.name}</option>
                ))}
              </select>

              {showAddCategory && (
                <div style={{ marginTop: '10px', display: 'flex', gap: '8px', padding: '12px', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px dashed #cbd5e1' }}>
                  <input
                    type="text"
                    value={newCategoryName}
                    onChange={e => setNewCategoryName(e.target.value)}
                    placeholder="New category name"
                    style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddCategory())}
                  />
                  <button
                    type="button"
                    onClick={handleAddCategory}
                    disabled={addingCategory}
                    style={{ padding: '8px 14px', borderRadius: '8px', border: 'none', backgroundColor: '#16a34a', color: '#ffffff', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}
                  >
                    {addingCategory ? 'Adding...' : 'Save'}
                  </button>
                </div>
              )}
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                Description <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 400 }}>(Optional)</span>
              </label>
              <textarea
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Detailed description of ingredients, flavor profile, or portion size..."
                rows={3}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13px',
                  color: '#0f172a',
                  backgroundColor: '#ffffff',
                  resize: 'vertical',
                  minHeight: '80px',
                  outline: 'none'
                }}
              />
            </div>
          </div>
        </div>

        {/* Card 3: Pricing & Dietary Classification */}
        <div className="form-card-pricing" style={{ backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', paddingBottom: '12px', borderBottom: '1px solid #f1f5f9' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#f1f5f9', color: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Tag size={18} />
            </div>
            <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', margin: 0 }}>Price & Dietary Type</h2>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                Product Price (₹) <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', fontSize: '15px', fontWeight: 700, color: '#64748b' }}>₹</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.price}
                  onWheel={(e) => (e.target as HTMLInputElement).blur()}
                  onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                  placeholder="0.00"
                  required
                  style={{
                    width: '100%',
                    padding: '10px 14px 10px 32px',
                    borderRadius: '10px',
                    border: '1px solid #cbd5e1',
                    fontSize: '15px',
                    fontWeight: 600,
                    color: '#0f172a',
                    backgroundColor: '#ffffff',
                    outline: 'none'
                  }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '8px' }}>
                Dietary Preference Classification
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                
                {/* VEG Card */}
                <div
                  onClick={() => setForm(f => ({ ...f, dietary_preference: 'VEG' }))}
                  style={{
                    padding: '12px 14px',
                    borderRadius: '12px',
                    border: form.dietary_preference === 'VEG' ? '2px solid #16a34a' : '1px solid #e2e8f0',
                    backgroundColor: form.dietary_preference === 'VEG' ? '#f0fdf4' : '#ffffff',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <div style={{ width: '18px', height: '18px', borderRadius: '4px', border: '1.5px solid #16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#16a34a' }} />
                  </div>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: form.dietary_preference === 'VEG' ? '#15803d' : '#334155' }}>Vegetarian</div>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>Plant-based / Dairy</div>
                  </div>
                </div>

                {/* NON_VEG Card */}
                <div
                  onClick={() => setForm(f => ({ ...f, dietary_preference: 'NON_VEG' }))}
                  style={{
                    padding: '12px 14px',
                    borderRadius: '12px',
                    border: form.dietary_preference === 'NON_VEG' ? '2px solid #dc2626' : '1px solid #e2e8f0',
                    backgroundColor: form.dietary_preference === 'NON_VEG' ? '#fef2f2' : '#ffffff',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <div style={{ width: '18px', height: '18px', borderRadius: '4px', border: '1.5px solid #dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#dc2626' }} />
                  </div>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: form.dietary_preference === 'NON_VEG' ? '#b91c1c' : '#334155' }}>Non-Veg</div>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>Meat / Poultry / Egg</div>
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Column: Inventory, Image, & Live Preview */}
      <div className="form-col-right">
          {/* Card 2: Inventory & Stock Control */}
        {showOnlineOrdering && (
          <div className="form-card-inventory" style={{ backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', paddingBottom: '12px', borderBottom: '1px solid #f1f5f9' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#f1f5f9', color: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Layers size={18} />
                </div>
                <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', margin: 0 }}>Inventory Control</h2>
              </div>

              {/* Real-time Status Badge */}
              <span
                style={{
                  padding: '4px 10px',
                  borderRadius: '9999px',
                  fontSize: '11px',
                  fontWeight: 700,
                  backgroundColor: calculatedStatus === 'AVAILABLE' ? '#dcfce7' : calculatedStatus === 'LOW_STOCK' ? '#fef9c3' : '#fee2e2',
                  color: calculatedStatus === 'AVAILABLE' ? '#15803d' : calculatedStatus === 'LOW_STOCK' ? '#a16207' : '#b91c1c'
                }}
              >
                {calculatedStatus.replace('_', ' ')}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Stock Quantity
                </label>
                <input
                  type="number"
                  min="0"
                  value={form.stock_quantity}
                  onWheel={(e) => (e.target as HTMLInputElement).blur()}
                  onChange={e => setForm(f => ({ ...f, stock_quantity: e.target.value }))}
                  placeholder="0"
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Buffer Threshold
                </label>
                <input
                  type="number"
                  min="0"
                  value={form.buffer_quantity}
                  onWheel={(e) => (e.target as HTMLInputElement).blur()}
                  onChange={e => setForm(f => ({ ...f, buffer_quantity: e.target.value }))}
                  placeholder="0"
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Card 4: Product Image Card */}
        <div className="form-card-image" style={{ backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid #f1f5f9' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#f1f5f9', color: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ImageIcon size={18} />
            </div>
            <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', margin: 0 }}>Product Image</h2>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
              Image URL
            </label>
            <input
              type="url"
              value={form.image_url}
              onChange={e => setForm(f => ({ ...f, image_url: e.target.value }))}
              placeholder="https://images.unsplash.com/..."
              style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none' }}
            />
          </div>
        </div>

        {/* Card 5: Live Customer Menu Preview Card */}
        <div className="form-card-preview" style={{ backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
            <Eye size={16} style={{ color: '#64748b' }} />
            <span style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b' }}>Live Menu Card Preview</span>
          </div>

          {/* Menu Card Mock */}
          <div style={{ borderRadius: '14px', border: '1px solid #f1f5f9', backgroundColor: '#fafafa', overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.06)' }}>
            
            {/* Card Image Display */}
            <div style={{ width: '100%', height: '160px', backgroundColor: '#f1f5f9', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
              {form.image_url ? (
                <img
                  src={form.image_url}
                  alt="Preview"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: '#94a3b8' }}>
                  <ImageIcon size={32} />
                  <span style={{ fontSize: '12px', marginTop: '6px' }}>No Image Provided</span>
                </div>
              )}

              {/* Category Pill Tag */}
              <div style={{ position: 'absolute', top: '10px', left: '10px', padding: '4px 10px', borderRadius: '9999px', backgroundColor: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(4px)', color: '#ffffff', fontSize: '11px', fontWeight: 600 }}>
                {form.category || 'Category'}
              </div>
            </div>

            {/* Card Body */}
            <div style={{ padding: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'start', justifyContent: 'space-between', gap: '8px' }}>
                
                {/* Dietary Dot + Title */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '14px', height: '14px', borderRadius: '3px', border: `1.5px solid ${form.dietary_preference === 'VEG' ? '#16a34a' : '#dc2626'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: form.dietary_preference === 'VEG' ? '#16a34a' : '#dc2626' }} />
                  </div>
                  <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', margin: 0, lineHeight: 1.2 }}>
                    {form.name || 'Product Title'}
                  </h3>
                </div>

                {/* Price */}
                <span style={{ fontSize: '15px', fontWeight: 800, color: '#16a34a', flexShrink: 0 }}>
                  ₹{parseFloat(form.price || '0').toFixed(2)}
                </span>
              </div>

              {form.description && (
                <p style={{ fontSize: '12px', color: '#64748b', margin: '8px 0 0 0', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {form.description}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  </form>
  );
}

