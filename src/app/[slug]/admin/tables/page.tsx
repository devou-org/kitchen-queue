'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Plus, LayoutGrid, Users, RefreshCw, QrCode, Search, X, Merge, ShoppingBag, Utensils, Unlink, Check } from 'lucide-react';
import { AdminContentWrapper } from '@/components/AdminContentWrapper';
import { AdminPageHeader } from '@/components/AdminPageHeader';
import { useRestaurant } from '@/hooks/useRestaurant';
import { RestaurantTable } from '@/modules/tables/tables.repository';
import { TableCard } from '@/components/modules/tables/TableCard';
import { OrderDetailsView } from '@/components/modules/orders/OrderDetailsView';
import { orderService } from '@/app/services/orders.api';
import { Order } from '@/types';
import { formatPrice } from '@/lib/format';
import { CreateTableModal } from '@/components/modules/tables/CreateTableModal';
import { EditTableModal } from '@/components/modules/tables/EditTableModal';
import { TableQRModal } from '@/components/modules/tables/TableQRModal';
import { DeleteTableModal } from '@/components/modules/tables/DeleteTableModal';
import { UnmergeTableModal } from '@/components/modules/tables/UnmergeTableModal';
import { MergeConfirmModal } from '@/components/modules/tables/MergeConfirmModal';
import { LayoutMaximizeToggle } from '@/components/LayoutMaximizeToggle';

