import { redirect } from 'next/navigation';

export default async function AdminAnalyticsRootPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const resolvedParams = await params;
  redirect(`/${resolvedParams.slug}/admin/analytics/sales`);
}
