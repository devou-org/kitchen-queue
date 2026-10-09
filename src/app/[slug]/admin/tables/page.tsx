'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Plus, LayoutGrid, Users, RefreshCw, QrCode, Search, X } from 'lucide-react';
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

  // Filtered tables list
  const filteredTables = tables.filter(t => {
    if (filter === 'AVAILABLE' && t.status !== 'AVAILABLE') return false;
    if (filter === 'OCCUPIED' && t.status !== 'OCCUPIED') return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchesTableNumber = String(t.table_number || '').toLowerCase().includes(q);
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
  // const reservedCount = tables.filter((t: any) => t.status === 'RESERVED').length;

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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
          {filteredTables.map(table => (
            <TableCard
              key={table.id}
              table={table}
              onSelect={(t, ord) => handleSelectTable(t, ord)}
              onTakeOrder={(t) => handleTakeOrder(t)}
              onEdit={(t) => setSelectedEditTable(t)}
              onViewQR={(t) => setSelectedQRTable(t)}
              onDelete={(t) => setTableToDelete(t)}
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

      {/* Modals */}
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

