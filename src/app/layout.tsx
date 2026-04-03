import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from 'react-hot-toast';

export const metadata: Metadata = {
  title: "Culinary Conductor | aimiys kitchen",
  description: 'Real-time restaurant queue management system. Browse menu, order online, track your queue position live.',
  keywords: 'restaurant, queue, order, food, menu, tracking',
  openGraph: {
    title: 'Culinary Conductor – aimiys kitchen',
    description: 'Order food and track your queue in real-time',
    type: 'website',
  },
};

import { PusherProvider } from '@/context/PusherContext';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <PusherProvider>
          {children}
        </PusherProvider>
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
