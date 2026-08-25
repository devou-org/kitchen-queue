import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Trash2, AlertTriangle, X, Lock } from 'lucide-react';
import { RestaurantTable } from '@/modules/tables/tables.repository';

interface DeleteTableModalProps {
  table: RestaurantTable | null;
  onClose: () => void;
  onConfirmDelete: (tableId: string, tableNumber: string) => Promise<void>;
  loading?: boolean;
}

export function DeleteTableModal({
  table,
  onClose,
  onConfirmDelete,
  loading = false
}: DeleteTableModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!table || !mounted) return null;

  const isOccupied = table.status === 'OCCUPIED' || (table.active_orders_count && table.active_orders_count > 0);

  const handleDelete = async () => {
    if (isOccupied) return;
    await onConfirmDelete(table.id, table.table_number);
  };

  return createPortal(
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        background: 'rgba(15, 23, 42, 0.6)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '400px',
          background: '#FFFFFF',
          borderRadius: '20px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden',
          animation: 'fadeIn 0.2s ease-out'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid #F1F5F9',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '34px',
              height: '34px',
              borderRadius: '10px',
              background: isOccupied ? '#FEF2F2' : '#FEE2E2',
              color: '#EF4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {isOccupied ? <Lock size={18} color="#DC2626" /> : <Trash2 size={18} color="#DC2626" />}
            </div>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                {isOccupied ? `Table #${table.table_number} is Occupied` : `Delete Table #${table.table_number}`}
              </h3>
              <p style={{ fontSize: '12px', color: '#64748B', margin: '2px 0 0' }}>
                {isOccupied ? 'Action Restricted' : 'Confirm Table Removal'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              border: 'none',
              background: '#F8FAFC',
              color: '#64748B',
              borderRadius: '50%',
              width: '30px',
              height: '30px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={15} />
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: '20px' }}>
          {isOccupied ? (
            <div style={{
              padding: '14px',
              background: '#FFFBEB',
              borderRadius: '12px',
              border: '1px solid #FDE68A',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px'
            }}>
              <AlertTriangle size={20} color="#D97706" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#92400E', margin: '0 0 4px' }}>
                  Cannot Delete Occupied Table
                </h4>
                <p style={{ fontSize: '12px', color: '#B45309', margin: 0, lineHeight: 1.45 }}>
                  Table #{table.table_number} currently has <strong>{table.active_orders_count || 1} active order(s)</strong>. Please settle or cancel all orders for this table before deleting it.
                </p>
              </div>
            </div>
          ) : (
            <p style={{ fontSize: '13px', color: '#475569', margin: 0, lineHeight: 1.5 }}>
              Are you sure you want to delete <strong>Table #{table.table_number}</strong>? This action cannot be undone and will permanently remove its QR code.
            </p>
          )}

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1,
                padding: '10px 14px',
                borderRadius: '10px',
                border: '1px solid #CBD5E1',
                background: '#FFFFFF',
                color: '#475569',
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer'
              }}
            >
              {isOccupied ? 'Close' : 'Cancel'}
            </button>

            {!isOccupied && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={loading}
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  borderRadius: '10px',
                  border: 'none',
                  background: '#DC2626',
                  color: '#FFFFFF',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.7 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                {loading ? 'Deleting...' : 'Delete Table'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
