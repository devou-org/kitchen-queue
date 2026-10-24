import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Unlink, X } from 'lucide-react';
import { RestaurantTable } from '@/modules/tables/tables.repository';

interface UnmergeTableModalProps {
  table: RestaurantTable | null;
  onClose: () => void;
  onConfirmUnmerge: (table: RestaurantTable) => Promise<void>;
  loading?: boolean;
}

export function UnmergeTableModal({
  table,
  onClose,
  onConfirmUnmerge,
  loading = false,
}: UnmergeTableModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!table || !mounted) return null;

  const isPrimary = (table.merged_table_numbers?.length || 0) > 0;
  const mergedNumbers = table.merged_table_numbers || [];

  const handleUnmerge = async () => {
    await onConfirmUnmerge(table);
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
        padding: '16px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '420px',
          background: '#FFFFFF',
          borderRadius: '12px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden',
          animation: 'fadeIn 0.2s ease-out',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #F1F5F9',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '8px',
                background: '#FEF2F2',
                color: '#DC2626',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Unlink size={17} color="#DC2626" />
            </div>
            <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#0F172A', margin: 0 }}>
              {isPrimary ? 'Unmerge Tables' : 'Detach Table'}
            </h3>
          </div>

          <button
            type="button"
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
              justifyContent: 'center',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#E2E8F0';
              e.currentTarget.style.color = '#0F172A';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#F8FAFC';
              e.currentTarget.style.color = '#64748B';
            }}
          >
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px' }}>
          <p style={{ fontSize: '14px', color: '#334155', lineHeight: 1.5, margin: 0 }}>
            {isPrimary ? (
              <>
                Are you sure you want to unmerge{' '}
                <strong style={{ color: '#0F172A' }}>Table #{table.table_number}</strong>?
              </>
            ) : (
              <>
                Are you sure you want to detach{' '}
                <strong style={{ color: '#0F172A' }}>Table #{table.table_number}</strong> from{' '}
                <strong style={{ color: '#0F172A' }}>Table #{table.parent_table_number}</strong>?
              </>
            )}
          </p>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '12px 20px',
            borderTop: '1px solid #F1F5F9',
            background: '#F8FAFC',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '10px',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: '1px solid #CBD5E1',
              background: '#FFFFFF',
              color: '#475569',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'background 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#F1F5F9')}
            onMouseLeave={(e) => (e.currentTarget.style.background = '#FFFFFF')}
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleUnmerge}
            disabled={loading}
            style={{
              padding: '8px 18px',
              borderRadius: '8px',
              border: 'none',
              background: '#DC2626',
              color: '#FFFFFF',
              fontSize: '13px',
              fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 2px 6px rgba(220, 38, 38, 0.3)',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              if (!loading) e.currentTarget.style.background = '#B91C1C';
            }}
            onMouseLeave={(e) => {
              if (!loading) e.currentTarget.style.background = '#DC2626';
            }}
          >
            {loading ? (
              <>
                <div
                  className="animate-spin"
                  style={{
                    width: '12px',
                    height: '12px',
                    border: '2px solid #FFFFFF',
                    borderTopColor: 'transparent',
                    borderRadius: '50%',
                  }}
                />
                <span>Unmerging...</span>
              </>
            ) : (
              <>
                <Unlink size={14} />
                <span>{isPrimary ? 'Unmerge Tables' : 'Detach Table'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
