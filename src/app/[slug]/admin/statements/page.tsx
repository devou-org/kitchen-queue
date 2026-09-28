'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AdminAnalyticsStatementsPage from '../analytics/statements/page';

export default function AdminStatementsRedirectPage() {
  const { slug } = useParams();
  const router = useRouter();

  useEffect(() => {
    const slugStr = Array.isArray(slug) ? slug[0] : slug;
    if (slugStr) {
      router.replace(`/${slugStr}/admin/analytics/statements`);
    }
  }, [slug, router]);

  return <AdminAnalyticsStatementsPage />;
}
