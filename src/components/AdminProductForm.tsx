import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Product } from '@/types';

export default function AdminProductForm({ initialData }: { initialData?: Product }) {
  const router = useRouter();
  const isEditing = !!initialData;
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [fetchingCategories, setFetchingCategories] = useState(true);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [addingCategory, setAddingCategory] = useState(false);

  const [form, setForm] = useState({
    name: initialData?.name || '',
    category: initialData?.category || '',
    price: initialData?.price?.toString() || '',
    stock_quantity: initialData?.stock_quantity?.toString() || '0',
    buffer_quantity: initialData?.buffer_quantity?.toString() || '0',
    image_url: initialData?.image_url || '',
    description: initialData?.description || '',
  });

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/categories');
      const data = await res.json();
      if (data.success) {
        setCategories(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch categories:', err);
    } finally {
      setFetchingCategories(false);
    }
  };

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) return;
    setAddingCategory(true);
    try {
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCategoryName.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Category added!');
        setCategories(prev => [...prev, data.data]);
        setForm(f => ({ ...f, category: data.data.name }));
        setNewCategoryName('');
        setShowAddCategory(false);
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
    const payload = {
      ...form,
      price: parseFloat(form.price),
      stock_quantity: parseInt(form.stock_quantity) || 0,
      buffer_quantity: parseInt(form.buffer_quantity) || 0,
    };

    try {
      const url = isEditing ? `/api/products/${initialData.id}` : '/api/products';
      const method = isEditing ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
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
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div>
          <label className="label">Product Name *</label>
          <input type="text" className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Classic Burger" />
        </div>
        
        <div>
          <label className="label">Description *</label>
          <textarea 
            className="textarea" 
            value={form.description} 
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))} 
            placeholder="Describe your product..."
            rows={2}
          />
        </div>

        <div style={{ display: 'flex', gap: '16px' }}>
          <div style={{ flex: 1 }}>
            <label className="label">Category *</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {showAddCategory ? (
                <div style={{ display: 'flex', gap: '4px', width: '100%' }}>
                  <input 
                    type="text" 
                    className="input" 
                    style={{ flex: 1 }}
                    placeholder="New category..." 
                    value={newCategoryName} 
                    onChange={e => setNewCategoryName(e.target.value)}
                    autoFocus
                  />
                  <button type="button" className="btn btn-primary btn-sm" style={{ minWidth: 'auto', padding: '0 12px' }} onClick={handleAddCategory} disabled={addingCategory}>
                    {addingCategory ? '...' : 'Add'}
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm" style={{ minWidth: 'auto', padding: '0 8px' }} onClick={() => setShowAddCategory(false)}>
                    ✕
                  </button>
                </div>
              ) : (
                <>
                  <select 
                    className="select" 
                    style={{ flex: 1 }}
                    value={form.category} 
                    onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                  >
                    <option value="">Select Category</option>
                    {categories.map(c => (
                      <option key={c.id} value={c.name}>{c.name}</option>
                    ))}
                    {fetchingCategories && <option disabled>Loading...</option>}
                  </select>
                  <button 
                    type="button" 
                    className="btn btn-ghost" 
                    style={{ minWidth: 'auto', padding: '0 12px', fontSize: '20px', fontWeight: 600 }}
                    onClick={() => setShowAddCategory(true)}
                    title="Add New Category"
                  >
                    +
                  </button>
                </>
              )}
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <label className="label">Price (₹) *</label>
            <input type="number" step="0.01" className="input" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} placeholder="0.00" />
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
              <img src={form.image_url} alt="Preview" style={{ width: '100px', height: '100px', objectFit: 'cover', borderRadius: '8px' }} onError={(e) => (e.target as HTMLImageElement).style.display='none'} />
            </div>
          )}
        </div>
        
        <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? <span className="loader" style={{ width: 16, height: 16, borderWidth: 2 }} /> : isEditing ? 'Update Product' : 'Create Product'}
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => router.push('/admin/products')}>Cancel</button>
        </div>
      </form>
    </div>
  );
}
