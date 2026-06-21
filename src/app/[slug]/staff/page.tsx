import { redirect } from 'next/navigation';

export default async function StaffIndexPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  redirect(`/${slug}/staff/menu`);
}
