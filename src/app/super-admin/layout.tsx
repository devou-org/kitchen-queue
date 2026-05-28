import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Qdine Super admin',
  icons: {
    icon: 'https://ik.imagekit.io/j2q8x5lu0/qdine/qdine-logo-rotated.png',
    shortcut: 'https://ik.imagekit.io/j2q8x5lu0/qdine/qdine-logo-rotated.png',
    apple: 'https://ik.imagekit.io/j2q8x5lu0/qdine/qdine-logo-rotated.png',
  },
};

export default function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
