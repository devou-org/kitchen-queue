'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { Plus, LayoutGrid, Users, RefreshCw, QrCode, Search, X } from 'lucide-react';
import { AdminContentWrapper } from '@/components/AdminContentWrapper';
import { AdminPageHeader } from '@/components/AdminPageHeader';
import { useRestaurant } from '@/hooks/useRestaurant';
import { RestaurantTable } from '@/modules/tables/tables.repository';
import { TableCard } from '@/components/modules/tables/TableCard';
import { CreateTableModal } from '@/components/modules/tables/CreateTableModal';
import { EditTableModal } from '@/components/modules/tables/EditTableModal';
import { TableQRModal } from '@/components/modules/tables/TableQRModal';
import { DeleteTableModal } from '@/components/modules/tables/DeleteTableModal';

export default function AdminTablesPage() {
  const { slug } = useParams();
  const slugStr = Array.isArray(slug) ? slug[0] : slug;
  const { restaurant } = useRestaurant();
  const primaryColor = restaurant?.primary_color || '#059669';

  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'ALL' | 'AVAILABLE' | 'OCCUPIED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addingTable, setAddingTable] = useState(false);
  const [selectedEditTable, setSelectedEditTable] = useState<RestaurantTable | null>(null);
  const [selectedQRTable, setSelectedQRTable] = useState<RestaurantTable | null>(null);
  const [tableToDelete, setTableToDelete] = useState<RestaurantTable | null>(null);
  const [deletingTable, setDeletingTable] = useState(false);

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
    <AdminContentWrapper>
      <AdminPageHeader
        title="Table Management"
        description="Create tables with seat capacities, download QR codes, and monitor real-time order timestamps."
        action={
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button
              onClick={fetchTables}
              title="Refresh Table Status"
              aria-label="Refresh Table Status"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '40px',
                width: '40px',
                borderRadius: '12px',
                border: `1.5px solid ${primaryColor}`,
                color: primaryColor,
                background: '#FFFFFF',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxSizing: 'border-box'
              }}
            >
              <RefreshCw size={18} />
            </button>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="btn btn-primary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '40px',
                gap: '6px',
                background: primaryColor,
                borderColor: primaryColor,
                borderRadius: '20px',
                padding: '0 18px',
                fontWeight: 700,
                boxSizing: 'border-box'
              }}
            >
              <Plus size={18} /> Add Table
            </button>
          </div>
        }
      />

      {/* Unified Stat Summary & Search Card Header */}
      <div
        style={{
          background: '#FFFFFF',
          borderRadius: '16px',
          border: '1px solid #E2E8F0',
          boxShadow: '0 2px 10px rgba(0, 0, 0, 0.03)',
          padding: '12px',
          marginBottom: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}
      >
        {/* Top Section: Stat Summary */}
        <div
          style={{
            display: 'flex',
            alignItems: 'stretch',
            flexWrap: 'wrap',
            gap: '12px'
          }}
        >
          {/* Left Card: Total Tables in Restaurant Primary Color */}
          <div
            style={{
              background: `linear-gradient(135deg, ${primaryColor} 0%, ${primaryColor}E6 100%)`,
              borderRadius: '12px',
              padding: '16px 20px',
              minWidth: '220px',
              flex: '1 1 220px',
              color: '#FFFFFF',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              boxShadow: `0 4px 14px ${primaryColor}33`
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '14px', fontWeight: 600, color: '#FFFFFF', opacity: 0.95 }}>
                Total Tables
              </span>
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#FFFFFF"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ opacity: 0.9 }}
              >
                <ellipse cx="12" cy="7" rx="8" ry="3" />
                <path d="M12 10v7" />
                <line x1="8" y1="17" x2="16" y2="17" />
              </svg>
            </div>
            <div style={{ fontSize: '30px', fontWeight: 800, marginTop: '12px', lineHeight: 1 }}>
              {tables.length}
            </div>
          </div>

          {/* Right Stat Items: Occupied, Reserved, Available */}
          <div
            style={{
              flex: '3 1 400px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-around',
              flexWrap: 'wrap',
              padding: '4px 0'
            }}
          >
            {/* Occupied */}
            <div
              style={{
                flex: 1,
                minWidth: '130px',
                padding: '12px 24px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderRight: '1px solid #F1F5F9'
              }}
            >
              <span style={{ fontSize: '15px', fontWeight: 600, color: '#0F172A' }}>Occupied</span>
              <span style={{ fontSize: '22px', fontWeight: 800, color: '#E04F16' }}>{occupiedCount}</span>
            </div>

            {/* Reserved - disabled for now */}
            {/* <div
              style={{
                flex: 1,
                minWidth: '130px',
                padding: '12px 24px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderRight: '1px solid #F1F5F9'
              }}
            >
              <span style={{ fontSize: '15px', fontWeight: 600, color: '#0F172A' }}>Reserved</span>
              <span style={{ fontSize: '22px', fontWeight: 800, color: '#2563EB' }}>{reservedCount}</span>
            </div> */}

            {/* Available */}
            <div
              style={{
                flex: 1,
                minWidth: '130px',
                padding: '12px 24px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <span style={{ fontSize: '15px', fontWeight: 600, color: '#0F172A' }}>Available</span>
              <span style={{ fontSize: '22px', fontWeight: 800, color: '#16A34A' }}>{availableCount}</span>
            </div>
          </div>
        </div>

        {/* Subtle Inner Divider */}
        <div style={{ height: '1px', background: '#F1F5F9', margin: '2px 0' }} />

        {/* Bottom Section: Search Box & Free Seats Indicator */}
        <div
          style={{
            display: 'flex',
            gap: '12px',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            padding: '2px 4px'
          }}
        >
          {/* Search Box */}
          <div style={{ position: 'relative', minWidth: '240px', flex: '1 1 300px' }}>
            <Search
              size={16}
              color="#94A3B8"
              style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
            />
            <input
              type="text"
              placeholder="Search table # or guest..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 32px 8px 36px',
                borderRadius: '10px',
                border: '1.5px solid #E2E8F0',
                fontSize: '13px',
                outline: 'none',
                background: '#F8FAFC',
                color: '#0F172A',
                transition: 'all 0.2s ease'
              }}
              onFocus={(e) => (e.target.style.borderColor = primaryColor)}
              onBlur={(e) => (e.target.style.borderColor = '#E2E8F0')}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: '#94A3B8',
                  cursor: 'pointer',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Seats Summary Badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', background: '#F8FAFC', padding: '6px 14px', borderRadius: '20px', border: '1px solid #E2E8F0' }}>
            <Users size={15} color={primaryColor} />
            <span style={{ color: '#475569', fontWeight: 600 }}>
              Free Seats: <strong style={{ color: totalRemainingSeats > 0 ? '#16A34A' : '#DC2626' }}>{totalRemainingSeats}</strong> / {totalCapacity}
            </span>
          </div>
        </div>
      </div>

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
              onEdit={(t) => setSelectedEditTable(t)}
              onViewQR={(t) => setSelectedQRTable(t)}
              onDelete={(t) => setTableToDelete(t)}
              primaryColor={primaryColor}
            />
          ))}
        </div>
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

