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
      <div style={{ textAlign: 'center' }}>
        <div className="loader" style={{ margin: '0 auto 16px' }} />
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Redirecting to Unified Admin Portal...</p>
      </div>
    </div>
  );
}
