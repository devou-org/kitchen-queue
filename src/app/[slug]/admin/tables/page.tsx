'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Plus, LayoutGrid, Users, RefreshCw, QrCode, Search, X, Link2 } from 'lucide-react';
import { AdminContentWrapper } from '@/components/AdminContentWrapper';
import { AdminPageHeader } from '@/components/AdminPageHeader';
import { useRestaurant } from '@/hooks/useRestaurant';
import { RestaurantTable } from '@/modules/tables/tables.repository';
import { TableCard } from '@/components/modules/tables/TableCard';
import { OrderDetailsView } from '@/components/modules/orders/OrderDetailsView';
import { orderService } from '@/app/services/orders.api';
import { Order } from '@/types';
import { CreateTableModal } from '@/components/modules/tables/CreateTableModal';
import { EditTableModal } from '@/components/modules/tables/EditTableModal';
import { TableQRModal } from '@/components/modules/tables/TableQRModal';
import { DeleteTableModal } from '@/components/modules/tables/DeleteTableModal';
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

  const router = useRouter();
  const selectedTable = selectedTableId ? (tables.find(t => t.id === selectedTableId) || null) : null;

  const handleTakeOrder = (table: RestaurantTable) => {
    if (!slugStr) return;
    router.push(`/${slugStr}/admin/pos?table=${encodeURIComponent(table.table_number)}`);
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
        toast.success(`Order updated to ${newStatus}`, { id: `order-status-${id}` });
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
        body: JSON.stringify({ table_number: tableNumber, capacity })
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
      toast('Click any available table to merge with Table #' + table.table_number, {
        icon: '🔗',
        id: 'merge-instruction'
      });
    } else {
      // User clicked "Merge Tables" button at the top header
      setMergeSourceTable(null);
      toast('Click the first table you want to merge', {
        icon: '🔗',
        id: 'merge-instruction'
      });
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
      toast('Now select the second table to merge', {
        icon: '🔗',
        id: 'merge-instruction'
      });
      return;
    }

    if (mergeSourceTable.id === targetTable.id) {
      // Same table clicked, cancel selection
      setMergeSourceTable(null);
      return;
    }

    // Both tables selected: open confirmation popup!
    setMergeTargetTable(targetTable);
    setIsConfirmMergeOpen(true);
  };

  const handleUnmergeTable = async (table: RestaurantTable) => {
    const isPrimary = (table.merged_table_numbers?.length || 0) > 0;
    const confirmMsg = isPrimary
      ? `Are you sure you want to unmerge all tables joined with Table #${table.table_number}?`
      : `Are you sure you want to detach Table #${table.table_number} from Table #${table.parent_table_number}?`;

    if (!window.confirm(confirmMsg)) return;

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
        fetchTables();
      } else {
        toast.error(data.error || 'Failed to unmerge tables');
      }
    } catch {
      toast.error('Network error unmerging table');
    }
  };

  // Only display primary tables and standalone tables (hide secondary merged children)
  // Each merged group is rendered as ONE card on the lead table
  const visibleTables = tables.filter(t => !t.merged_into_table_id);

  // Filtered visible tables list
  const filteredTables = visibleTables.filter(t => {
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

  const occupiedCount = visibleTables.filter(t => t.status === 'OCCUPIED').length;
  const availableCount = visibleTables.filter(t => t.status === 'AVAILABLE').length;

  const totalCapacity = tables.reduce((sum, t) => sum + (Number(t.capacity) || 0), 0);
  const totalSeatedGuests = tables.reduce((sum, t) => {
    const activeOrds = t.active_orders || [];
    return sum + activeOrds.reduce((s: number, o: any) => s + (Number(o.party_size) || 1), 0);
  }, 0);
  const totalRemainingSeats = Math.max(0, totalCapacity - totalSeatedGuests);

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

        .tables-actions {
          display: flex !important;
          flex-wrap: nowrap !important;
          align-items: center !important;
          gap: 8px !important;
          margin-left: auto !important;
          flex-shrink: 0 !important;
        }

        /* Mobile Screens: Full-width stacked controls below 640px */
        @media (max-width: 640px) {
          .tables-page-header {
            height: auto !important;
            min-height: auto !important;
            padding: 12px 16px !important;
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
            flex-wrap: wrap !important;
            justify-content: flex-start !important;
            width: 100% !important;
          }

          .tables-actions {
            width: 100% !important;
            margin-left: 0 !important;
            justify-content: flex-start !important;
          }

          .tables-actions > button {
            flex: 1 1 auto;
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
            <div className="tables-stats-group" style={{ display: 'flex', alignItems: 'center', gap: 0, flexShrink: 0 }}>
              {/* All / Total Tables */}
              <button
                type="button"
                onClick={() => setFilter('ALL')}
                style={{
                  width: '150px',
                  height: '38px',
                  padding: '0 12px',
                  background: '#FFFFFF',
                  border: 'none',
                  borderRight: '1px solid #E2E8F0',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  boxSizing: 'border-box',
                  transition: 'opacity 0.15s ease',
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
                style={{
                  width: '150px',
                  height: '38px',
                  padding: '0 12px',
                  background: '#FFFFFF',
                  border: 'none',
                  borderRight: '1px solid #E2E8F0',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  boxSizing: 'border-box',
                  transition: 'opacity 0.15s ease',
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
                style={{
                  width: '150px',
                  height: '38px',
                  padding: '0 12px',
                  background: '#FFFFFF',
                  border: 'none',
                  borderRight: '1px solid #E2E8F0',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  boxSizing: 'border-box',
                  transition: 'opacity 0.15s ease',
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
                style={{
                  width: '150px',
                  height: '38px',
                  padding: '0 12px',
                  background: '#FFFFFF',
                  border: 'none',
                  borderRight: '1px solid #E2E8F0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  boxSizing: 'border-box',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Users size={14} color="#64748B" style={{ flexShrink: 0 }} />
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
            <div className="tables-actions" style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
              {/* Refresh Button */}
              <button
                type="button"
                onClick={fetchTables}
                disabled={loading}
                title="Refresh Table Status"
                aria-label="Refresh Table Status"
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '8px',
                  border: '1px solid var(--border, #E2E8F0)',
                  background: '#FFFFFF',
                  color: '#475569',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.03)',
                  transition: 'all 0.15s ease',
                }}
              >
                <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
              </button>

              {/* Merge Tables Button */}
              <button
                type="button"
                onClick={() => {
                  if (mergeSourceTable) {
                    handleCancelMergeMode();
                  } else {
                    handleStartMergeMode();
                  }
                }}
                title={mergeSourceTable ? "Cancel merge mode" : "Merge Tables for Large Parties"}
                style={{
                  height: '38px',
                  padding: '0 12px',
                  fontSize: '12px',
                  fontWeight: 700,
                  borderRadius: '8px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: mergeSourceTable ? '#FEF2F2' : '#FFFFFF',
                  border: `1px solid ${mergeSourceTable ? '#F87171' : 'var(--border, #CBD5E1)'}`,
                  color: mergeSourceTable ? '#DC2626' : '#334155',
                  cursor: 'pointer',
                  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.03)',
                  transition: 'all 0.15s ease',
                }}
              >
                <Link2 size={15} color={mergeSourceTable ? '#DC2626' : primaryColor} />
                <span>{mergeSourceTable ? 'Cancel Merge' : 'Merge Tables'}</span>
              </button>

              {/* Add Table Button */}
              <button
                type="button"
                onClick={() => setIsAddModalOpen(true)}
                className="btn btn-primary"
                style={{
                  height: '38px',
                  padding: '0 14px',
                  fontSize: '12px',
                  fontWeight: 700,
                  borderRadius: '8px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxSizing: 'border-box',
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
      <div style={{ padding: '20px', width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>

      {/* Merge Selection Mode Alert Banner */}
      {mergeSourceTable && (
        <div
          style={{
            marginBottom: '16px',
            padding: '12px 18px',
            borderRadius: '10px',
            background: '#F0FDF4',
            border: `1.5px solid ${primaryColor}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            animation: 'fadeIn 0.15s ease-out',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span
              style={{
                width: '30px',
                height: '30px',
                borderRadius: '50%',
                background: `${primaryColor}20`,
                color: primaryColor,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Link2 size={16} />
            </span>
            <div>
              <span style={{ fontSize: '13px', fontWeight: 800, color: '#0F172A', display: 'block' }}>
                Merging with Table #{mergeSourceTable.table_number} ({mergeSourceTable.capacity} seats)
              </span>
              <span style={{ fontSize: '12px', color: '#475569' }}>
                Click on the second table you want to merge together.
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleCancelMergeMode}
            style={{
              padding: '6px 14px',
              borderRadius: '6px',
              border: '1px solid #CBD5E1',
              background: '#FFFFFF',
              color: '#475569',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            Cancel
          </button>
        </div>
      )}

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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
          {filteredTables.map(table => (
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
              onTakeOrder={(t) => handleTakeOrder(t)}
              onEdit={(t) => setSelectedEditTable(t)}
              onViewQR={(t) => setSelectedQRTable(t)}
              onDelete={(t) => setTableToDelete(t)}
              onUnmerge={handleUnmergeTable}
              onMerge={(t) => handleStartMergeMode(t)}
              isMergeSource={mergeSourceTable?.id === table.id}
              isMergeSelectionMode={Boolean(mergeSourceTable)}
              onSelectForMerge={(t) => handleTableClickInMergeMode(t)}
              primaryColor={primaryColor}
            />
          ))}
        </div>
      )}
      </div>

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

      {/* Confirmation Popup for Merge */}
      <MergeConfirmModal
        isOpen={isConfirmMergeOpen}
        onClose={() => {
          setIsConfirmMergeOpen(false);
          setMergeTargetTable(null);
        }}
        onConfirm={handleConfirmMerge}
        sourceTable={mergeSourceTable}
        targetTable={mergeTargetTable}
        loading={mergeLoading}
        primaryColor={primaryColor}
      />

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
    </AdminContentWrapper>
  );
}

