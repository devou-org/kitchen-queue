'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { AdminContentWrapper } from '@/components/AdminContentWrapper';
import { AdminPageHeader } from '@/components/AdminPageHeader';
import toast from 'react-hot-toast';
import { Order } from '@/types';
import { getCurrentBusinessDate } from '@/lib/format';
import { pusherClient } from '@/lib/pusher-client';
import { orderService } from '@/app/services/orders.api';
import { useRestaurant } from '@/hooks/useRestaurant';
import { ChefHat, Search, X, Printer, Store, Loader2 } from 'lucide-react';
import { printUnifiedThermalTicket, tryAutoConnectBluetooth } from '@/lib/hardware-printer';
import { CounterDrawer } from '@/components/CounterDrawer';
import { OrderTableRow, OrderTableHeader } from '@/components/modules/orders/OrderTableRow';
import OrderDetailsView from '@/components/modules/orders/OrderDetailsView';
import OrderTypeFilter from '@/components/modules/orders/OrderTypeFilter';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { Pagination } from '@/components/ui/Pagination';
import { KitchenSnapshotModal } from '@/components/modules/orders/KitchenSnapshotModal';
import { useAdminLayout } from '@/context/AdminLayoutContext';

interface OrderUpdateLog {
  id: string;
  order_id: string;
  ticket_number: number;
  table_number?: string;
  status: string;
  timestamp: string;
  message: string;
  items?: { product_name: string; quantity: number }[];
}

import { useParams } from 'next/navigation';

