'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { Order } from '@/types';
import { getCurrentBusinessDate } from '@/lib/format';
import { pusherClient } from '@/lib/pusher-client';
import { orderService } from '@/app/services/orders.api';
import { useRestaurant } from '@/hooks/useRestaurant';
import { ChefHat, Search, X, Printer, Store, Loader2 } from 'lucide-react';
import { printUnifiedThermalTicket, getHardwarePrinterState, tryAutoConnectBluetooth } from '@/lib/hardware-printer';
import { CounterDrawer } from '@/components/CounterDrawer';
import { OrderTableRow, OrderTableHeader } from '@/components/modules/orders/OrderTableRow';
import OrderDetailsView from '@/components/modules/orders/OrderDetailsView';
import { AdminContentWrapper } from '@/components/AdminContentWrapper';
import { AdminPageHeader } from '@/components/AdminPageHeader';
import { Pagination } from '@/components/ui/Pagination';
import { KitchenSnapshotModal } from '@/components/modules/orders/KitchenSnapshotModal';
import { useAdminLayout } from '@/context/AdminLayoutContext';
import { CustomSelect } from '@/components/ui/CustomSelect';
import OrderTypeFilter from '@/components/modules/orders/OrderTypeFilter';
import { LayoutMaximizeToggle } from '@/components/LayoutMaximizeToggle';

