'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Product } from '@/types';
import { inventoryService } from '@/app/services/inventory.api';

interface Category {
  id: string;
  name: string;
}

export default function AdminProductForm({ initialData }: { initialData?: Product }) {
  const router = useRouter();
  const isEditing = !!initialData;
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
    if (!newCategoryName.trim()) return;
    setAddingCategory(true);
    try {
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('admin_token') || localStorage.getItem('auth_token')}`
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

    setLoading(true);
    // Explicitly parse values to ensure type safety
    const stockVal = parseInt(form.stock_quantity);
    const bufferVal = parseInt(form.buffer_quantity);

    const payload = {
      name: form.name.trim(),
      description: form.description.trim(),
      category: form.category,
      price: parseFloat(form.price),
      stock_quantity: isNaN(stockVal) ? 0 : stockVal,
      buffer_quantity: isNaN(bufferVal) ? 0 : bufferVal,
      image_url: form.image_url.trim(),
      // status is deliberately removed to let server calculate based on stock/buffer
    };

    try {
      const url = isEditing ? `/api/products/${initialData.id}` : '/api/products';
      const method = isEditing ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        cache: 'no-store'
      });

      const data = await res.json();
      if (data.success) {
        toast.success(`Product ${isEditing ? 'updated' : 'created'} successfully!`);
        router.push('/admin/products');
      } else {
        toast.error(data.error || 'Failed to save product');
      }
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card" style={{ maxWidth: '600px' }}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div>
          <label className="label">Product Name *</label>
          <input type="text" className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Classic Burger" required />
        </div>

        <div>
          <label className="label">Product Description</label>
          <textarea 
            className="input" 
            value={form.description} 
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))} 
            placeholder="Describe the product components, taste, etc." 
            rows={4}
            style={{ resize: 'vertical', minHeight: '80px' }}
          />
        </div>

        <div style={{ display: 'flex', gap: '16px' }}>
          <div style={{ flex: 1 }}>
            <label className="label">Category *</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <select 
                className="input" 
                value={form.category} 
                onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                style={{ flex: 1 }}
              >
                <option value="">Select Category</option>
                {form.category && !categories.find(c => c.name === form.category) && (
                  <option value={form.category}>{form.category}</option>
                )}
                {categories.map(cat => (
                  <option key={cat.id} value={cat.name}>{cat.name}</option>
                ))}
              </select>
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={() => setShowAddCategory(!showAddCategory)}
                style={{ padding: '0 12px', fontSize: '20px', fontWeight: 'bold' }}
                title="Add New Category"
              >
                +
              </button>
            </div>
            
            {showAddCategory && (
              <div style={{ marginTop: '8px', display: 'flex', gap: '8px', padding: '12px', background: '#f9fafb', borderRadius: '8px', border: '1px solid var(--border)' }}>
                <input 
                  type="text" 
                  className="input" 
                  value={newCategoryName} 
                  onChange={e => setNewCategoryName(e.target.value)} 
                  placeholder="New category name"
                  style={{ height: '36px', fontSize: '13px' }}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddCategory())}
                />
                <button 
                  type="button" 
                  className="btn btn-primary" 
                  onClick={handleAddCategory} 
                  disabled={addingCategory}
                  style={{ height: '36px', padding: '0 12px', fontSize: '13px' }}
                >
                  Add
                </button>
              </div>
            )}
          </div>
          <div style={{ width: '150px' }}>
            <label className="label">Price (₹) *</label>
            <input type="number" step="0.01" className="input" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} placeholder="0.00" required />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '16px' }}>
          <div style={{ flex: 1 }}>
            <label className="label">Stock Quantity</label>
            <input type="number" className="input" value={form.stock_quantity} onChange={e => setForm(f => ({ ...f, stock_quantity: e.target.value }))} placeholder="0" />
          </div>
          <div style={{ flex: 1 }}>
            <label className="label">Buffer Quantity</label>
            <input type="number" className="input" value={form.buffer_quantity} onChange={e => setForm(f => ({ ...f, buffer_quantity: e.target.value }))} placeholder="0" />
          </div>
        </div>

        <div>
          <label className="label">Image URL (Optional)</label>
          <input type="url" className="input" value={form.image_url} onChange={e => setForm(f => ({ ...f, image_url: e.target.value }))} placeholder="https://..." />
          {form.image_url && (
            <div style={{ marginTop: '10px' }}>
              <img src={form.image_url} alt="Preview" style={{ width: '120px', height: '120px', objectFit: 'cover', borderRadius: '8px', border: '1px solid var(--border)' }} onError={(e) => (e.target as HTMLImageElement).style.display='none'} />
            </div>
          )}
        </div>
        
        <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
          <button type="submit" className="btn btn-primary" disabled={loading} style={{ minWidth: '140px' }}>
            {loading ? <span className="loader" style={{ width: 16, height: 16, borderWidth: 2 }} /> : isEditing ? 'Update Product' : 'Create Product'}
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => router.push('/admin/products')}>Cancel</button>
        </div>
      </form>
    </div>
  );
}
