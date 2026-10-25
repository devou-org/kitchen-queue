'use client';
import { useRestaurant } from '@/hooks/useRestaurant';
import AdminQueueManager from '@/components/modules/queue/AdminQueueManager';

export default function AdminQueuePage() {
  const { restaurant, loading } = useRestaurant();

  if (loading || !restaurant) {
    return (
      <div style={{ minHeight: 'calc(100vh - 180px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="loader" />
      </div>
    );
  }

  return (
    <AdminQueueManager restaurantId={restaurant.id} />
  );
}
