'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Product, ProductStatus } from '@/types';
import { formatPrice } from '@/lib/format';
import { productService } from '@/app/services/products.api';

import { useParams } from 'next/navigation';

export default function AdminProducts() {
  const { slug } = useParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
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

  const handleStockUpdate = async (id: string, newStock: number, buffer: number) => {
    if (newStock < 0) return;
    try {
      const res = await productService.updateProduct(id, { stock_quantity: newStock, buffer_quantity: buffer });
      if (res.success) fetchProducts();
    } catch {
      toast.error('Failed to update stock');
    }
  };

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

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete ${name}?`)) return;
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

  const filtered = products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.category.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="page-content-admin animate-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 800 }}>Products Inventory</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Manage your menu items and stock levels.</p>
        </div>
        <Link prefetch={false} href={`/${slug}/admin/products/new`} className="btn btn-primary">+ Add Product</Link>
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
            <div style={{ padding: '40px', display: 'flex', justifyContent: 'center' }}><div className="loader" /></div>
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
                        <div>
                          <strong style={{ fontWeight: 600, display: 'block' }}>{p.name}</strong>
                          <span style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {p.description}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td>{p.category}</td>
                    <td style={{ fontWeight: 600 }}>{formatPrice(p.price)}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: 800, fontSize: '15px', color: p.stock_quantity <= p.buffer_quantity ? 'var(--warning)' : 'inherit' }}>
                          {Math.max(0, p.stock_quantity)}
                        </span>
                        <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>/ {p.buffer_quantity}</span>
                      </div>
                    </td>
                    <td>
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
                        {/* Custom modern emerald/slate toggle switch */}
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
    </div>
  );
}
