'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import AdminProductForm from '@/components/AdminProductForm';

export default function NewProductPage() {
  const { slug } = useParams();
  return (
    <div className="page-content-admin animate-fade-in">
      <div style={{ marginBottom: '24px' }}>
        <Link prefetch={false} href={`/${slug}/admin/products`} style={{ color: 'var(--text-secondary)', fontSize: '14px', textDecoration: 'none' }}>
          ← Back to Products
        </Link>
        <h1 style={{ fontSize: '28px', fontWeight: 800, marginTop: '8px' }}>Add New Product</h1>
      </div>
      <AdminProductForm />
    </div>
  );
}
