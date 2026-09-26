'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AdminSalesAnalyticsPage from './sales/page';

export default function AdminAnalyticsRootPage() {
  const { slug } = useParams();
  const router = useRouter();

  // In case client wants clean URL replacement to /admin/analytics/sales
  useEffect(() => {
    const slugStr = Array.isArray(slug) ? slug[0] : slug;
    if (slugStr) {
      router.replace(`/${slugStr}/admin/analytics/sales`);
    }
  }, [slug, router]);

  // Render Sales page immediately while redirecting so there's 0 flash
  return <AdminSalesAnalyticsPage />;
}

