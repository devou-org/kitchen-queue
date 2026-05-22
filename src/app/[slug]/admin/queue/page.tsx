'use client';
import { useRestaurant } from '@/hooks/useRestaurant';
import AdminQueueManager from '@/components/modules/queue/AdminQueueManager';

export default function AdminQueuePage() {
  const { restaurant, loading } = useRestaurant();

  if (loading || !restaurant) {
    return <div className="p-8 text-gray-500">Loading Queue Manager...</div>;
  }

  return (
    <div className="p-4 md:p-8 w-full max-w-7xl mx-auto">
      <AdminQueueManager restaurantId={restaurant.id} />
    </div>
  );
}
