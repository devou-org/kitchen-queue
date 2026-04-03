'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Product } from '@/types';
import { formatPrice } from '@/lib/format';

export default function AdminProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const res = await fetch('/api/products');
      const data = await res.json();
      if (data.success) setProducts(data.data);
    } catch {
      toast.error('Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  const handleStockUpdate = async (id: string, newStock: number, buffer: number) => {
    if (newStock < 0) return;
    try {
      const res = await fetch(`/api/products/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stock_quantity: newStock, buffer_quantity: buffer })
      });
      if (res.ok) fetchProducts();
    } catch {
      toast.error('Failed to update stock');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete ${name}?`)) return;
    try {
      const res = await fetch(`/api/products/${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Product deleted');
        fetchProducts();
      }
    } catch {
      toast.error('Failed to delete product');
    }
  };

  const filtered = products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.category.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="page-content-admin animate-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 800 }}>Products Inventory</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Manage your menu items and stock levels.</p>
        </div>
        <Link href="/admin/products/new" className="btn btn-primary">+ Add Product</Link>
      </div>

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
            <div style={{ padding: '40px', display: 'flex', justifyContent: 'center' }}><div className="loader"/></div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Category</th>
                  <th>Price</th>
                  <th>Stock / Buffer</th>
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
                        <strong style={{ fontWeight: 600 }}>{p.name}</strong>
                      </div>
                    </td>
                    <td>{p.category}</td>
                    <td style={{ fontWeight: 600 }}>{formatPrice(p.price)}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button className="qty-btn" style={{ width: 24, height: 24, fontSize: 14 }} onClick={() => handleStockUpdate(p.id, p.stock_quantity - 1, p.buffer_quantity)}>−</button>
                        <span style={{ width: '30px', textAlign: 'center', fontWeight: 700 }}>{p.stock_quantity}</span>
                        <button className="qty-btn" style={{ width: 24, height: 24, fontSize: 14 }} onClick={() => handleStockUpdate(p.id, p.stock_quantity + 1, p.buffer_quantity)}>+</button>
                        <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>/ {p.buffer_quantity}</span>
                      </div>
                    </td>
                    <td>
                      <span className={`badge badge-${p.status.toLowerCase().replace(/_/g, '-')}`}>
                        {p.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                        <Link href={`/admin/products/${p.id}/edit`} className="btn btn-secondary btn-sm">Edit</Link>
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
    </div>
  );
}
