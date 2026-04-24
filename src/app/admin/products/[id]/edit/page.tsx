'use client';
import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import AdminProductForm from '@/components/AdminProductForm';
import { Product } from '@/types';
import toast from 'react-hot-toast';

export default function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const res = await fetch(`/api/products/${id}`, { cache: 'no-store' });
        const data = await res.json();
        if (data.success) {
          setProduct(data.data);
        } else {
          toast.error(data.error || 'Product not found');
        }
      } catch {
        toast.error('Failed to fetch product details');
      } finally {
        setLoading(false);
      }
    };
    fetchProduct();
  }, [id]);

  if (loading) {
    return (
      <div className="page-content-admin" style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
        <div className="loader" style={{ width: 40, height: 40, borderWidth: 4 }} />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="page-content-admin">
        <div style={{ textAlign: 'center', padding: '60px' }}>
          <p>Product not found.</p>
          <Link href="/admin/products" className="btn btn-primary" style={{ marginTop: '20px' }}>Back to Products</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page-content-admin animate-fade-in">
      <div style={{ marginBottom: '24px' }}>
        <Link href="/admin/products" style={{ color: 'var(--text-secondary)', fontSize: '14px', textDecoration: 'none' }}>
          ← Back to Products
        </Link>
        <h1 style={{ fontSize: '28px', fontWeight: 800, marginTop: '8px' }}>Edit Product: {product.name}</h1>
      </div>
      <AdminProductForm key={id} initialData={product} />
    </div>
  );
}
