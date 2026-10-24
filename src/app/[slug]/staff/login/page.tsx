'use client';
import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';

export default function StaffLoginRedirect() {
  const router = useRouter();
  const { slug } = useParams();

  useEffect(() => {
    // Redirect legacy staff login directly to the unified admin login portal
    router.replace(`/${slug}/admin/login`);
  }, [slug, router]);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <div className="loader" />
    </div>
  );
}
