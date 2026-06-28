'use client';
import { useRestaurant } from '@/hooks/useRestaurant';
import AdminQueueManager from '@/components/modules/queue/AdminQueueManager';

export default function AdminQueuePage() {
  const { restaurant, loading } = useRestaurant();

  if (loading || !restaurant) {
    return <div className="p-8 text-gray-500">Loading Queue Manager...</div>;
  }

  return (
    <AdminQueueManager restaurantId={restaurant.id} />
  );
}