export default function AdminTablesPage() {
  const { slug } = useParams();
  const slugStr = Array.isArray(slug) ? slug[0] : slug;
  const { restaurant } = useRestaurant();
  const primaryColor = restaurant?.primary_color || '#059669';

  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'ALL' | 'AVAILABLE' | 'OCCUPIED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals & Drawers
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [orderModalLoading, setOrderModalLoading] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addingTable, setAddingTable] = useState(false);
  
  // Merge Flow: Interactive Selection Mode + Confirm Popup
  const [mergeSourceTable, setMergeSourceTable] = useState<RestaurantTable | null>(null);
  const [mergeTargetTable, setMergeTargetTable] = useState<RestaurantTable | null>(null);
  const [isConfirmMergeOpen, setIsConfirmMergeOpen] = useState(false);
  const [mergeLoading, setMergeLoading] = useState(false);

  const [selectedEditTable, setSelectedEditTable] = useState<RestaurantTable | null>(null);
  const [selectedQRTable, setSelectedQRTable] = useState<RestaurantTable | null>(null);
  const [tableToDelete, setTableToDelete] = useState<RestaurantTable | null>(null);
  const [deletingTable, setDeletingTable] = useState(false);
  const [tableToUnmerge, setTableToUnmerge] = useState<RestaurantTable | null>(null);
  const [unmergingTable, setUnmergingTable] = useState(false);

  const router = useRouter();
  const selectedTable = selectedTableId ? (tables.find(t => t.id === selectedTableId) || null) : null;

  const handleTakeOrder = (table: RestaurantTable, customMergedTableNumbers?: string[]) => {
    if (!slugStr) return;
    const targetTableNum = table.parent_table_number || table.table_number;
    let url = `/${slugStr}/admin/pos?table=${encodeURIComponent(targetTableNum)}`;
    const mergedList = (customMergedTableNumbers && customMergedTableNumbers.length > 0)
      ? customMergedTableNumbers
      : (table.merged_table_numbers || []);
    if (mergedList && mergedList.length > 0) {
      url += `&merged=${encodeURIComponent(mergedList.join('+'))}`;
    }
    router.push(url);
  };

  const handleSelectTable = (table: RestaurantTable, specificOrder?: any) => {
    const activeOrds = table.active_orders || [];
    if (activeOrds.length === 0) return;
    setSelectedTableId(table.id);
    setSelectedOrder(specificOrder || activeOrds[0]);
  };

  const handleOrderStatusChange = async (id: string, newStatus: string, tableNumber?: string, pMethod?: string) => {
    setOrderModalLoading(true);
    try {
      const res = await orderService.updateOrder(id, {
        status: newStatus,
        is_paid: newStatus === 'CLOSED' ? true : newStatus === 'CANCELLED' ? false : undefined,
        table_number: tableNumber,
        payment_method: pMethod || undefined,
      });
      if (res.success) {
        toast.success(newStatus === 'CANCELLED' ? 'Order cancelled' : `Order updated to ${newStatus}`, { id: `order-status-${id}` });
        await fetchTables();
        setSelectedOrder((prev: any) => prev ? {
          ...prev,
          status: newStatus,
          table_number: tableNumber ?? prev.table_number,
          payment_method: pMethod ?? prev.payment_method,
          is_paid: newStatus === 'CLOSED' ? true : newStatus === 'CANCELLED' ? false : prev.is_paid,
        } : null);
      } else {
        toast.error(res.error || 'Failed to update order');
      }
    } catch {
      toast.error('Network error updating order');
    } finally {
      setOrderModalLoading(false);
    }
  };

  const handleOrderUpdated = (updatedOrder: Order) => {
    setSelectedOrder(updatedOrder);
    fetchTables();
  };

  const fetchTables = async () => {
    setLoading(true);
    try {
      const headers: Record<string, string> = slugStr ? { 'x-restaurant-slug': slugStr } : {};
      const res = await fetch('/api/tables', { headers });
      const data = await res.json();
      if (data.success && data.tables) {
        setTables(data.tables);
      } else {
        toast.error(data.error || 'Failed to load tables');
      }
    } catch {
      toast.error('Network error loading tables');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTables();
  }, [slugStr]);

  const handleCreateTable = async (tableNumber: string, capacity: number) => {
    setAddingTable(true);
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      if (slugStr) headers['x-restaurant-slug'] = slugStr;

      const res = await fetch('/api/tables', {
        method: 'POST',
        headers,
        body: JSON.stringify({ table_number: tableNumber, capacity: Math.min(14, Math.max(1, capacity)) })
      });

      const data = await res.json();
      if (data.success) {
        toast.success(data.message || 'Table created!');
        setIsAddModalOpen(false);
        fetchTables();
      } else {
        toast.error(data.error || 'Failed to create table');
      }
    } catch {
      toast.error('Network error creating table');
    } finally {
      setAddingTable(false);
    }
  };

  const handleConfirmDelete = async (tableId: string, tableNumber: string) => {
    setDeletingTable(true);
    try {
      const headers: Record<string, string> = slugStr ? { 'x-restaurant-slug': slugStr } : {};
      const res = await fetch(`/api/tables/${tableId}`, {
        method: 'DELETE',
        headers
      });

      const data = await res.json();
      if (data.success) {
        toast.success(`Table #${tableNumber} deleted`);
        setTableToDelete(null);
        fetchTables();
      } else {
        toast.error(data.error || 'Failed to delete table');
      }
    } catch {
      toast.error('Network error deleting table');
    } finally {
      setDeletingTable(false);
    }
  };

  const handleConfirmMerge = async () => {
    if (!mergeSourceTable || !mergeTargetTable) return;
    setMergeLoading(true);
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      if (slugStr) headers['x-restaurant-slug'] = slugStr;

      const res = await fetch('/api/tables/merge', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          primary_table_id: mergeSourceTable.id,
          secondary_table_ids: [mergeTargetTable.id]
        })
      });

      const data = await res.json();
      if (data.success) {
        toast.success(data.message || `Table #${mergeSourceTable.table_number} and Table #${mergeTargetTable.table_number} merged!`);
        setIsConfirmMergeOpen(false);
        setMergeSourceTable(null);
        setMergeTargetTable(null);
        fetchTables();
      } else {
        toast.error(data.error || 'Failed to merge tables');
      }
    } catch {
      toast.error('Network error merging tables');
    } finally {
      setMergeLoading(false);
    }
  };

  const handleStartMergeMode = (table?: RestaurantTable) => {
    if (table) {
      setMergeSourceTable(table);
    } else {
      // User clicked "Merge Tables" button at the top header
      setMergeSourceTable(null);
    }
  };

  const handleCancelMergeMode = () => {
    setMergeSourceTable(null);
    setMergeTargetTable(null);
    setIsConfirmMergeOpen(false);
  };

  const handleTableClickInMergeMode = (targetTable: RestaurantTable) => {
    if (!mergeSourceTable) {
      // This is the first table chosen
      setMergeSourceTable(targetTable);
      return;
    }

    if (mergeSourceTable.id === targetTable.id) {
      // Same table clicked, cancel selection
      setMergeSourceTable(null);
      setMergeTargetTable(null);
      return;
    }

    if (mergeTargetTable?.id === targetTable.id) {
      // Target table clicked again, deselect target
      setMergeTargetTable(null);
      return;
    }

    const isSameGroup =
      (mergeSourceTable.merged_into_table_id && mergeSourceTable.merged_into_table_id === targetTable.id) ||
      (targetTable.merged_into_table_id && targetTable.merged_into_table_id === mergeSourceTable.id) ||
      (mergeSourceTable.merged_into_table_id && targetTable.merged_into_table_id && mergeSourceTable.merged_into_table_id === targetTable.merged_into_table_id);

    if (isSameGroup) {
      toast.error('These tables are already part of the same merged group');
      return;
    }

    // Set target table (displays in the bottom-right popup)
    setMergeTargetTable(targetTable);
  };

  const handleConfirmUnmerge = async (table: RestaurantTable) => {
    setUnmergingTable(true);
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      if (slugStr) headers['x-restaurant-slug'] = slugStr;

      const res = await fetch('/api/tables/unmerge', {
        method: 'POST',
        headers,
        body: JSON.stringify({ table_id: table.id })
      });

      const data = await res.json();
      if (data.success) {
        toast.success(data.message || 'Table(s) unmerged successfully');
        setTableToUnmerge(null);
        fetchTables();
      } else {
        toast.error(data.error || 'Failed to unmerge tables');
      }
    } catch {
      toast.error('Network error unmerging table');
    } finally {
      setUnmergingTable(false);
    }
  };

  const handleUnmergeTable = (table: RestaurantTable) => {
    setTableToUnmerge(table);
  };

  // All tables are displayed as individual cards
  const filteredTables = tables.filter(t => {
    if (filter === 'AVAILABLE' && t.status !== 'AVAILABLE') return false;
    if (filter === 'OCCUPIED' && t.status !== 'OCCUPIED') return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchesTableNumber = String(t.table_number || '').toLowerCase().includes(q) ||
        (t.merged_table_numbers || []).some(n => String(n).toLowerCase().includes(q));
      const matchesCustomer = t.active_orders?.some(
        (o: any) =>
          (o.customer_name != null && String(o.customer_name).toLowerCase().includes(q)) ||
          (o.phone != null && String(o.phone).includes(q)) ||
          (o.ticket_number != null && String(o.ticket_number).toLowerCase().includes(q))
      );
      return matchesTableNumber || matchesCustomer;
    }

    return true;
  });

  const occupiedCount = tables.filter(t => t.status === 'OCCUPIED').length;
  const availableCount = tables.filter(t => t.status === 'AVAILABLE').length;

  const totalCapacity = tables.reduce((sum, t) => sum + (Number(t.capacity) || 0), 0);
  const uniqueOrdersMap = new Map<string, any>();
  for (const t of tables) {
    for (const o of t.active_orders || []) {
      const key = o.id || o.ticket_number;
      if (key && !uniqueOrdersMap.has(key)) {
        uniqueOrdersMap.set(key, o);
      }
    }
  }
  const totalSeatedGuests = Array.from(uniqueOrdersMap.values()).reduce(
    (sum, o) => sum + (Number(o.party_size) || 1),
    0
  );
  const totalRemainingSeats = Math.max(0, totalCapacity - totalSeatedGuests);

  // Group merged tables together so merged partner cards render side-by-side inside the combined outline
  const renderedGroupKeys = new Set<string>();
  const tableGroups: { key: string; isMergedGroup: boolean; groupTables: RestaurantTable[] }[] = [];

  for (const table of filteredTables) {
    const primaryId = table.merged_into_table_id || (table.merged_table_ids && table.merged_table_ids.length > 0 ? table.id : null);
    
    if (primaryId) {
      if (renderedGroupKeys.has(primaryId)) continue;
      renderedGroupKeys.add(primaryId);

      // Find all tables that belong to this merged group that are in filteredTables
      const members = filteredTables.filter(
        t => t.id === primaryId || t.merged_into_table_id === primaryId
      );
      tableGroups.push({
        key: `group-${primaryId}`,
        isMergedGroup: true,
        groupTables: members
      });
    } else {
      tableGroups.push({
        key: `single-${table.id}`,
        isMergedGroup: false,
        groupTables: [table]
      });
    }
  }

  return (
    <AdminContentWrapper fullWidth style={{ paddingTop: 0, paddingLeft: 0, paddingRight: 0, maxWidth: '100%' }}>
      <style>{`
        /* Page-scoped responsive rules to match orders page single-row header toolbar */
        .tables-page-header {
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

        @media (max-width: 640px) {
          .merged-table-group-wrapper {
            grid-column: span 1 !important;
          }
          .merged-tables-subgrid {
            grid-template-columns: 1fr !important;
          }
          .merged-subtable-card {
            border-left: none !important;
            border-top: 1px dashed #CBD5E1 !important;
            border-radius: 0 !important;
            padding: 12px 14px !important;
          }
          .merged-pos-left {
            border-top: none !important;
          }
        }

        .tables-page-header .admin-page-header-container {
          height: 68px !important;
          min-height: 68px !important;
          display: flex !important;
          align-items: center !important;
          margin: 0 !important;
          padding: 0 !important;
          gap: 12px !important;
          width: 100% !important;
        }

        .tables-toolbar {
          display: flex !important;
          flex-wrap: nowrap !important;
          align-items: center !important;
          gap: 8px !important;
          width: 100% !important;
        }

        .tables-search-control {
          position: relative !important;
          height: 38px !important;
        }

        .tables-stats-group {
          display: grid !important;
          grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
          width: 560px !important;
          max-width: 100% !important;
          align-items: stretch !important;
          gap: 0 !important;
          flex-shrink: 0 !important;
          background: #FFFFFF !important;
          border: 1px solid #E2E8F0 !important;
          border-radius: 8px !important;
          overflow: hidden !important;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03) !important;
        }

        .tables-stat-item {
          width: 100% !important;
          max-width: 100% !important;
          min-width: 0 !important;
          height: 38px !important;
          padding: 0 10px !important;
          background: #FFFFFF;
          border: none !important;
          border-right: 1px solid #E2E8F0 !important;
          cursor: pointer;
          display: flex !important;
          align-items: center !important;
          justify-content: space-between !important;
          box-sizing: border-box !important;
          transition: background-color 0.15s ease;
          white-space: nowrap !important;
        }

        .tables-stat-item:hover {
          background-color: #F8FAFC;
        }

        .tables-stat-item:last-child {
          border-right: none !important;
          cursor: default;
        }

        .tables-actions {
          display: flex !important;
          flex-wrap: nowrap !important;
          align-items: center !important;
          gap: 8px !important;
          margin-left: auto !important;
          flex-shrink: 0 !important;
        }

        .tables-refresh-btn {
          width: 38px !important;
          height: 38px !important;
          min-width: 38px !important;
          border-radius: 8px !important;
          border: 1px solid var(--border, #E2E8F0) !important;
          background: #FFFFFF !important;
          color: #475569 !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03) !important;
          transition: all 0.15s ease !important;
          flex-shrink: 0 !important;
        }

        .tables-add-btn {
          height: 38px !important;
          padding: 0 14px !important;
          font-size: 12px !important;
          font-weight: 700 !important;
          border-radius: 8px !important;
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          gap: 6px !important;
          box-sizing: border-box !important;
          white-space: nowrap !important;
        }

        .tables-content-area {
          padding: 20px;
          width: 100%;
          max-width: 100%;
          box-sizing: border-box;
        }

        /* Mobile Screens: Full-width stacked controls & 2x2 grid stats <= 768px */
        @media (max-width: 768px) {
          .tables-page-header {
            height: auto !important;
            min-height: auto !important;
            padding: 12px 14px !important;
          }

          .tables-page-header .admin-page-header-container {
            height: auto !important;
            min-height: auto !important;
          }

          .tables-toolbar {
            display: flex !important;
            flex-direction: column !important;
            flex-wrap: wrap !important;
            align-items: stretch !important;
            gap: 10px !important;
            width: 100% !important;
          }

          .tables-search-control {
            flex: none !important;
            height: 38px !important;
            width: 100% !important;
            max-width: 100% !important;
            min-width: 0 !important;
          }

          .tables-stats-group {
            display: grid !important;
            grid-template-columns: 1fr 1fr !important;
            width: 100% !important;
            border: 1px solid #E2E8F0 !important;
            border-radius: 10px !important;
            background: #FFFFFF !important;
            overflow: hidden !important;
            box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04) !important;
          }

          .tables-stat-item {
            width: 100% !important;
            height: 42px !important;
            padding: 0 14px !important;
            border: none !important;
            box-sizing: border-box !important;
          }

          /* 2x2 clean dividers on mobile */
          .tables-stat-item-total {
            border-right: 1px solid #E2E8F0 !important;
            border-bottom: 1px solid #E2E8F0 !important;
          }

          .tables-stat-item-available {
            border-right: none !important;
            border-bottom: 1px solid #E2E8F0 !important;
          }

          .tables-stat-item-occupied {
            border-right: 1px solid #E2E8F0 !important;
            border-bottom: none !important;
          }

          .tables-stat-item-seats {
            border-right: none !important;
            border-bottom: none !important;
          }

          .tables-actions {
            width: 100% !important;
            margin-left: 0 !important;
            display: flex !important;
            align-items: center !important;
            gap: 8px !important;
          }

          .tables-refresh-btn {
            width: 38px !important;
            min-width: 38px !important;
            flex: 0 0 38px !important;
          }

          .tables-add-btn {
            flex: 1 1 auto !important;
            width: auto !important;
          }

          .tables-content-area {
            padding: 12px 14px !important;
          }
        }
      `}</style>
      <AdminPageHeader
        className="tables-page-header"
        style={{ paddingTop: 0, minHeight: '68px', display: 'flex', alignItems: 'center', marginBottom: 0 }}
        hideMaximize={true}
        search={
          <div className="tables-toolbar" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'nowrap', width: '100%', minWidth: 0 }}>
            {/* Search Input */}
            <div className="tables-search-control" style={{ position: 'relative', width: '240px', flex: '0 0 240px', minWidth: '140px', maxWidth: '300px', flexShrink: 0 }}>
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
                placeholder="Search table # or guest..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  height: '38px',
                  paddingLeft: '30px',
                  paddingRight: searchQuery ? '26px' : '8px',
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
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
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

            {/* Minimal Stat / Filter Boxes: Total, Available, Occupied, Free Seats */}
            <div className="tables-stats-group">
              {/* All / Total Tables */}
              <button
                type="button"
                onClick={() => setFilter('ALL')}
                className="tables-stat-item tables-stat-item-total"
                style={{
                  background: filter === 'ALL' ? '#F8FAFC' : '#FFFFFF',
                }}
              >
                <span style={{ fontSize: '13px', fontWeight: filter === 'ALL' ? 700 : 500, color: filter === 'ALL' ? '#0F172A' : '#64748B' }}>
                  Total
                </span>
                <span style={{ fontSize: '14px', fontWeight: 800, color: '#0F172A' }}>
                  {tables.length}
                </span>
              </button>

              {/* Available Tables */}
              <button
                type="button"
                onClick={() => setFilter(filter === 'AVAILABLE' ? 'ALL' : 'AVAILABLE')}
                className="tables-stat-item tables-stat-item-available"
                style={{
                  background: filter === 'AVAILABLE' ? '#F0FDF4' : '#FFFFFF',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#16A34A', flexShrink: 0 }} />
                  <span style={{ fontSize: '13px', fontWeight: filter === 'AVAILABLE' ? 700 : 500, color: filter === 'AVAILABLE' ? '#16A34A' : '#64748B' }}>
                    Available
                  </span>
                </div>
                <span style={{ fontSize: '14px', fontWeight: 800, color: '#16A34A' }}>
                  {availableCount}
                </span>
              </button>

              {/* Occupied Tables */}
              <button
                type="button"
                onClick={() => setFilter(filter === 'OCCUPIED' ? 'ALL' : 'OCCUPIED')}
                className="tables-stat-item tables-stat-item-occupied"
                style={{
                  background: filter === 'OCCUPIED' ? '#FFF7ED' : '#FFFFFF',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#EA580C', flexShrink: 0 }} />
                  <span style={{ fontSize: '13px', fontWeight: filter === 'OCCUPIED' ? 700 : 500, color: filter === 'OCCUPIED' ? '#EA580C' : '#64748B' }}>
                    Occupied
                  </span>
                </div>
                <span style={{ fontSize: '14px', fontWeight: 800, color: '#EA580C' }}>
                  {occupiedCount}
                </span>
              </button>

              {/* Seats Info Box */}
              <div
                className="tables-stat-item tables-stat-item-seats"
                style={{
                  background: '#FFFFFF',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 500, color: '#64748B' }}>
                    Free Seats
                  </span>
                </div>
                <span style={{ fontSize: '13px', fontWeight: 700, color: totalRemainingSeats > 0 ? '#16A34A' : '#DC2626' }}>
                  {totalRemainingSeats}
                  <span style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 500 }}>/{totalCapacity}</span>
                </span>
              </div>
            </div>

            {/* Far Right Action Buttons */}
            <div className="tables-actions">
              {/* Refresh Button */}
              <button
                type="button"
                onClick={fetchTables}
                disabled={loading}
                title="Refresh Table Status"
                aria-label="Refresh Table Status"
                className="tables-refresh-btn"
                style={{ cursor: loading ? 'not-allowed' : 'pointer' }}
              >
                <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
              </button>

              {/* Add Table Button */}
              <button
                type="button"
                onClick={() => setIsAddModalOpen(true)}
                className="btn btn-primary tables-add-btn"
                style={{
                  background: primaryColor,
                  borderColor: primaryColor,
                }}
              >
                <Plus size={15} />
                <span>Add Table</span>
              </button>

              {/* Maximize Layout Toggle */}
              <LayoutMaximizeToggle />
            </div>
          </div>
        }
      />

      {/* Tables Content Area */}
      <div className="tables-content-area">

      {/* Tables Grid */}
      {loading ? (
        <div style={{ padding: '60px', textAlign: 'center' }}>
          <div className="loader" style={{ margin: '0 auto' }} />
        </div>
      ) : filteredTables.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '60px 20px', color: '#64748B' }}>
          <LayoutGrid size={48} color="#94A3B8" style={{ margin: '0 auto 12px' }} />
          <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#0F172A', marginBottom: '4px' }}>No tables found</h3>
          <p style={{ fontSize: '13px', marginBottom: '16px' }}>
            {searchQuery
              ? `No tables match your search for "${searchQuery}".`
              : filter !== 'ALL'
              ? 'No tables match the selected status filter.'
              : 'Create your first restaurant table to generate QR codes.'}
          </p>
          {searchQuery ? (
            <button
              onClick={() => setSearchQuery('')}
              className="btn"
              style={{ border: '1px solid #E2E8F0', background: '#FFFFFF', color: '#334155', borderRadius: '8px', padding: '6px 16px', cursor: 'pointer' }}
            >
              Clear Search
            </button>
          ) : filter === 'ALL' ? (
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="btn btn-primary"
              style={{ background: primaryColor }}
            >
              + Create Table
            </button>
          ) : null}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', alignItems: 'stretch' }}>
          {tableGroups.map(group => {
            if (group.isMergedGroup && group.groupTables.length > 1) {
              const leadTable = group.groupTables.find(t => !t.merged_into_table_id) || group.groupTables[0];
              const childTables = group.groupTables.filter(t => t.id !== leadTable.id);
              const combinedHeading = `Table #${leadTable.table_number}+${childTables.map(c => c.table_number).join('+')}`;

              // Combine and deduplicate active orders from the merged tables into one list
              const allMergedOrdersMap = new Map<string, any>();
              for (const t of group.groupTables) {
                for (const o of t.active_orders || []) {
                  const key = o.id || o.ticket_number;
                  if (key && !allMergedOrdersMap.has(key)) {
                    allMergedOrdersMap.set(key, o);
                  }
                }
              }
              const allMergedOrders = Array.from(allMergedOrdersMap.values());
              const hasActiveOrders = allMergedOrders.length > 0;
              const mergedCombinedTotal = allMergedOrders.reduce((sum, o) => sum + Number(o.total_price || 0), 0);
              const totalMergedSeated = allMergedOrders.reduce((sum, o) => sum + (Number(o.party_size) || 1), 0);
              const isSourceMergedGroup = Boolean(mergeSourceTable && group.groupTables.some(t => t.id === mergeSourceTable.id));
              const isTargetMergedGroup = Boolean(mergeTargetTable && group.groupTables.some(t => t.id === mergeTargetTable.id));

              return (
                <div
                  key={group.key}
                  className="merged-table-group-wrapper"
                  onClick={() => {
                    if (mergeSourceTable && !isSourceMergedGroup) {
                      handleTableClickInMergeMode(leadTable);
                    }
                  }}
                  style={{
                    gridColumn: group.groupTables.length >= 3 ? 'span 3' : 'span 2',
                    border: (isSourceMergedGroup || isTargetMergedGroup) ? `2px solid ${primaryColor}` : `1.5px solid ${primaryColor}70`,
                    borderRadius: '12px',
                    padding: 0,
                    background: '#FFFFFF',
                    boxShadow: (isSourceMergedGroup || isTargetMergedGroup)
                      ? `0 0 0 3px ${primaryColor}25, 0 8px 20px rgba(0, 0, 0, 0.08)`
                      : `0 4px 14px ${primaryColor}12`,
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'visible',
                    position: 'relative',
                    cursor: mergeSourceTable && !isSourceMergedGroup ? 'pointer' : 'default',
                    transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                    transform: (isSourceMergedGroup || isTargetMergedGroup) ? 'scale(1.01)' : 'none',
                  }}
                >
                  {/* Unified Minimal Header for Merged Table Group */}
                  <div
                    style={{
                      padding: '8px 14px 6px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '8px',
                      borderBottom: '1px solid #F1F5F9',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                      <h3
                        style={{
                          fontSize: '15px',
                          fontWeight: 800,
                          color: '#0F172A',
                          margin: 0,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                        title={combinedHeading}
                      >
                        {combinedHeading}
                      </h3>

                      {/* Single Merged Badge */}
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px',
                          padding: '1px 6px',
                          borderRadius: '5px',
                          fontSize: '10.5px',
                          fontWeight: 700,
                          background: '#FEF3C7',
                          color: '#B45309',
                          border: '1px solid #FDE68A',
                          flexShrink: 0,
                        }}
                      >
                        <Merge size={11} /> Merged ({group.groupTables.length})
                      </span>
                    </div>

                    {/* Single Actions Pair: Merge another & Unmerge */}
                    {!mergeSourceTable && (
                      <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexShrink: 0 }}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStartMergeMode(leadTable);
                          }}
                          title="Merge with another table"
                          style={{
                            padding: '4px 6px',
                            borderRadius: '6px',
                            border: '1px solid #E2E8F0',
                            background: '#F8FAFC',
                            color: primaryColor,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.15s ease',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = '#F1F5F9';
                            e.currentTarget.style.borderColor = primaryColor;
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = '#F8FAFC';
                            e.currentTarget.style.borderColor = '#E2E8F0';
                          }}
                        >
                          <Merge size={14} />
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setTableToUnmerge(leadTable);
                          }}
                          title="Unmerge table"
                          style={{
                            padding: '4px 6px',
                            borderRadius: '6px',
                            border: '1px solid #FEE2E2',
                            background: '#FEF2F2',
                            color: '#DC2626',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.15s ease',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = '#FEE2E2';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = '#FEF2F2';
                          }}
                        >
                          <Unlink size={14} />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Top: Side-by-side joined table cards */}
                  <div
                    className="merged-tables-subgrid"
                    style={{
                      display: 'grid',
                      gridTemplateColumns: `repeat(${group.groupTables.length}, minmax(0, 1fr))`,
                      gap: 0,
                      alignItems: 'stretch',
                      width: '100%',
                    }}
                  >
                    {group.groupTables.map((table, idx) => {
                      const isFirst = idx === 0;
                      const isLast = idx === group.groupTables.length - 1;
                      const position: 'left' | 'right' | 'middle' = isFirst ? 'left' : isLast ? 'right' : 'middle';

                      // Calculate seated guests for this specific table in the merged group
                      let seatedGuestsForThisTable = 0;
                      if (hasActiveOrders) {
                        let priorCapacity = 0;
                        for (let i = 0; i < idx; i++) {
                          priorCapacity += Number(group.groupTables[i].capacity) || 0;
                        }
                        const tableCap = Number(table.capacity) || 0;
                        const remainingToDistribute = Math.max(0, totalMergedSeated - priorCapacity);
                        seatedGuestsForThisTable = Math.min(tableCap, remainingToDistribute);
                      }

                      return (
                        <TableCard
                          key={table.id}
                          table={{
                            ...table,
                            status: hasActiveOrders ? 'OCCUPIED' : table.status,
                            active_orders: allMergedOrders,
                            active_orders_count: allMergedOrders.length,
                          }}
                          joinedCardPosition={position}
                          displayTitle={isFirst ? combinedHeading : ''}
                          hideHeader={true}
                          hideActiveOrders={true}
                          mergedOrdersContext={allMergedOrders}
                          allocatedSeatedGuests={hasActiveOrders ? seatedGuestsForThisTable : undefined}
                          onSelect={(t, ord) => {
                            if (mergeSourceTable) {
                              handleTableClickInMergeMode(t);
                            } else {
                              handleSelectTable(leadTable, ord || allMergedOrders[0]);
                            }
                          }}
                          onTakeOrder={() => {
                            if (mergeSourceTable) {
                              handleTableClickInMergeMode(leadTable);
                            } else {
                              handleTakeOrder(leadTable, childTables.map(c => c.table_number));
                            }
                          }}
                          onEdit={(t) => setSelectedEditTable(t)}
                          onViewQR={(t) => setSelectedQRTable(t)}
                          onDelete={(t) => setTableToDelete(t)}
                          onUnmerge={() => setTableToUnmerge(leadTable)}
                          onMerge={() => handleStartMergeMode(leadTable)}
                          isMergeSource={mergeSourceTable?.id === table.id}
                          isMergeTarget={mergeTargetTable?.id === table.id}
                          isMergeSelectionMode={Boolean(mergeSourceTable)}
                          onSelectForMerge={(t) => handleTableClickInMergeMode(t)}
                          primaryColor={primaryColor}
                        />
                      );
                    })}
                  </div>

                  {/* Bottom: Single unified active orders tab for the merged table pair */}
                  <div style={{ padding: '0 12px 10px 12px' }}>
                    {hasActiveOrders ? (
                      <div
                        onClick={() => {
                          if (mergeSourceTable) {
                            handleTableClickInMergeMode(leadTable);
                          } else {
                            handleSelectTable(leadTable, allMergedOrders[0]);
                          }
                        }}
                        style={{
                          background: '#FFFBEB',
                          padding: '6px 10px',
                          borderRadius: '8px',
                          border: '1px solid #FEF08A',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = '#F59E0B';
                          e.currentTarget.style.boxShadow = '0 2px 8px rgba(245, 158, 11, 0.15)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = '#FEF08A';
                          e.currentTarget.style.boxShadow = 'none';
                        }}
                        title="Click to view merged active orders"
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '10.5px', fontWeight: 800, color: '#854D0E', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <ShoppingBag size={12} /> Active Orders ({allMergedOrders.length})
                          </span>
                          <span style={{ fontSize: '12px', fontWeight: 900, color: '#A16207' }}>
                            {formatPrice(mergedCombinedTotal)}
                          </span>
                        </div>

                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginTop: '6px' }}>
                          {allMergedOrders.map((o: any, idx: number) => {
                            const ticketNum = String(o.ticket_number || '').padStart(3, '0');
                            const status = o.status || 'PENDING';
                            return (
                              <button
                                key={o.id || idx}
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSelectTable(leadTable, o);
                                }}
                                style={{
                                  background: '#FFFFFF',
                                  border: '1px solid #FEF08A',
                                  borderRadius: '6px',
                                  padding: '2px 6px',
                                  fontSize: '10.5px',
                                  fontWeight: 700,
                                  color: '#854D0E',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                                  cursor: 'pointer',
                                  transition: 'all 0.15s ease',
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.borderColor = '#EAB308';
                                  e.currentTarget.style.background = '#FEF9C3';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.borderColor = '#FEF08A';
                                  e.currentTarget.style.background = '#FFFFFF';
                                }}
                                title={`Click to view Order #${ticketNum}`}
                              >
                                #{ticketNum} ({status})
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          if (mergeSourceTable) {
                            if (!isSourceMergedGroup) {
                              handleTableClickInMergeMode(leadTable);
                            }
                          } else {
                            handleTakeOrder(leadTable, childTables.map(c => c.table_number));
                          }
                        }}
                        style={{
                          background: isTargetMergedGroup ? `${primaryColor}15` : isSourceMergedGroup ? `${primaryColor}10` : '#F8FAFC',
                          padding: '6px 10px',
                          borderRadius: '8px',
                          border: (isSourceMergedGroup || isTargetMergedGroup) ? `1.5px solid ${primaryColor}` : mergeSourceTable ? '1.5px dashed #CBD5E1' : '1px dashed #CBD5E1',
                          color: (isSourceMergedGroup || isTargetMergedGroup) ? primaryColor : mergeSourceTable ? '#475569' : '#64748B',
                          fontSize: '11.5px',
                          textAlign: 'center',
                          cursor: mergeSourceTable && isSourceMergedGroup ? 'default' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          transition: 'all 0.15s ease',
                        }}
                        onMouseEnter={(e) => {
                          if (mergeSourceTable && !isSourceMergedGroup && !isTargetMergedGroup) {
                            e.currentTarget.style.borderColor = primaryColor;
                            e.currentTarget.style.color = primaryColor;
                            e.currentTarget.style.background = '#FFFFFF';
                          } else if (!mergeSourceTable) {
                            e.currentTarget.style.borderColor = primaryColor;
                            e.currentTarget.style.color = primaryColor;
                            e.currentTarget.style.background = '#FFFFFF';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (mergeSourceTable && !isSourceMergedGroup && !isTargetMergedGroup) {
                            e.currentTarget.style.borderColor = '#CBD5E1';
                            e.currentTarget.style.color = '#475569';
                            e.currentTarget.style.background = '#F8FAFC';
                          } else if (!mergeSourceTable) {
                            e.currentTarget.style.borderColor = '#CBD5E1';
                            e.currentTarget.style.color = '#64748B';
                            e.currentTarget.style.background = '#F8FAFC';
                          }
                        }}
                        title={
                          isSourceMergedGroup
                            ? `Table Group (Selected)`
                            : isTargetMergedGroup
                            ? `Selected to merge`
                            : mergeSourceTable
                            ? `Click to merge with Table Group #${leadTable.table_number}`
                            : `Click to take order for merged Table #${leadTable.table_number}`
                        }
                      >
                        {isSourceMergedGroup ? (
                          <>
                            <Merge size={13} color={primaryColor} />
                            <span style={{ fontWeight: 700, color: primaryColor }}>Table Group (Selected)</span>
                          </>
                        ) : isTargetMergedGroup ? (
                          <>
                            <Check size={13} color={primaryColor} />
                            <span style={{ fontWeight: 700, color: primaryColor }}>Selected to merge</span>
                          </>
                        ) : mergeSourceTable ? (
                          <>
                            <Merge size={13} color={primaryColor} />
                            <span style={{ fontWeight: 700, color: '#0F172A' }}>Click to merge with this table group</span>
                          </>
                        ) : (
                          <>
                            <Utensils size={13} color={primaryColor} />
                            <span>Available • Click to take order</span>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            }

            const table = group.groupTables[0];
            return (
              <TableCard
                key={table.id}
                table={table}
                onSelect={(t, ord) => {
                  if (mergeSourceTable) {
                    handleTableClickInMergeMode(t);
                  } else {
                    handleSelectTable(t, ord);
                  }
                }}
                onTakeOrder={(t) => {
                  if (mergeSourceTable) {
                    handleTableClickInMergeMode(t);
                  } else {
                    handleTakeOrder(t);
                  }
                }}
                onEdit={(t) => setSelectedEditTable(t)}
                onViewQR={(t) => setSelectedQRTable(t)}
                onDelete={(t) => setTableToDelete(t)}
                onUnmerge={(t) => setTableToUnmerge(t)}
                onMerge={(t) => handleStartMergeMode(t)}
                isMergeSource={mergeSourceTable?.id === table.id}
                isMergeTarget={mergeTargetTable?.id === table.id}
                isMergeSelectionMode={Boolean(mergeSourceTable)}
                onSelectForMerge={(t) => handleTableClickInMergeMode(t)}
                primaryColor={primaryColor}
              />
            );
          })}
        </div>
      )}
      </div>

      {/* Floating Bottom-Right Merge Sidepopup */}
      {mergeSourceTable && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            width: '330px',
            maxWidth: 'calc(100vw - 32px)',
            background: '#FFFFFF',
            borderRadius: '16px',
            border: '1px solid #E2E8F0',
            boxShadow: '0 16px 40px -10px rgba(15, 23, 42, 0.22), 0 2px 10px rgba(0, 0, 0, 0.06)',
            zIndex: 10001,
            overflow: 'hidden',
            animation: 'slideUp 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
            fontFamily: 'inherit',
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '12px 16px',
              background: '#F8FAFC',
              borderBottom: '1px solid #F1F5F9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  width: '26px',
                  height: '26px',
                  borderRadius: '6px',
                  background: `${primaryColor}15`,
                  color: primaryColor,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Merge size={14} />
              </span>
              <span style={{ fontSize: '13px', fontWeight: 800, color: '#0F172A' }}>
                Merge Tables
              </span>
            </div>

            <button
              type="button"
              onClick={handleCancelMergeMode}
              title="Cancel merge"
              style={{
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                border: 'none',
                background: '#F1F5F9',
                color: '#64748B',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#E2E8F0';
                e.currentTarget.style.color = '#0F172A';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#F1F5F9';
                e.currentTarget.style.color = '#64748B';
              }}
            >
              <X size={14} />
            </button>
          </div>

          {/* Body: Tables Comparison */}
          <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '8px', alignItems: 'center' }}>
              {/* Table 1 (Source) */}
              <div
                style={{
                  padding: '10px 8px',
                  borderRadius: '10px',
                  background: `${primaryColor}08`,
                  border: `1.5px solid ${primaryColor}50`,
                  textAlign: 'center',
                }}
              >
                <span style={{ fontSize: '10px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block' }}>
                  Table 1
                </span>
                <span style={{ fontSize: '15px', fontWeight: 900, color: '#0F172A', display: 'block', margin: '2px 0' }}>
                  #{mergeSourceTable.table_number}
                </span>
                <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 600 }}>
                  {mergeSourceTable.capacity} seats
                </span>
              </div>

              {/* Merge icon */}
              <div style={{ color: primaryColor, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Merge size={16} />
              </div>

              {/* Table 2 (Target) */}
              <div
                style={{
                  padding: '10px 8px',
                  borderRadius: '10px',
                  background: mergeTargetTable ? `${primaryColor}08` : '#F8FAFC',
                  border: mergeTargetTable ? `1.5px solid ${primaryColor}50` : '1.5px dashed #CBD5E1',
                  textAlign: 'center',
                  minHeight: '62px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                }}
              >
                {mergeTargetTable ? (
                  <>
                    <span style={{ fontSize: '10px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block' }}>
                      Table 2
                    </span>
                    <span style={{ fontSize: '15px', fontWeight: 900, color: '#0F172A', display: 'block', margin: '2px 0' }}>
                      #{mergeTargetTable.table_number}
                    </span>
                    <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 600 }}>
                      {mergeTargetTable.capacity} seats
                    </span>
                  </>
                ) : (
                  <span style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 600, fontStyle: 'italic', lineHeight: 1.3 }}>
                    Click a table to select
                  </span>
                )}
              </div>
            </div>

            {/* Combined Capacity */}
            {mergeTargetTable ? (
              <div
                style={{
                  padding: '8px 12px',
                  borderRadius: '8px',
                  background: '#F1F5F9',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '12px',
                }}
              >
                <span style={{ color: '#475569', fontWeight: 600 }}>Combined Capacity</span>
                <span style={{ color: '#0F172A', fontWeight: 800 }}>
                  {(Number(mergeSourceTable.capacity) || 0) + (Number(mergeTargetTable.capacity) || 0)} seats
                </span>
              </div>
            ) : (
              <div style={{ fontSize: '11.5px', color: '#64748B', textAlign: 'center', padding: '2px 0' }}>
                Click any table above to pair with Table #{mergeSourceTable.table_number}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div
            style={{
              padding: '10px 16px 14px 16px',
              borderTop: '1px solid #F1F5F9',
              display: 'flex',
              gap: '8px',
            }}
          >
            <button
              type="button"
              onClick={handleCancelMergeMode}
              style={{
                flex: 1,
                padding: '9px 12px',
                borderRadius: '8px',
                border: '1px solid #E2E8F0',
                background: '#FFFFFF',
                color: '#475569',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#F8FAFC';
                e.currentTarget.style.borderColor = '#CBD5E1';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#FFFFFF';
                e.currentTarget.style.borderColor = '#E2E8F0';
              }}
            >
              Cancel Merge
            </button>

            <button
              type="button"
              onClick={handleConfirmMerge}
              disabled={!mergeTargetTable || mergeLoading}
              style={{
                flex: 1.3,
                padding: '9px 12px',
                borderRadius: '8px',
                border: 'none',
                background: mergeTargetTable ? primaryColor : '#E2E8F0',
                color: mergeTargetTable ? '#FFFFFF' : '#94A3B8',
                fontSize: '12px',
                fontWeight: 800,
                cursor: mergeTargetTable && !mergeLoading ? 'pointer' : 'not-allowed',
                boxShadow: mergeTargetTable ? `0 2px 8px ${primaryColor}40` : 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                transition: 'all 0.15s ease',
              }}
            >
              {mergeLoading ? (
                <>
                  <div className="animate-spin" style={{ width: '12px', height: '12px', border: '2px solid #FFFFFF', borderTopColor: 'transparent', borderRadius: '50%' }} />
                  <span>Merging...</span>
                </>
              ) : (
                <>
                  <Merge size={14} />
                  <span>Merge Table</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Slide-over Order Details Drawer */}
      {selectedOrder && (
        <OrderDetailsView
          order={selectedOrder}
          slug={slugStr || ''}
          tables={tables}
          onClose={() => {
            setSelectedOrder(null);
            setSelectedTableId(null);
          }}
          onStatusChange={handleOrderStatusChange}
          loading={orderModalLoading}
          onOrderUpdated={handleOrderUpdated}
          tableOrders={selectedTable?.active_orders || []}
          onSelectTableOrder={(ord) => setSelectedOrder(ord)}
        />
      )}


      <CreateTableModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSubmit={handleCreateTable}
        loading={addingTable}
        primaryColor={primaryColor}
      />

      <EditTableModal
        table={selectedEditTable}
        isOpen={!!selectedEditTable}
        onClose={() => setSelectedEditTable(null)}
        onSuccess={fetchTables}
        primaryColor={primaryColor}
      />

      <TableQRModal
        table={selectedQRTable}
        restaurantName={restaurant?.name}
        restaurantLogo={restaurant?.logo_url}
        restaurantSlug={slugStr || restaurant?.slug}
        onClose={() => setSelectedQRTable(null)}
        primaryColor={primaryColor}
      />

      <DeleteTableModal
        table={tableToDelete}
        onClose={() => setTableToDelete(null)}
        onConfirmDelete={handleConfirmDelete}
        loading={deletingTable}
      />

      <UnmergeTableModal
        table={tableToUnmerge}
        onClose={() => setTableToUnmerge(null)}
        onConfirmUnmerge={handleConfirmUnmerge}
        loading={unmergingTable}
      />
    </AdminContentWrapper>
  );
}

