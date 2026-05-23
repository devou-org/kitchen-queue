import { Metadata } from 'next';
import { getRestaurantBySlug } from '@/lib/db';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const restaurant = await getRestaurantBySlug(slug);

  if (!restaurant) {
    return {
      title: 'Restaurant Not Found',
      description: 'The requested restaurant could not be found.',
    };
  }

  return {
    title: `${restaurant.name}`,
    description: restaurant.menu_description || `Welcome to ${restaurant.name}. View our digital menu and order online.`,
    icons: restaurant.logo_url ? {
      icon: restaurant.logo_url,
      shortcut: restaurant.logo_url,
      apple: restaurant.logo_url,
    } : undefined,
    openGraph: {
      title: restaurant.name,
      description: restaurant.menu_description || `Welcome to ${restaurant.name}. View our digital menu and order online.`,
      images: restaurant.logo_url ? [{ url: restaurant.logo_url }] : [],
    },
  };
}

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