export default function StaffOrders() {
  const { slug } = useParams();
  const { restaurant } = useRestaurant();
  const { isMaximized } = useAdminLayout();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('PENDING');
  const [orderTypeFilter, setOrderTypeFilter] = useState('');
  const [counterFilter, setCounterFilter] = useState('');
  const [page, setPage] = useState(1);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [tables, setTables] = useState<any[]>([]);
  const [counters, setCounters] = useState<any[]>([]);
  const [showKitchenSnapshot, setShowKitchenSnapshot] = useState(false);
  const [autoPrintKot, setAutoPrintKot] = useState(true);
  const [counterDrawerOpen, setCounterDrawerOpen] = useState(false);
  const ordersRef = useRef<Order[]>([]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedCounter = localStorage.getItem('qdine_orders_counter_filter');
      if (savedCounter !== null) setCounterFilter(savedCounter);
      const savedAutoPrint = localStorage.getItem('qdine_auto_print_kot');
      if (savedAutoPrint !== null) setAutoPrintKot(savedAutoPrint !== 'false');

      tryAutoConnectBluetooth();
    }
  }, []);

  const handleCounterFilterChange = (val: string) => {
    setCounterFilter(val);
    if (typeof window !== 'undefined') {
      localStorage.setItem('qdine_orders_counter_filter', val);
    }
  };

  const toggleAutoPrint = () => {
    const nextVal = !autoPrintKot;
    setAutoPrintKot(nextVal);
    if (typeof window !== 'undefined') {
      localStorage.setItem('qdine_auto_print_kot', String(nextVal));
    }
    toast.success(nextVal ? '🖨️ Auto-Print KOT: Enabled' : '⏸️ Auto-Print KOT: Paused');
  };

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

  const fetchCounters = useCallback(() => {
    if (!slug) return;
    const currentSlug = Array.isArray(slug) ? slug[0] : slug;
    fetch('/api/counters', {
      headers: {
        'x-restaurant-slug': currentSlug || '',
        'Authorization': `Bearer ${localStorage.getItem('admin_token') || localStorage.getItem('staff_token') || ''}`
      }
    })
      .then(res => res.json())
      .then(data => {
        if (data.success && Array.isArray(data.data)) {
          setCounters(data.data);
        }
      })
      .catch(() => {});
  }, [slug]);

  useEffect(() => {
    fetchTables();
    fetchCounters();
  }, [fetchTables, fetchCounters]);

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

    const handleKotAutoPrint = async (data: any) => {
      // Check if auto-print is enabled on this device
      const autoPrint = typeof window !== 'undefined' ? (localStorage.getItem('qdine_auto_print_kot') !== 'false') : true;
      if (!autoPrint) return;

      // Only filter if this station is an explicitly locked dedicated KDS station
      const dedicatedStation = typeof window !== 'undefined' ? (localStorage.getItem('qdine_dedicated_kds_station') || '') : '';
      if (dedicatedStation && dedicatedStation !== '' && dedicatedStation.toLowerCase() !== (data.counter_name || '').toLowerCase()) {
        console.log(`[Auto-Print] Station is dedicated to "${dedicatedStation}"; skipping "${data.counter_name}" slip.`);
        return;
      }

      toast(`🖨️ Auto-printing KOT #${String(data.ticket_number).padStart(3, '0')} (${data.counter_name})...`, {
        icon: '🖨️',
        duration: 3000,
      });

      try {
        const result = await printUnifiedThermalTicket({
          base64Bytes: data.base64Bytes,
          kotData: data.kotData,
          printerName: data.printer_name,
          counterId: data.counter_id,
          counterName: data.counter_name,
          isAutoPrint: true,
        });
        if (result.success) {
          toast.success(`🖨️ Auto-printed: ${data.counter_name} #${String(data.ticket_number).padStart(3, '0')} (${result.method})`, {
            id: `print-${data.order_id}-${data.counter_name}`,
          });
        } else {
          toast.error(result.message || '⚠️ Thermal printer not paired. Tap "Pair Printer" at the top.', {
            id: `print-unpaired`,
            duration: 6000,
          });
        }
      } catch (err: any) {
        console.error('Auto-print execution error:', err);
      }
    };

    channel.bind('new_order', handleNewOrder);
    channel.bind('order_update', handleOrderUpdate);
    channel.bind('kot_auto_print', handleKotAutoPrint);

    return () => {
      if (fetchDebounceRef.current) clearTimeout(fetchDebounceRef.current);
      channel.unbind('new_order', handleNewOrder);
      channel.unbind('order_update', handleOrderUpdate);
      channel.unbind('kot_auto_print', handleKotAutoPrint);
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
  
  let filteredOrders = orders;
  if (counterFilter) {
    filteredOrders = filteredOrders.map(order => {
      const filteredItems = (order.items || []).filter(item => item.counter === counterFilter);
      return { ...order, items: filteredItems };
    }).filter(order => order.items && order.items.length > 0);
  }

  const displayedOrders = filteredOrders.filter(order => {
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
      <style>{`
        /* Staff Orders — responsive rules for laptop (≤1280px), tablet, and mobile (≤640px) */
        .staff-orders-toolbar,
        .staff-orders-actions {
          display: flex;
          align-items: center;
          gap: 8px;
          width: 100%;
        }

        .staff-orders-table-scroll-hint {
          display: none;
        }

        /* Laptops & Tablets: Stack toolbar and actions into 2 clean rows below 1280px */
        @media (max-width: 1280px) {
          .staff-orders-page-header,
          .staff-orders-page-header .admin-header-left,
          .staff-orders-page-header .admin-header-right,
          .staff-orders-page-header .admin-header-search {
            flex: 1 1 100% !important;
            width: 100% !important;
            min-width: 0 !important;
          }

          .staff-orders-toolbar {
            display: flex !important;
            flex-wrap: wrap !important;
            width: 100% !important;
            gap: 8px !important;
          }

          .staff-orders-actions {
            display: flex !important;
            width: 100% !important;
            flex-wrap: wrap !important;
            justify-content: flex-start !important;
            gap: 8px !important;
          }
        }

        /* Mobile Screens: Full-width stacked controls below 640px */
        @media (max-width: 640px) {
          .staff-orders-toolbar {
            display: flex !important;
            flex-direction: column !important;
            width: 100% !important;
          }

          .staff-orders-toolbar > .staff-orders-search-control,
          .staff-orders-toolbar > .staff-orders-filter-control,
          .staff-orders-toolbar .staff-orders-select,
          .staff-orders-toolbar .staff-orders-select > button {
            width: 100% !important;
            min-width: 0 !important;
          }

          .staff-orders-actions > button,
          .staff-orders-actions > a,
          .staff-orders-actions > div {
            flex: 1 1 auto;
          }
        }
      `}</style>
      <AdminPageHeader
        className="staff-orders-page-header"
        style={{ paddingTop: '16px' }}
        hideMaximize={true}
        search={
          <div className="staff-orders-toolbar" style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', width: '100%' }}>
            {/* Search Input */}
            <div className="staff-orders-search-control" style={{ position: 'relative', width: '260px', flexShrink: 0 }}>
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
                placeholder="Search ticket, customer..."
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

            {/* Status Dropdown */}
            <div className="staff-orders-filter-control" style={{ width: '140px', flexShrink: 0 }}>
              <CustomSelect
                value={statusFilter}
                onChange={(val) => {
                  setStatusFilter(val);
                  setPage(1);
                }}
                options={allStatuses.map((s) => ({ value: s, label: s }))}
                buttonStyle={{ height: '38px', fontSize: '13px' }}
                style={{ width: '140px' }}
              />
            </div>

            {/* Order Type Dropdown */}
            <div className="staff-orders-filter-control" style={{ width: '160px', flexShrink: 0 }}>
              <OrderTypeFilter
                value={orderTypeFilter}
                onChange={(val) => {
                  setOrderTypeFilter(val);
                  setPage(1);
                }}
                style={{ width: '160px' }}
                buttonStyle={{ height: '38px', fontSize: '13px' }}
              />
            </div>

            {/* Counter Dropdown */}
            <div className="staff-orders-filter-control" style={{ width: '150px', flexShrink: 0 }}>
              <CustomSelect
                value={counterFilter}
                onChange={(val) => handleCounterFilterChange(val)}
                options={[
                  { value: '', label: 'All Counters' },
                  ...counters.map(c => ({ value: c.name, label: `${c.name} Station` }))
                ]}
                buttonStyle={{ height: '38px', fontSize: '13px' }}
                style={{ width: '150px' }}
              />
            </div>

            {/* Far Right Action Buttons */}
            <div className="staff-orders-actions" style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
              {/* Auto-Print Toggle Button */}
              <button
                onClick={toggleAutoPrint}
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '8px',
                  border: 'none',
                  background: autoPrintKot ? '#16A34A' : 'var(--primary, #0f172a)',
                  color: '#ffffff',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
                  transition: 'all 0.15s ease',
                  flexShrink: 0,
                }}
                title={autoPrintKot ? 'Auto-Print: ON' : 'Auto-Print: OFF'}
              >
                <Printer size={18} style={{ color: '#ffffff' }} />
              </button>

              {/* Counters & Hardware Drawer Trigger */}
              <button
                onClick={() => setCounterDrawerOpen(true)}
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'var(--primary, #0f172a)',
                  color: '#ffffff',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
                  transition: 'all 0.15s ease',
                  flexShrink: 0,
                }}
                title="Counters & Hardware"
              >
                <Store size={18} style={{ color: '#ffffff' }} />
              </button>

              {/* Kitchen Snapshot Button */}
              <button
                onClick={() => setShowKitchenSnapshot(true)}
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'var(--primary, #0f172a)',
                  color: '#ffffff',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
                  transition: 'all 0.15s ease',
                  flexShrink: 0,
                }}
                title="Kitchen Snapshot"
              >
                <ChefHat size={18} style={{ color: '#ffffff' }} />
              </button>

              {/* Maximize Layout Toggle */}
              <LayoutMaximizeToggle />
            </div>
          </div>
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

      <CounterDrawer
        isOpen={counterDrawerOpen}
        onClose={() => setCounterDrawerOpen(false)}
        slug={(Array.isArray(slug) ? slug[0] : slug) || ''}
        onCountersChange={fetchCounters}
      />
    </AdminContentWrapper>
  );
}
