'use client';
import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import AdminProductForm from '@/components/AdminProductForm';
import { Product } from '@/types';
import toast from 'react-hot-toast';
import { AdminContentWrapper } from '@/components/AdminContentWrapper';
import { AdminPageHeader } from '@/components/AdminPageHeader';

export default function EditProductPage({ params }: { params: Promise<{ id: string, slug: string }> }) {
  const { id, slug } = use(params);
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const res = await fetch(`/api/products/${id}`, { 
          cache: 'no-store',
          headers: { 'x-restaurant-slug': slug }
        });
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
    <AdminContentWrapper style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
      <div className="loader" style={{ width: 40, height: 40, borderWidth: 4 }} />
    </AdminContentWrapper>
    );
  }

  if (!product) {
    return (
    <AdminContentWrapper>
      <div style={{ textAlign: 'center', padding: '60px' }}>
        <p>Product not found.</p>
        <Link prefetch={false} href={`/${slug}/admin/products`} className="btn btn-primary" style={{ marginTop: '20px' }}>Back to Products</Link>
      </div>
    </AdminContentWrapper>
    );
  }

  return (
    <AdminContentWrapper>
      <AdminProductForm key={id} initialData={product} />
    </AdminContentWrapper>
  );
}
