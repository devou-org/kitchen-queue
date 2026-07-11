'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import AdminProductForm from '@/components/AdminProductForm';
import { AdminContentWrapper } from '@/components/AdminContentWrapper';
import { AdminPageHeader } from '@/components/AdminPageHeader';

export default function NewProductPage() {
  const { slug } = useParams();
  return (
    <AdminContentWrapper>
      <AdminPageHeader
        title="Add New Product"
        backLink={
          <Link prefetch={false} href={`/${slug}/admin/products`} style={{ color: 'var(--text-secondary)', fontSize: '14px', textDecoration: 'none' }}>
            ← Back to Products
          </Link>
        }
      />
      <AdminProductForm />
    </AdminContentWrapper>
  );
}
