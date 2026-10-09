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
import { ChefHat, Search, X, Printer, Store, Loader2, ClipboardList, Sparkles, RotateCcw, UtensilsCrossed, ArrowRight } from 'lucide-react';
import { printUnifiedThermalTicket, tryAutoConnectBluetooth } from '@/lib/hardware-printer';
import { CounterDrawer } from '@/components/CounterDrawer';
import { OrderTableRow, OrderTableHeader } from '@/components/modules/orders/OrderTableRow';
import OrderDetailsView from '@/components/modules/orders/OrderDetailsView';
import OrderStatusBadge from '@/components/modules/orders/OrderStatusBadge';
import OrderTypeFilter from '@/components/modules/orders/OrderTypeFilter';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { Pagination } from '@/components/ui/Pagination';
import { KitchenSnapshotModal } from '@/components/modules/orders/KitchenSnapshotModal';
import { useAdminLayout } from '@/context/AdminLayoutContext';
import { LayoutMaximizeToggle } from '@/components/LayoutMaximizeToggle';

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
  const [statusFilter, setStatusFilter] = useState('PREPARING');
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
  const [tables, setTables] = useState<any[]>([]);
  const [counters, setCounters] = useState<any[]>([]);
  const { restaurant } = useRestaurant();
  const [autoPrintKot, setAutoPrintKot] = useState(false);
  const [counterDrawerOpen, setCounterDrawerOpen] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedCounter = localStorage.getItem('qdine_orders_counter_filter');
      if (savedCounter !== null) setCounterFilter(savedCounter);
      const savedAutoPrint = localStorage.getItem('qdine_auto_print_kot');
      if (savedAutoPrint !== null) setAutoPrintKot(savedAutoPrint === 'true');

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
      localStorage.setItem('qdine_auto_print_bill', String(nextVal));
    }
    toast.success(nextVal ? '🖨️ Auto-Print: Enabled' : '⏸️ Auto-Print: Paused');
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

  const dismissUpdate = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setRecentUpdates(prev => {
      const updated = prev.filter(u => u.id !== id);
      localStorage.setItem(`kitchenQueue_liveAdditions_${Array.isArray(slug) ? slug[0] : slug}`, JSON.stringify(updated));
      return updated;
    });
  };

  const clearAllUpdates = () => {
    setRecentUpdates([]);
    localStorage.removeItem(`kitchenQueue_liveAdditions_${Array.isArray(slug) ? slug[0] : slug}`);
  };

  const handleUpdateClick = async (update: OrderUpdateLog) => {
    const existing = orders.find(o => o.id === update.order_id);
    if (existing) {
      setSelectedOrder(existing);
    } else {
      try {
        setModalLoading(true);
        const res = await orderService.getOrderById(update.order_id);
        if (res.success && res.data) {
          setSelectedOrder(res.data);
        }
      } catch (err) {
        console.error('Failed to load order from live addition:', err);
      } finally {
        setModalLoading(false);
      }
    }
  };

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
        status: (statusFilter && statusFilter !== 'ALL') ? statusFilter : undefined,
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
  }, [page, statusFilter, orderTypeFilter, restaurant?.timezone, restaurant?.rollover_time]);

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
              items: data.items || o.items,
            };
          }
          return o;
        }).filter(o => {
          const currentFilter = statusFilter && statusFilter !== 'ALL' ? statusFilter : undefined;
          if (currentFilter) {
            return o.status === currentFilter;
          }
          return true;
        });
      });

      setSelectedOrder(prev => {
        if (prev && prev.id === data.order_id) {
          return {
            ...prev,
            status: data.new_status || prev.status,
            table_number: data.table_number || prev.table_number,
            is_paid: typeof data.is_paid === 'boolean' ? data.is_paid : prev.is_paid,
            items: data.items || prev.items,
          };
        }
        return prev;
      });

      // 2. HIGHLIGHT & LOG ADDITIONS
      // Only log and highlight if items were actually added to an active order
      const currentStatus = data.new_status || 'PENDING';
      const isTerminal = currentStatus === 'CLOSED' || currentStatus === 'CANCELLED' || currentStatus === 'EXPIRED';
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
      const autoPrint = typeof window !== 'undefined' ? (localStorage.getItem('qdine_auto_print_kot') === 'true') : false;
      if (!autoPrint) return;

      // Only filter if this station is an explicitly locked dedicated KDS station
      const dedicatedStation = typeof window !== 'undefined' ? (localStorage.getItem('qdine_dedicated_kds_station') || '') : '';
      if (dedicatedStation && dedicatedStation !== '' && dedicatedStation.toLowerCase() !== (data.counter_name || '').toLowerCase()) {
        console.log(`[Auto-Print] Station is dedicated to "${dedicatedStation}"; skipping "${data.counter_name}" slip.`);
        return;
      }

      const label = data.is_add_on ? `Add-on KOT (${data.counter_name || 'Counter'})` : (data.counter_name || 'KOT');

      // If server already printed directly via Wi-Fi TCP or Windows spooler
      if (data.server_printed) {
        toast.success(`🖨️ Auto-printed: ${label} #${String(data.ticket_number).padStart(3, '0')} (Wi-Fi)`, {
          id: data.is_add_on ? `print-${data.order_id}-${data.counter_name}-${Date.now()}` : `print-${data.order_id}-${data.counter_name}`,
        });
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

        const label = data.is_add_on ? `Add-on KOT (${data.counter_name || 'Counter'})` : (data.counter_name || 'KOT');
        if (result.success) {
          toast.success(`🖨️ Auto-printed: ${label} #${String(data.ticket_number).padStart(3, '0')} (${result.method})`, {
            id: data.is_add_on ? `print-${data.order_id}-${data.counter_name}-${Date.now()}` : `print-${data.order_id}-${data.counter_name}`,
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
        is_paid: newStatus === 'CLOSED' ? true : newStatus === 'CANCELLED' ? false : undefined,
        table_number: tableNumber,
        payment_method: pMethod || undefined
      });
      if (data.success) {
        // Success feedback handled by Pusher event to avoid duplicates
        // Update local state instantly for UI responsiveness
        setOrders(prev => {
          const currentFilter = statusFilter && statusFilter !== 'ALL' ? statusFilter : undefined;
          return prev.map(o => o.id === id ? {
            ...o,
            status: newStatus as Order['status'],
            table_number: tableNumber ?? o.table_number,
            payment_method: pMethod ?? o.payment_method,
            is_paid: newStatus === 'CLOSED' ? true : newStatus === 'CANCELLED' ? false : o.is_paid
          } : o)
            .filter(o => {
              if (currentFilter) return o.status === currentFilter;
              return true;
            });
        });
        setSelectedOrder((prev): Order | null => prev ? {
          ...prev,
          status: newStatus as Order['status'],
          table_number: tableNumber ?? prev.table_number,
          payment_method: pMethod ?? prev.payment_method,
          is_paid: newStatus === 'CLOSED' ? true : newStatus === 'CANCELLED' ? false : prev.is_paid
        } : null);
        toast.success(`Order updated to ${newStatus}`, { id: `order-status-${id}` });
      } else {
        toast.error(data.error || 'Failed to update');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setModalLoading(false);
    }
  };

  const isKotMode = (restaurant?.kitchen_mode || 'KOT').toUpperCase() !== 'KDS';
  const allStatuses = isKotMode
    ? ['PENDING', 'PREPARING', 'SERVED', 'CLOSED', 'CANCELLED']
    : ['PENDING', 'PREPARING', 'READY', 'SERVED', 'CLOSED', 'CANCELLED'];
  const statusOptions = [
    { value: 'ALL', label: 'All Statuses' },
    ...allStatuses.map((s) => ({ value: s, label: s })),
  ];
  // Active statuses exclude the first one usually (which is like PENDING or WAITING)
  const defaultStatus = allStatuses[0] || 'PENDING';
  const activeStatuses = allStatuses.slice(1);

  let filteredOrders = orders;
  if (counterFilter) {
    filteredOrders = filteredOrders.map(order => {
      const filteredItems = (order.items || []).filter(item => (item.counter || 'Kitchen').toLowerCase() === counterFilter.toLowerCase());
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
    <AdminContentWrapper fullWidth style={{ paddingTop: 0, paddingLeft: 0, paddingRight: 0, maxWidth: '100%' }}>
      <style>{`
        /* Page-scoped responsive rules to guarantee single-row header toolbar on desktop, laptops, and tablets */
        .orders-page-header {
          height: 68px !important;
          min-height: 68px !important;
          display: flex !important;
          align-items: center !important;
          margin: 0 !important;
          padding: 0 20px !important;
          border-bottom: 1px solid var(--border) !important;
          background: #FFFFFF !important;
          box-sizing: border-box !important;
        }

        .orders-page-header .admin-page-header-container {
          height: 68px !important;
          min-height: 68px !important;
          display: flex !important;
          align-items: center !important;
          margin: 0 !important;
          padding: 0 !important;
          gap: 12px !important;
          width: 100% !important;
        }

        .orders-toolbar {
          display: flex !important;
          flex-wrap: nowrap !important;
          align-items: center !important;
          gap: 6px !important;
          width: 100% !important;
        }

        .orders-search-control {
          position: relative !important;
          height: 38px !important;
        }

        .orders-actions {
          display: flex !important;
          flex-wrap: nowrap !important;
          align-items: center !important;
          gap: 6px !important;
          margin-left: auto !important;
          flex-shrink: 0 !important;
        }

        .orders-table-scroll-hint {
          display: none;
        }

        /* Mobile Screens: Full-width stacked controls below 640px */
        @media (max-width: 640px) {
          .orders-page-header {
            height: auto !important;
            min-height: auto !important;
            padding: 12px 16px !important;
          }

          .orders-toolbar {
            display: flex !important;
            flex-direction: column !important;
            flex-wrap: wrap !important;
            align-items: stretch !important;
            gap: 10px !important;
            width: 100% !important;
          }

          .orders-search-control {
            flex: none !important;
            height: 38px !important;
            width: 100% !important;
            max-width: 100% !important;
            min-width: 0 !important;
          }

          .orders-toolbar > .orders-filter-control,
          .orders-toolbar > .orders-filter-control > div,
          .orders-toolbar .orders-select,
          .orders-toolbar .orders-select > button {
            width: 100% !important;
            min-width: 0 !important;
          }

          .orders-actions {
            width: 100% !important;
            margin-left: 0 !important;
            justify-content: flex-start !important;
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
        style={{ paddingTop: 0, minHeight: '68px', display: 'flex', alignItems: 'center', marginBottom: 0 }}
        hideMaximize={true}
        search={
          <div className="orders-toolbar" style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'nowrap', width: '100%', minWidth: 0 }}>
            {/* Search Input */}
            <div className="orders-search-control" style={{ position: 'relative', width: '240px', flex: '0 0 240px', minWidth: '140px', maxWidth: '300px', flexShrink: 0 }}>
              <Search
                size={14}
                style={{
                  position: 'absolute',
                  left: '10px',
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
                  paddingLeft: '30px',
                  paddingRight: readySearch ? '26px' : '8px',
                  fontSize: '12px',
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
                    right: '6px',
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
            <div className="orders-filter-control" style={{ width: '130px', flexShrink: 0 }}>
              <CustomSelect
                value={statusFilter || 'ALL'}
                onChange={(val) => {
                  setStatusFilter(val === 'ALL' ? '' : val);
                  setPage(1);
                }}
                options={statusOptions}
                buttonStyle={{ height: '38px', fontSize: '12px', padding: '0 8px' }}
                className="orders-select"
                style={{ width: '130px' }}
              />
            </div>

            {/* Order Type Dropdown */}
            <div className="orders-filter-control" style={{ width: '150px', flexShrink: 0 }}>
              <OrderTypeFilter
                value={orderTypeFilter}
                onChange={(val) => {
                  setOrderTypeFilter(val);
                  setPage(1);
                }}
                className="orders-select"
                style={{ width: '150px' }}
                buttonStyle={{ height: '38px', fontSize: '12px', padding: '0 8px' }}
              />
            </div>

            {/* Counter Dropdown */}
            <div className="orders-filter-control" style={{ width: '135px', flexShrink: 0 }}>
              <CustomSelect
                value={counterFilter}
                onChange={(val) => handleCounterFilterChange(val)}
                options={[
                  { value: '', label: 'All Counters' },
                  ...counters.map(c => ({ value: c.name, label: `${c.name} Station` }))
                ]}
                buttonStyle={{ height: '38px', fontSize: '12px', padding: '0 8px' }}
                className="orders-select"
                style={{ width: '135px' }}
              />
            </div>
            {/* Far Right Action Buttons */}
            <div className="orders-actions" style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
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

      {recentUpdates.length > 0 && (
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', background: '#F8FAFC' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{
                position: 'relative',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '16px',
                height: '16px',
              }}>
                <span style={{
                  position: 'absolute',
                  width: '100%',
                  height: '100%',
                  borderRadius: '50%',
                  backgroundColor: '#10B981',
                  opacity: 0.35,
                  animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                }} />
                <span style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: '#10B981',
                }} />
              </span>
              <h2 style={{
                fontSize: '12px',
                fontWeight: 800,
                color: '#475569',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                margin: 0,
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                Live Additions
                <span style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '1px 8px',
                  borderRadius: '12px',
                  background: 'rgba(16, 185, 129, 0.1)',
                  color: '#047857',
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                  textTransform: 'none',
                  letterSpacing: 'normal'
                }}>
                  {recentUpdates.length} {recentUpdates.length === 1 ? 'addition' : 'additions'}
                </span>
              </h2>
            </div>
            {recentUpdates.length > 1 && (
              <button
                type="button"
                onClick={clearAllUpdates}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#64748B',
                  cursor: 'pointer',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  transition: 'color 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#0F172A')}
                onMouseLeave={(e) => (e.currentTarget.style.color = '#64748B')}
              >
                Clear all
              </button>
            )}
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: '12px',
          }}>
            {recentUpdates.map(update => (
              <div
                key={update.id}
                onClick={() => handleUpdateClick(update)}
                className="animate-fade-in"
                style={{
                  backgroundColor: '#FFFFFF',
                  border: '1px solid var(--border)',
                  borderRadius: '10px',
                  padding: '12px 14px',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  transition: 'all 0.15s ease',
                  position: 'relative',
                  overflow: 'hidden',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--primary)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.06)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border)';
                  e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.04)';
                }}
              >
                {/* Accent Top Bar */}
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: '3px',
                  backgroundColor: 'var(--primary, #971345)',
                }} />

                {/* Top Row: Ticket Number + Status Badge + Table + Timestamp + Dismiss */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{
                      fontFamily: 'monospace, var(--font-mono)',
                      fontSize: '15px',
                      fontWeight: 800,
                      color: '#0F172A',
                      letterSpacing: '-0.02em',
                    }}>
                      #{String(update.ticket_number).padStart(3, '0')}
                    </span>
                    <OrderStatusBadge status={update.status} />
                    {update.table_number && (
                      <span style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        color: '#334155',
                        background: '#F1F5F9',
                        padding: '2px 7px',
                        borderRadius: '6px',
                        border: '1px solid #E2E8F0',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        🪑 {update.table_number.toLowerCase().startsWith('t') ? update.table_number : `T-${update.table_number}`}
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 600 }}>
                      {update.timestamp}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => dismissUpdate(update.id, e)}
                      title="Dismiss notification"
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '4px',
                        borderRadius: '4px',
                        color: '#94A3B8',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#F1F5F9';
                        e.currentTarget.style.color = '#0F172A';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                        e.currentTarget.style.color = '#94A3B8';
                      }}
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>

                {/* Items Added Pills */}
                {update.items && update.items.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {update.items.map((item, idx) => (
                      <div
                        key={idx}
                        style={{
                          backgroundColor: '#F8FAFC',
                          border: '1px solid #E2E8F0',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: 600,
                          color: '#0F172A',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px'
                        }}
                      >
                        <span style={{ color: 'var(--primary)', fontWeight: 800 }}>
                          {item.quantity}x
                        </span>
                        <span>{item.product_name}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Bottom Row */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingTop: '6px',
                  borderTop: '1px solid #F1F5F9',
                  fontSize: '11px',
                  color: '#64748B',
                  fontWeight: 600
                }}>
                  <span>{update.message}</span>
                  <span style={{
                    color: 'var(--primary)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '2px',
                    fontWeight: 700
                  }}>
                    View order <ArrowRight size={12} />
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Orders Table (starts directly from the 68px bottom line in the logo header) */}
      <div
        className="card orders-table-card"
        style={{
          width: '100%',
          maxWidth: '100%',
          padding: 0,
          margin: 0,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          minHeight: isMaximized ? 'calc(100vh - 68px)' : 'calc(100vh - 68px)',
          transition: 'all 0.2s ease',
          borderRadius: 0,
          border: 'none',
          boxShadow: 'none',
          background: '#FFFFFF',
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
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '80px 20px', verticalAlign: 'middle', background: '#FFFFFF' }}>
                      <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto',
                        maxWidth: '400px',
                      }}>
                        {/* Logo / Illustration Container */}
                        <div style={{
                          width: '76px',
                          height: '76px',
                          borderRadius: '22px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginBottom: '18px',
                          position: 'relative',
                        }}>
                          {readySearch || statusFilter || orderTypeFilter || counterFilter ? (
                            <Search size={34} style={{ color: 'grey' }} strokeWidth={1.8} />
                          ) : (
                            <UtensilsCrossed size={34} style={{ color: 'grey' }} strokeWidth={1.8} />
                          )}
                        </div>

                        {/* Heading */}
                        <h3 style={{
                          fontSize: '17px',
                          fontWeight: 700,
                          color: '#0F172A',
                          margin: '0 0 6px 0',
                          letterSpacing: '-0.01em',
                        }}>
                          {readySearch || statusFilter || orderTypeFilter || counterFilter 
                            ? 'No matching orders found' 
                            : 'No active orders'}
                        </h3>

                        {/* Description */}
                        <p style={{
                          fontSize: '13px',
                          color: '#64748B',
                          margin: 0,
                          lineHeight: 1.5,
                          fontWeight: 500,
                        }}>
                          {readySearch || statusFilter || orderTypeFilter || counterFilter
                            ? 'Try adjusting your search terms or filter criteria to see more orders.'
                            : 'Incoming orders from POS terminals, QR digital menus, and waitstaff will appear here in real-time.'}
                        </p>

                        {/* Reset Filters action */}
                        {(readySearch || statusFilter || orderTypeFilter || counterFilter) && (
                          <button
                            onClick={() => {
                              setReadySearch('');
                              setStatusFilter('');
                              setOrderTypeFilter('');
                              setCounterFilter('');
                              setPage(1);
                            }}
                            style={{
                              marginTop: '16px',
                              padding: '7px 14px',
                              fontSize: '12px',
                              fontWeight: 600,
                              color: 'var(--primary, #F97316)',
                              background: 'rgba(249, 115, 22, 0.08)',
                              border: '1px solid rgba(249, 115, 22, 0.2)',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              transition: 'all 0.15s ease',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                            }}
                          >
                            <RotateCcw size={12} />
                            <span>Reset all filters</span>
                          </button>
                        )}
                      </div>
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
          tables={tables}
          allStatuses={allStatuses}
          onClose={closeModal}
          onStatusChange={handleStatusChange}
          loading={modalLoading}
          onOrderUpdated={(updated) => {
            setSelectedOrder(updated);
            setOrders((prev) => prev.map((o) => (o.id === updated.id ? { ...o, ...updated } : o)));
          }}
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
