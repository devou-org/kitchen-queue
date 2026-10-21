import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Merge, X, Users, AlertCircle } from 'lucide-react';
import { RestaurantTable } from '@/modules/tables/tables.repository';

interface MergeConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  sourceTable: RestaurantTable | null;
  targetTable: RestaurantTable | null;
  loading: boolean;
  primaryColor?: string;
}

export function MergeConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  sourceTable,
  targetTable,
  loading,
  primaryColor = '#059669',
}: MergeConfirmModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!isOpen || !mounted || !sourceTable || !targetTable) return null;

  const totalCapacity = (Number(sourceTable.capacity) || 0) + (Number(targetTable.capacity) || 0);
  const hasOrders = (targetTable.active_orders_count || 0) > 0 || (sourceTable.active_orders_count || 0) > 0;

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.5)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        animation: 'fadeIn 0.15s ease-out'
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '380px',
          background: '#FFFFFF',
          borderRadius: '12px',
          boxShadow: '0 20px 40px -10px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          animation: 'scaleIn 0.15s ease-out'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: '#FEF3C7',
              color: '#B45309',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Merge size={18} />
            </div>
            <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#0F172A', margin: 0 }}>
              Merge Tables?
            </h3>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            style={{
              border: 'none',
              background: '#F8FAFC',
              color: '#64748B',
              borderRadius: '50%',
              width: '28px',
              height: '28px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={15} />
          </button>
        </div>

        {/* Tables to Merge Display */}
        <div style={{
          background: '#F8FAFC',
          borderRadius: '8px',
          padding: '12px 14px',
          border: '1px solid #E2E8F0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-around',
          gap: '8px'
        }}>
          <div style={{ textAlign: 'center' }}>
            <span style={{ fontSize: '14px', fontWeight: 900, color: '#0F172A', display: 'block' }}>
              Table #{sourceTable.table_number}
            </span>
            <span style={{ fontSize: '11px', color: '#64748B' }}>
              {sourceTable.capacity} seats
            </span>
          </div>

          <div style={{
            color: '#B45309',
            background: '#FEF3C7',
            borderRadius: '50%',
            width: '26px',
            height: '26px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '14px',
            fontWeight: 800
          }}>
            +
          </div>

          <div style={{ textAlign: 'center' }}>
            <span style={{ fontSize: '14px', fontWeight: 900, color: '#0F172A', display: 'block' }}>
              Table #{targetTable.table_number}
            </span>
            <span style={{ fontSize: '11px', color: '#64748B' }}>
              {targetTable.capacity} seats
            </span>
          </div>
        </div>

        {/* Capacity Summary */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', padding: '0 4px' }}>
          <span style={{ color: '#475569', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Users size={15} color={primaryColor} /> Combined Capacity:
          </span>
          <strong style={{ color: '#0F172A', fontSize: '14px' }}>
            {totalCapacity} Seats
          </strong>
        </div>

        {hasOrders && (
          <div style={{
            fontSize: '11px',
            color: '#92400E',
            background: '#FEF9C3',
            padding: '8px 10px',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <AlertCircle size={14} color="#D97706" style={{ flexShrink: 0 }} />
            <span>Active orders will be combined under <strong>Table #{sourceTable.table_number}</strong>.</span>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            style={{
              flex: 1,
              padding: '9px 12px',
              borderRadius: '8px',
              border: '1px solid #CBD5E1',
              background: '#FFFFFF',
              color: '#475569',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            style={{
              flex: 1.5,
              padding: '9px 14px',
              borderRadius: '8px',
              border: 'none',
              background: primaryColor,
              color: '#FFFFFF',
              fontSize: '13px',
              fontWeight: 800,
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              boxShadow: `0 2px 8px ${primaryColor}40`
            }}
          >
            {loading ? 'Merging...' : 'Confirm & Merge'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
