'use client';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useRestaurant } from '@/hooks/useRestaurant';
import JoinQueueForm from '@/components/modules/queue/JoinQueueForm';


export default function QueuePage() {
  const params = useParams();
  const slug = params?.slug as string;
  const { restaurant, loading } = useRestaurant();

  if (loading) {
    return (
      <div style={{ background: '#f8fafc', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p>Loading Waitlist...</p>
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div style={{ background: '#f8fafc', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p>Restaurant not found.</p>
      </div>
    );
  }

  const showQueue = restaurant.modules?.QUEUE_MANAGEMENT !== false;

  if (!showQueue) {
    return (
      <div style={{ background: '#f8fafc', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <h2 className="text-xl font-bold text-gray-700">Queue is not enabled</h2>
        <Link href={`/${slug}/menu`} className="mt-4 text-indigo-600 underline">Return to Menu</Link>
      </div>
    );
  }

  return (
    <div style={{ background: 'var(--bg, #f8fafc)', minHeight: '100vh' }}>
      {restaurant?.primary_color && (
        <style dangerouslySetInnerHTML={{ __html: `
          :root {
            --primary: ${restaurant.primary_color};
            --primary-dark: ${restaurant.primary_color};
          }
        `}} />
      )}
      
      {/* Header */}
      <div className="page-header" style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        padding: '12px 16px', borderBottom: '1px solid #e2e8f0',
        backgroundColor: '#ffffff', height: '57px', boxSizing: 'border-box'
      }}>
        <Link href={`/${slug}/menu`} style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
          <span style={{ fontWeight: 800, fontSize: '18px', color: 'var(--text-primary, #0f172a)' }}>
            ← Back
          </span>
        </Link>
      </div>

      <div style={{ padding: '24px 16px', maxWidth: '480px', margin: '0 auto', paddingBottom: '100px' }}>
        <JoinQueueForm restaurantId={restaurant.id} />
      </div>


    </div>
  );
}
