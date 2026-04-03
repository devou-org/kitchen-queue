import { useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Product } from '@/types';

export default function AdminProductForm({ initialData }: { initialData?: Product }) {
  const router = useRouter();
  const isEditing = !!initialData;
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: initialData?.name || '',
    category: initialData?.category || '',
    price: initialData?.price?.toString() || '',
    stock_quantity: initialData?.stock_quantity?.toString() || '0',
    buffer_quantity: initialData?.buffer_quantity?.toString() || '0',
    image_url: initialData?.image_url || '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.price || !form.category) {
      return toast.error('Name, Category, and Price are required');
    }

    setLoading(true);
    const payload = {
      name: form.name,
      category: form.category,
      price: parseFloat(form.price),
      stock_quantity: parseInt(form.stock_quantity) || 0,
      buffer_quantity: parseInt(form.buffer_quantity) || 0,
      image_url: form.image_url,
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
        <div style={{ display: 'flex', gap: '16px' }}>
          <div style={{ flex: 1 }}>
            <label className="label">Category *</label>
            <input type="text" className="input" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} placeholder="e.g. Mains" />
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
            <label className="label">Buffer Quantity (Low stock alert)</label>
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
