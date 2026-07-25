import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Toaster } from 'react-hot-toast';
import Script from 'next/script';

export const metadata: Metadata = {
  title: "Renjz Kitchen | Taste of Home in every bite",
  description: 'Real-time restaurant queue management system. Browse menu, order online, track your queue position live.',
  keywords: 'restaurant, queue, order, food, menu, tracking, Renjz Kitchen',
  icons: {
    icon: 'https://ik.imagekit.io/j2q8x5lu0/Renjzkitchen/renjz.jpg',
    shortcut: 'https://ik.imagekit.io/j2q8x5lu0/Renjzkitchen/renjz.jpg',
    apple: 'https://ik.imagekit.io/j2q8x5lu0/Renjzkitchen/renjz.jpg',
  },
  openGraph: {
    title: 'Renjz Kitchen – Authentic Coastal Flavors',
    description: 'Order food and track your queue in real-time',
    type: 'website',
  },
  manifest: '/manifest.json',
};

export const viewport: Viewport = {
  themeColor: '#000000',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Script id="cleanup-legacy" strategy="beforeInteractive">
          {`try { localStorage.removeItem('user_mobile'); localStorage.removeItem('user_data'); } catch(e) {}`}
        </Script>
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3000,
            style: {
              fontFamily: 'Inter, sans-serif',
              fontSize: '14px',
              fontWeight: 500,
            },
            success: {
              style: {
                background: '#065F46',
                color: 'white',
              },
            },
            error: {
              duration: 5000,
              style: {
                background: '#991B1B',
                color: 'white',
              },
            },
          }}
        />
      </body>
    </html>
  );
}

