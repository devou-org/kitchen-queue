'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AdminSalesAnalyticsPage from '../analytics/sales/page';

export default function AdminSalesRedirectPage() {
  const { slug } = useParams();
  const router = useRouter();

  useEffect(() => {
    const slugStr = Array.isArray(slug) ? slug[0] : slug;
    if (slugStr) {
      router.replace(`/${slugStr}/admin/analytics/sales`);
    }
  }, [slug, router]);

  return <AdminSalesAnalyticsPage />;
}
