'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { Order } from '@/types';
import { getCurrentBusinessDate } from '@/lib/format';
import { pusherClient } from '@/lib/pusher-client';
import { orderService } from '@/app/services/orders.api';
import { useRestaurant } from '@/hooks/useRestaurant';
import { ChefHat, Search, X } from 'lucide-react';
import { OrderTableRow, OrderTableHeader } from '@/components/modules/orders/OrderTableRow';
import OrderDetailsView from '@/components/modules/orders/OrderDetailsView';
import { AdminContentWrapper } from '@/components/AdminContentWrapper';
import { AdminPageHeader } from '@/components/AdminPageHeader';
import { Pagination } from '@/components/ui/Pagination';
import { KitchenSnapshotModal } from '@/components/modules/orders/KitchenSnapshotModal';
import { useAdminLayout } from '@/context/AdminLayoutContext';
import { CustomSelect } from '@/components/ui/CustomSelect';
import OrderTypeFilter from '@/components/modules/orders/OrderTypeFilter';

export default function StaffOrders() {
  const { slug } = useParams();
  const { restaurant } = useRestaurant();
  const { isMaximized } = useAdminLayout();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('PENDING');
  const [orderTypeFilter, setOrderTypeFilter] = useState('');
  const [page, setPage] = useState(1);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [tables, setTables] = useState<any[]>([]);
  const [showKitchenSnapshot, setShowKitchenSnapshot] = useState(false);
  const ordersRef = useRef<Order[]>([]);

  const fetchTables = useCallback(() => {
    if (!slug) return;
    const currentSlug = Array.isArray(slug) ? slug[0] : slug;
    fetch('/api/tables', {
      headers: { 'x-restaurant-slug': currentSlug || '' }
    })
      .then(res => res.json())
      .then(data => {
        if (data.success && Array.isArray(data.tables)) {
          setTables(data.tables);
        }
      })
      .catch(() => {});
  }, [slug]);

  useEffect(() => {
    fetchTables();
  }, [fetchTables]);

  const fetchOrders = useCallback(async (silent = false) => {
    if (!restaurant) return;
    if (!silent && ordersRef.current.length === 0) setLoading(true);
    try {
      const bDate = getCurrentBusinessDate(restaurant.timezone, restaurant.rollover_time);
      const data = await orderService.getOrders({
        page,
        per_page: 100,
        sort: 'ASC',
        date_from: bDate,
        date_to: bDate,
        status: statusFilter
      });

      if (data.success && data.data) {
        setOrders(data.data);
        ordersRef.current = data.data;
      }
    } catch {
      toast.error('Failed to load orders');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, restaurant]);

  const fetchDebounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (fetchDebounceRef.current) clearTimeout(fetchDebounceRef.current);
    fetchDebounceRef.current = setTimeout(() => {
      fetchOrders();
    }, 100);
    return () => {
      if (fetchDebounceRef.current) clearTimeout(fetchDebounceRef.current);
    };
  }, [fetchOrders]);

  const fetchOrdersDebounced = useCallback((silent = false) => {
    if (fetchDebounceRef.current) {
      clearTimeout(fetchDebounceRef.current);
    }
    fetchDebounceRef.current = setTimeout(() => {
      fetchOrders(silent);
      fetchTables();
      fetchDebounceRef.current = null;
    }, 400);
  }, [fetchOrders, fetchTables]);

  useEffect(() => {
    if (!pusherClient || !restaurant) return;

    const channelName = restaurant.pusher_channel || `queue-channel-${restaurant.id}`;
    const channel = pusherClient.subscribe(channelName);

    const handleNewOrder = (data: any) => {
      if (data.restaurant_id !== restaurant.id) return;
      toast(`🔔 New order #${String(data.ticket_number).padStart(3, '0')}`, { icon: '🛒', duration: 4000 });
      fetchOrdersDebounced();
      fetchTables();
    };

    const handleOrderUpdate = (data: any) => {
      if (data.restaurant_id !== restaurant.id) return;

      fetchTables();
      setOrders(prev => {
        const orderIndex = prev.findIndex(o => o.id === data.order_id);
        if (orderIndex === -1) return prev;

        return prev.map(o => {
          if (o.id === data.order_id) {
            return {
              ...o,
              status: data.new_status || o.status,
              table_number: data.table_number || o.table_number,
              is_paid: typeof data.is_paid === 'boolean' ? data.is_paid : o.is_paid,
            };
          }
          return o;
        }).filter(o => {
          if (statusFilter !== 'ALL') {
             return o.status === statusFilter;
          }
          return true;
        });
      });

      if (data.order_id) {
        orderService.getOrderById(data.order_id).then(res => {
          if (res.success && res.data) {
            const updated: Order = res.data;
            setSelectedOrder(prev => (prev?.id === data.order_id) ? updated : prev);
          }
        }).catch(() => {});
      }
    };

    channel.bind('new_order', handleNewOrder);
    channel.bind('order_update', handleOrderUpdate);

    return () => {
      if (fetchDebounceRef.current) clearTimeout(fetchDebounceRef.current);
      channel.unbind('new_order', handleNewOrder);
      channel.unbind('order_update', handleOrderUpdate);
    };
  }, [fetchOrdersDebounced, statusFilter, restaurant, fetchTables]);

  const handleStatusChange = async (id: string, newStatus: string, tableNumber?: string, pMethod?: string) => {
    setModalLoading(true);
    try {
      const data = await orderService.updateOrder(id, {
        status: newStatus,
        table_number: tableNumber,
        payment_method: pMethod || undefined
      });
      if (data.success) {
        fetchTables();
        setOrders(prev => {
          return prev.map(o => o.id === id ? { ...o, status: newStatus as Order['status'], table_number: tableNumber ?? o.table_number, payment_method: pMethod ?? o.payment_method } : o)
            .filter(o => {
              if (statusFilter) return o.status === statusFilter;
              return o.status === 'PENDING';
            });
        });
        setSelectedOrder((prev): Order | null => prev ? { ...prev, status: newStatus as Order['status'], table_number: tableNumber ?? prev.table_number, payment_method: pMethod ?? prev.payment_method } : null);
        toast.success(`Order updated to ${newStatus}`);
      } else {
        toast.error(data.error || 'Failed to update');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setModalLoading(false);
    }
  };

  const [searchQuery, setSearchQuery] = useState('');
  const allStatuses = ['PENDING', 'PREPARING', 'READY', 'PAID', 'CANCELLED'];

  const queryTerm = searchQuery.trim().toLowerCase();
  const displayedOrders = orders.filter(order => {
    if (orderTypeFilter && (order.order_type || 'dine_in') !== orderTypeFilter) {
      return false;
    }
    if (queryTerm) {
      const ticket = String(order.ticket_number).padStart(3, '0').toLowerCase();
      const rawTicket = String(order.ticket_number).toLowerCase();
      const customer = (order.customer_name || '').toLowerCase();
      const phone = (order.phone || '').toLowerCase();
      const table = (order.table_number || '').toLowerCase();
      const hasItem = (order.items || []).some(item => (item.product_name || '').toLowerCase().includes(queryTerm));
      return ticket.includes(queryTerm)
        || rawTicket.includes(queryTerm)
        || customer.includes(queryTerm)
        || phone.includes(queryTerm)
        || table.includes(queryTerm)
        || hasItem;
    }
    return true;
  });

  const openOrderModal = (order: Order) => {
    setSelectedOrder(order);
  };
  const closeModal = () => {
    setSelectedOrder(null);
  };

  return (
    <AdminContentWrapper fullWidth>
      <AdminPageHeader
        search={
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {/* Search Input */}
            <div style={{ position: 'relative', width: '220px' }}>
              <Search
                size={15}
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#94A3B8',
                  pointerEvents: 'none',
                }}
              />
              <input
                type="text"
                placeholder="Search ticket, customer, table..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  height: '38px',
                  paddingLeft: '34px',
                  paddingRight: searchQuery ? '30px' : '12px',
                  fontSize: '13px',
                  borderRadius: '8px',
                  background: 'white',
                  border: '1px solid var(--border)',
                  width: '100%',
                  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
                  outline: 'none',
                  color: 'var(--text-primary)',
                }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  style={{
                    position: 'absolute',
                    right: '8px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '4px',
                    borderRadius: '4px',
                    color: '#94A3B8',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  title="Clear search"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Status Dropdown (200px) */}
            <div style={{ width: '200px' }}>
              <CustomSelect
                value={statusFilter}
                onChange={(val) => {
                  setStatusFilter(val);
                  setPage(1);
                }}
                options={allStatuses.map((s) => ({ value: s, label: s }))}
                buttonStyle={{ height: '38px', fontSize: '13px' }}
                style={{ width: '200px' }}
              />
            </div>

            {/* Order Type Dropdown (200px) */}
            <div style={{ width: '200px' }}>
              <OrderTypeFilter
                value={orderTypeFilter}
                onChange={(val) => {
                  setOrderTypeFilter(val);
                  setPage(1);
                }}
                style={{ width: '200px' }}
                buttonStyle={{ height: '38px', fontSize: '13px' }}
              />
            </div>
          </div>
        }
        action={
          <button
            className="btn-minimal"
            onClick={() => setShowKitchenSnapshot(true)}
          >
            <ChefHat size={16} style={{ color: 'var(--primary)' }} /> Kitchen Snapshot
          </button>
        }
      />

      {/* Main Orders Table (always 100% full width, never adjusted or squeezed) */}
      <div
        className="card"
        style={{
          width: '100%',
          padding: 0,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          flex: isMaximized ? 1 : undefined,
          minHeight: isMaximized ? 'calc(100vh - 65px)' : 'calc(100vh - 96px)',
          transition: 'all 0.2s ease',
          borderRadius: '8px',
          border: '1px solid var(--border)',
          boxShadow: 'none',
        }}
      >

        <div className="table-wrapper" style={{ border: 'none', borderRadius: 0, overflowX: 'auto', flex: 1, display: 'flex', flexDirection: 'column' }}>
          {loading ? (
            <div style={{ padding: '80px', display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1 }}><div className="loader" /></div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', height: displayedOrders.length === 0 ? '100%' : 'auto' }}>
              <OrderTableHeader />
              <tbody>
                {displayedOrders.map(order => (
                  <OrderTableRow
                    key={order.id}
                    order={order}
                    isSelected={selectedOrder?.id === order.id}
                    onClick={() => openOrderModal(order)}
                  />
                ))}
                {displayedOrders.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '100px 20px', color: '#64748B' }}>
                      <div style={{ fontWeight: 600, fontSize: '15px', color: '#0F172A', marginBottom: '4px' }}>No orders found</div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        <Pagination
          currentPage={page}
          totalPages={orders.length < 100 && page === 1 ? 1 : orders.length < 100 ? page : page + 1}
          onPageChange={(p) => setPage(p)}
          totalRecords={displayedOrders.length}
          style={{ marginTop: 'auto' }}
        />
      </div>

      {/* Slide-over Order Details Drawer Overlay */}
      {selectedOrder && (
        <OrderDetailsView
          order={selectedOrder}
          slug={Array.isArray(slug) ? slug[0] : (slug || '')}
          isStaff={true}
          tables={tables}
          allStatuses={allStatuses}
          onClose={closeModal}
          onStatusChange={handleStatusChange}
          loading={modalLoading}
        />
      )}

      <KitchenSnapshotModal
        isOpen={showKitchenSnapshot}
        onClose={() => setShowKitchenSnapshot(false)}
        businessDate={restaurant ? getCurrentBusinessDate(restaurant.timezone, restaurant.rollover_time) : undefined}
      />
    </AdminContentWrapper>
  );
}
