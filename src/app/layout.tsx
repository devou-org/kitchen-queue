import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from 'react-hot-toast';

export const metadata: Metadata = {
  title: "Renjz Kitchen | Taste of Home in every bite",
  description: 'Real-time restaurant queue management system. Browse menu, order online, track your queue position live.',
  keywords: 'restaurant, queue, order, food, menu, tracking, Renjz Kitchen',
  icons: {
    icon: '/logo.jpeg',
    shortcut: '/logo.jpeg',
    apple: '/logo.jpeg',
  },
  openGraph: {
    title: 'Renjz Kitchen – Authentic Coastal Flavors',
    description: 'Order food and track your queue in real-time',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
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