export default function AdminOrders() {
  const { slug } = useParams();
  const { isMaximized } = useAdminLayout();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [orderTypeFilter, setOrderTypeFilter] = useState('');
  const [counterFilter, setCounterFilter] = useState('');
  const [readySearch, setReadySearch] = useState('');
  const [page, setPage] = useState(1);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const ordersRef = useRef<Order[]>([]);

  // Kitchen Snapshot State
  const [showKitchenSnapshot, setShowKitchenSnapshot] = useState(false);

  // Live Updates Log
  const [recentUpdates, setRecentUpdates] = useState<OrderUpdateLog[]>([]);
  const [queueStatuses, setQueueStatuses] = useState<string[]>([]);
  const [statusesLoaded, setStatusesLoaded] = useState(false);
  const [tables, setTables] = useState<any[]>([]);
  const [counters, setCounters] = useState<any[]>([]);
  const { restaurant } = useRestaurant();
  const [autoPrintKot, setAutoPrintKot] = useState(true);
  const [counterDrawerOpen, setCounterDrawerOpen] = useState(false);

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

  const fetchCounters = useCallback(() => {
    if (!slug) return;
    fetch('/api/counters', {
      headers: {
        'x-restaurant-slug': (Array.isArray(slug) ? slug[0] : slug) || '',
        'Authorization': `Bearer ${localStorage.getItem('admin_token') || localStorage.getItem('staff_token') || ''}`
      }
    })
      .then(res => res.json())
      .then(data => {
        if (data.success && data.data) setCounters(data.data);
      })
      .catch(() => {});
  }, [slug]);

  useEffect(() => {
    fetchCounters();
  }, [fetchCounters]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(`kitchenQueue_liveAdditions_${Array.isArray(slug) ? slug[0] : slug}`);
      if (stored) {
        setRecentUpdates(JSON.parse(stored));
      }
    } catch (e) {
      console.error('Failed to load live additions', e);
    }
  }, [slug]);

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
      .catch(() => { });
  }, [slug]);

  useEffect(() => {
    fetchTables();
  }, [fetchTables]);

  useEffect(() => {
    const fetchStatuses = async () => {
      try {
        const res = await fetch('/api/queue/statuses', {
          headers: { 'x-restaurant-slug': (Array.isArray(slug) ? slug[0] : slug) || '' }
        });
        const data = await res.json();
        if (data.success && data.data && data.data.length > 0) {
          setQueueStatuses(data.data.map((s: any) => s.possible_queue_status));
        } else {
          // Fallback if no dynamic statuses found
          setQueueStatuses(['PENDING', 'PREPARING', 'READY', 'PAID', 'CANCELLED']);
        }
      } catch (err) {
        console.error('Failed to fetch queue statuses', err);
        setQueueStatuses(['PENDING', 'PREPARING', 'READY', 'PAID', 'CANCELLED']);
      } finally {
        setStatusesLoaded(true);
      }
    };
    fetchStatuses();
  }, [slug]);

  const dismissUpdate = (id: string) => {
    setRecentUpdates(prev => {
      const updated = prev.filter(u => u.id !== id);
      localStorage.setItem(`kitchenQueue_liveAdditions_${Array.isArray(slug) ? slug[0] : slug}`, JSON.stringify(updated));
      return updated;
    });
  };

  const fetchOrders = useCallback(async (silent = false) => {
    if (!restaurant) return;
    if (!silent) setLoading(true);
    try {
      const currentDefault = queueStatuses.length > 0 ? queueStatuses[0] : 'PENDING';
      const bDate = getCurrentBusinessDate(restaurant.timezone, restaurant.rollover_time);

      const data = await orderService.getOrders({
        page,
        per_page: 100,
        sort: 'ASC',
        date_from: bDate,
        date_to: bDate,
        status: statusFilter || currentDefault,
        order_type: orderTypeFilter || undefined,
      });

      if (data.success && data.data) {
        setOrders(data.data);
        ordersRef.current = data.data;
      } else {
        setOrders([]);
        ordersRef.current = [];
      }
    } catch (err) {
      console.error('Failed to load orders', err);
      toast.error('Failed to load orders');
      setOrders([]);
      ordersRef.current = [];
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, orderTypeFilter, queueStatuses, restaurant]);

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
    }, 400); // 400ms buffer to batch multiple updates
  }, [fetchOrders, fetchTables]);

  useEffect(() => {
    if (!pusherClient || !restaurant) return;
    const channelName = restaurant.pusher_channel;
    const channel = pusherClient.subscribe(channelName);

    const handleNewOrder = (data: any) => {
      toast.success(`New order created: #${String(data.ticket_number).padStart(3, '0')}`);
      fetchOrdersDebounced(true);
      fetchTables();
    };

    const handleOrderUpdate = (data: any) => {
      fetchTables();
      // 1. PATCH LOCAL STATE (The "incremental" way)
      // This makes the UI update INSTANTLY without a network request
      setOrders(prev => {
        const orderIndex = prev.findIndex(o => o.id === data.order_id);
        if (orderIndex === -1) return prev; // Not in current filter, ignore

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
          // If statusFilter is empty, we are in the default view
          const currentDefault = queueStatuses.length > 0 ? queueStatuses[0] : 'PENDING';
          const currentFilter = statusFilter || currentDefault;
          if (currentFilter !== 'ALL') {
            return o.status === currentFilter;
          }
          return true;
        });
      });

      // 2. HIGHLIGHT & LOG ADDITIONS
      // Only log and highlight if items were actually added to an active order
      const currentStatus = data.new_status || 'PENDING';
      const isTerminal = currentStatus === 'PAID' || currentStatus === 'CANCELLED' || currentStatus === 'EXPIRED';
      if (data.items_updated && data.added_items && !isTerminal) {

        const newUpdate: OrderUpdateLog = {
          id: Math.random().toString(),
          order_id: data.order_id,
          ticket_number: data.ticket_number,
          table_number: data.table_number,
          status: data.new_status || 'PREPARING',
          timestamp: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
          message: `New items added`,
          items: data.added_items
        };

        // FCFS: Add to the end, oldest stays at index 0
        setRecentUpdates(up => {
          const updated = [...up, newUpdate].slice(-10);
          localStorage.setItem(`kitchenQueue_liveAdditions_${Array.isArray(slug) ? slug[0] : slug}`, JSON.stringify(updated));
          return updated;
        });

        toast(
          `🛒 Customer added items to order #${String(data.ticket_number).padStart(3, '0')}`,
          { icon: '🟢', duration: 5000, style: { fontWeight: 700 } }
        );

        // Full background refresh to get accurate totals/item list
        fetchOrdersDebounced(true);
      } else if (!data.items_updated) {
        // Just a status/payment change? Local patch above is enough, 
        // no need to re-fetch unless you want absolute safety.
      }

      // Sync Modal if open
      if (data.order_id) {
        orderService.getOrderById(data.order_id).then(res => {
          if (res.success && res.data) {
            const updated: Order = res.data;
            setSelectedOrder(prev => (prev?.id === data.order_id) ? updated : prev);
          }
        }).catch(() => { });
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
  }, [fetchOrdersDebounced, statusFilter, restaurant]);

  const handleStatusChange = async (id: string, newStatus: string, tableNumber?: string, pMethod?: string) => {
    setModalLoading(true);
    try {
      const data = await orderService.updateOrder(id, {
        status: newStatus,
        table_number: tableNumber,
        payment_method: pMethod || undefined
      });
      if (data.success) {
        // Success feedback handled by Pusher event to avoid duplicates
        // Update local state instantly for UI responsiveness
        setOrders(prev => {
          const currentDefault = queueStatuses.length > 0 ? queueStatuses[0] : 'PENDING';
          return prev.map(o => o.id === id ? { ...o, status: newStatus as Order['status'], table_number: tableNumber ?? o.table_number, payment_method: pMethod ?? o.payment_method } : o)
            .filter(o => {
              if (statusFilter) return o.status === statusFilter;
              return o.status === currentDefault;
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

  const allStatuses = queueStatuses.length > 0 ? queueStatuses : ['PENDING', 'PREPARING', 'READY', 'PAID', 'CANCELLED'];
  // Active statuses exclude the first one usually (which is like PENDING or WAITING)
  const defaultStatus = allStatuses[0] || 'PENDING';
  const activeStatuses = allStatuses.slice(1);

  let filteredOrders = orders;
  if (counterFilter) {
    filteredOrders = filteredOrders.map(order => {
      const filteredItems = (order.items || []).filter(item => item.counter === counterFilter);
      return { ...order, items: filteredItems };
    }).filter(order => order.items && order.items.length > 0);
  }

  const queryTerm = readySearch.trim().toLowerCase();
  const displayedOrders = queryTerm
    ? filteredOrders.filter(order => {
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
      })
    : filteredOrders;

  const openOrderModal = (order: Order) => {
    setSelectedOrder(order);
  };
  const closeModal = () => {
    setSelectedOrder(null);
  };

  return (
    <AdminContentWrapper fullWidth>
      <style>{`
        /* Kept page-scoped so the mobile behavior of other admin screens is unchanged. */
        .orders-toolbar,
        .orders-actions {
          display: flex;
          align-items: center;
          gap: 8px;
          width: 100%;
        }

        .orders-table-scroll-hint {
          display: none;
        }

        @media (max-width: 768px) {
          .orders-page-header,
          .orders-page-header .admin-header-left,
          .orders-page-header .admin-header-right,
          .orders-page-header .admin-header-search {
            flex: 1 1 100% !important;
            width: 100% !important;
            min-width: 0 !important;
          }

          .orders-toolbar {
            display: grid !important;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            width: 100% !important;
            min-width: 0 !important;
            gap: 8px !important;
          }

          .orders-toolbar > .orders-search-control {
            grid-column: 1 / -1;
            width: 100% !important;
            min-width: 0 !important;
          }

          .orders-toolbar > .orders-filter-control,
          .orders-toolbar .orders-select,
          .orders-toolbar .orders-select > button {
            width: 100% !important;
            min-width: 0 !important;
          }

          .orders-actions {
            width: 100% !important;
            flex-wrap: wrap;
            justify-content: flex-start;
          }

          .orders-table-card {
            min-height: auto !important;
          }

          .orders-table-viewport {
            overflow-x: auto !important;
            overscroll-behavior-x: contain;
            -webkit-overflow-scrolling: touch;
          }

          .orders-table-viewport .orders-table {
            min-width: 840px;
          }

          .orders-table-scroll-hint {
            display: block;
            padding: 8px 12px;
            border-bottom: 1px solid var(--border);
            background: #F8FAFC;
            color: var(--text-secondary);
            font-size: 12px;
            font-weight: 600;
          }
        }

        @media (max-width: 480px) {
          .orders-toolbar {
            display: flex !important;
            flex-direction: column !important;
            width: 100% !important;
          }

          .orders-toolbar > .orders-search-control,
          .orders-toolbar > .orders-filter-control {
            width: 100% !important;
          }

          .orders-actions {
            display: flex !important;
            width: 100% !important;
            flex-wrap: wrap;
            gap: 8px !important;
          }

          .orders-actions > button,
          .orders-actions > a,
          .orders-actions > div {
            flex: 1 1 auto;
          }
        }
      `}</style>
      <AdminPageHeader
        className="orders-page-header"
        style={{ paddingTop: '16px' }}
        search={
          <div className="orders-toolbar">
            {/* Search Input */}
            <div className="orders-search-control" style={{ position: 'relative', width: '185px', flexShrink: 0 }}>
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
                value={readySearch}
                onChange={(e) => setReadySearch(e.target.value)}
                style={{
                  height: '38px',
                  paddingLeft: '34px',
                  paddingRight: readySearch ? '30px' : '12px',
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
              {readySearch && (
                <button
                  type="button"
                  onClick={() => setReadySearch('')}
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

            {/* Status Dropdown (135px) */}
            <div className="orders-filter-control" style={{ width: '135px', flexShrink: 0 }}>
              <CustomSelect
                value={statusFilter}
                onChange={(val) => {
                  setStatusFilter(val);
                  setPage(1);
                }}
                options={
                  !statusesLoaded
                    ? [{ value: '', label: 'Loading...' }]
                    : [
                      { value: '', label: defaultStatus },
                      ...activeStatuses.map((s) => ({ value: s, label: s })),
                    ]
                }
                disabled={!statusesLoaded}
                buttonStyle={{ height: '38px', fontSize: '13px' }}
                className="orders-select"
                style={{ width: '135px' }}
              />
            </div>

            {/* Order Type Dropdown (145px) */}
            <div className="orders-filter-control" style={{ width: '145px', flexShrink: 0 }}>
              <OrderTypeFilter
                value={orderTypeFilter}
                onChange={(val) => {
                  setOrderTypeFilter(val);
                  setPage(1);
                }}
                className="orders-select"
                style={{ width: '145px' }}
                buttonStyle={{ height: '38px', fontSize: '13px' }}
              />
            </div>

            {/* Counter Dropdown (140px) */}
            <div className="orders-filter-control" style={{ width: '140px', flexShrink: 0 }}>
              <CustomSelect
                value={counterFilter}
                onChange={(val) => handleCounterFilterChange(val)}
                options={[
                  { value: '', label: 'All Counters' },
                  ...counters.map(c => ({ value: c.name, label: `${c.name} Station` }))
                ]}
                buttonStyle={{ height: '38px', fontSize: '13px' }}
                className="orders-select"
                style={{ width: '140px' }}
              />
            </div>
          </div>
        }
        action={
          <div className="orders-actions">
            {/* Auto-Print Toggle Button */}
            <button
              onClick={toggleAutoPrint}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                height: '38px',
                padding: '0 12px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 600,
                border: autoPrintKot ? '1px solid #86EFAC' : '1px solid var(--border)',
                background: autoPrintKot ? '#F0FDF4' : '#F8FAFC',
                color: autoPrintKot ? '#166534' : 'var(--text-secondary)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              title={autoPrintKot ? 'Auto-Print is ON: Thermal KOT prints automatically when orders enter PREPARING' : 'Auto-Print is Paused'}
            >
              <Printer size={15} style={{ color: autoPrintKot ? '#16A34A' : '#94A3B8' }} />
              <span>{autoPrintKot ? 'Auto-Print: ON' : 'Auto-Print: OFF'}</span>
            </button>

            {/* Counters & Hardware Drawer Trigger */}
            <button
              onClick={() => setCounterDrawerOpen(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                height: '38px',
                padding: '0 12px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 600,
                border: '1px solid var(--border)',
                background: '#FFFFFF',
                color: '#0F172A',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              title="Configure Kitchen Counters & Thermal Hardware"
            >
              <Store size={15} style={{ color: '#2563EB' }} />
              <span className="hidden sm:inline">Counters & Hardware</span>
            </button>

            <button
              className="btn-minimal"
              onClick={() => setShowKitchenSnapshot(true)}
            >
              <ChefHat size={16} style={{ color: 'var(--primary)' }} /> Kitchen Snapshot
            </button>
          </div>
        }
      />

      {recentUpdates.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: 'var(--success)' }}></span>
            <h2 style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Live Additions</h2>
          </div>
          <div className="live-updates-container">
            {recentUpdates.map(update => (
              <div
                key={update.id}
                className="card live-update-card animate-fade-in"
                style={{
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  borderLeft: '4px solid var(--success)',
                  position: 'relative'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '8px', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                    <div style={{ fontSize: '24px', fontWeight: 900, color: 'var(--primary)' }}>#{String(update.ticket_number).padStart(3, '0')}</div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                        <span className={`badge badge-${update.status.toLowerCase()}`}>{update.status}</span>
                        {update.table_number && (
                          <span style={{ fontSize: '10px', fontWeight: 800, color: 'white', background: 'var(--primary)', padding: '2px 6px', borderRadius: '4px' }}>🪑 T-{update.table_number}</span>
                        )}
                      </div>
                      <p style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>{update.message}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => dismissUpdate(update.id)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '18px', padding: '0 4px', lineHeight: 1 }}
                  >
                    ✕
                  </button>
                </div>

                {update.items && update.items.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '8px' }}>
                    {update.items.map((item, idx) => (
                      <div key={idx} style={{ background: 'rgba(0,0,0,0.04)', padding: '2px 4px', borderRadius: '4px', fontSize: '10px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        <span style={{ color: 'var(--primary)' }}>{item.quantity}x</span> {item.product_name}
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid rgba(0,0,0,0.03)', paddingTop: '8px' }}>
                  <div style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: 700 }}>{update.timestamp}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
            <div style={{ padding: '60px', display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1 }}><div className="loader" /></div>
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
                  <tr><td colSpan={7} style={{ textAlign: 'center', padding: '60px', color: '#64748B', fontSize: '14px' }}>No active orders found</td></tr>
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
