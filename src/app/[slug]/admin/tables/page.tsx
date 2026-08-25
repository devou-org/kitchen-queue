'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { Plus, LayoutGrid, Users, CheckCircle, Clock, RefreshCw, QrCode } from 'lucide-react';
import { AdminContentWrapper } from '@/components/AdminContentWrapper';
import { AdminPageHeader } from '@/components/AdminPageHeader';
import { useRestaurant } from '@/hooks/useRestaurant';
import { RestaurantTable } from '@/modules/tables/tables.repository';
import { TableCard } from '@/components/modules/tables/TableCard';
import { CreateTableModal } from '@/components/modules/tables/CreateTableModal';
import { TableQRModal } from '@/components/modules/tables/TableQRModal';

export default function AdminTablesPage() {
  const { slug } = useParams();
  const slugStr = Array.isArray(slug) ? slug[0] : slug;
  const { restaurant } = useRestaurant();
  const primaryColor = restaurant?.primary_color || '#059669';

  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'ALL' | 'AVAILABLE' | 'OCCUPIED'>('ALL');

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addingTable, setAddingTable] = useState(false);
  const [selectedQRTable, setSelectedQRTable] = useState<RestaurantTable | null>(null);

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

  const handleDeleteTable = async (tableId: string, tableNumber: string) => {
    if (!confirm(`Are you sure you want to delete Table #${tableNumber}?`)) return;

    try {
      const headers: Record<string, string> = slugStr ? { 'x-restaurant-slug': slugStr } : {};
      const res = await fetch(`/api/tables/${tableId}`, {
        method: 'DELETE',
        headers
      });

      const data = await res.json();
      if (data.success) {
        toast.success(`Table #${tableNumber} deleted`);
        fetchTables();
      } else {
        toast.error(data.error || 'Failed to delete table');
      }
    } catch {
      toast.error('Network error deleting table');
    }
  };

  // Filtered tables list
  const filteredTables = tables.filter(t => {
    if (filter === 'AVAILABLE') return t.status === 'AVAILABLE';
    if (filter === 'OCCUPIED') return t.status === 'OCCUPIED';
    return true;
  });

  const occupiedCount = tables.filter(t => t.status === 'OCCUPIED').length;
  const availableCount = tables.filter(t => t.status === 'AVAILABLE').length;

  return (
    <AdminContentWrapper>
      <AdminPageHeader
        title="Table Management"
        description="Create tables with seat capacities, download QR codes, and monitor real-time order timestamps."
      />

      {/* Top Action & Stat Controls */}
      <div className="card" style={{ marginBottom: '20px', display: 'flex', gap: '16px', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
        {/* Filter Badges */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setFilter('ALL')}
            style={{
              borderRadius: '20px',
              padding: '6px 16px',
              fontSize: '13px',
              fontWeight: 700,
              background: filter === 'ALL' ? primaryColor : '#FFFFFF',
              color: filter === 'ALL' ? '#FFFFFF' : primaryColor,
              border: `1.5px solid ${primaryColor}`,
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            All ({tables.length})
          </button>
          <button
            onClick={() => setFilter('AVAILABLE')}
            style={{
              borderRadius: '20px',
              padding: '6px 16px',
              fontSize: '13px',
              fontWeight: 700,
              background: filter === 'AVAILABLE' ? primaryColor : '#FFFFFF',
              color: filter === 'AVAILABLE' ? '#FFFFFF' : primaryColor,
              border: `1.5px solid ${primaryColor}`,
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            Available ({availableCount})
          </button>
          <button
            onClick={() => setFilter('OCCUPIED')}
            style={{
              borderRadius: '20px',
              padding: '6px 16px',
              fontSize: '13px',
              fontWeight: 700,
              background: filter === 'OCCUPIED' ? primaryColor : '#FFFFFF',
              color: filter === 'OCCUPIED' ? '#FFFFFF' : primaryColor,
              border: `1.5px solid ${primaryColor}`,
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            Occupied ({occupiedCount})
          </button>
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={fetchTables}
            title="Refresh Table Status"
            aria-label="Refresh Table Status"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '8px 12px',
              borderRadius: '10px',
              border: `1.5px solid ${primaryColor}`,
              color: primaryColor,
              background: '#FFFFFF',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            <RefreshCw size={16} />
          </button>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', background: primaryColor, borderColor: primaryColor }}
          >
            <Plus size={16} /> Add Table
          </button>
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
            {filter !== 'ALL' ? 'No tables match the selected status filter.' : 'Create your first restaurant table to generate QR codes.'}
          </p>
          {filter === 'ALL' && (
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="btn btn-primary"
              style={{ background: primaryColor }}
            >
              + Create Table
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
          {filteredTables.map(table => (
            <TableCard
              key={table.id}
              table={table}
              onViewQR={(t) => setSelectedQRTable(t)}
              onDelete={handleDeleteTable}
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

      <TableQRModal
        table={selectedQRTable}
        restaurantName={restaurant?.name}
        restaurantLogo={restaurant?.logo_url}
        onClose={() => setSelectedQRTable(null)}
        primaryColor={primaryColor}
      />
    </AdminContentWrapper>
  );
}
