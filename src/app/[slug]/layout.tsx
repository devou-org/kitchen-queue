import { getRestaurantBySlug } from '@/lib/db';

export default async function SlugLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const restaurant = await getRestaurantBySlug(slug);

  const primary = restaurant?.primary_color || '#800020';
  const secondary = restaurant?.secondary_color || '#FDF9FA';

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        :root {
          --primary: ${primary};
          --primary-dark: ${primary};
          --secondary: ${secondary};
          --bg: ${secondary};
          --bg-gradient: linear-gradient(135deg, ${secondary} 0%, rgba(255,255,255,0.7) 100%);
        }
      `}} />
      {children}
    </>
  );
}
