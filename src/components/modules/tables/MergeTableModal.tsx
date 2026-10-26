import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Link2, X, Users, AlertCircle, Check, ArrowRight } from 'lucide-react';
import { RestaurantTable } from '@/modules/tables/tables.repository';

interface MergeTableModalProps {
  isOpen: boolean;
  onClose: () => void;
  tables: RestaurantTable[];
  onMerge: (primaryTableId: string, secondaryTableIds: string[]) => Promise<void>;
  loading: boolean;
  primaryColor?: string;
  preSelectedTableId?: string | null;
}

export function MergeTableModal({
  isOpen,
  onClose,
  tables,
  onMerge,
  loading,
  primaryColor = '#059669',
  preSelectedTableId = null,
}: MergeTableModalProps) {
  const [mounted, setMounted] = useState(false);
  const [primaryTableId, setPrimaryTableId] = useState<string>('');
  const [selectedSecondaryIds, setSelectedSecondaryIds] = useState<string[]>([]);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Set initial primary table selection if passed or reset on open
  useEffect(() => {
    if (isOpen) {
      if (preSelectedTableId) {
        setPrimaryTableId(preSelectedTableId);
      } else {
        // Default to first standalone table
        const firstStandalone = tables.find(t => !t.merged_into_table_id);
        setPrimaryTableId(firstStandalone ? firstStandalone.id : '');
      }
      setSelectedSecondaryIds([]);
    }
  }, [isOpen, preSelectedTableId, tables]);

  if (!isOpen || !mounted) return null;

  // Primary table can only be a standalone table (not already merged into something else)
  const candidatePrimaryTables = tables.filter(t => !t.merged_into_table_id);
  const currentPrimary = tables.find(t => t.id === primaryTableId);

  // Available secondary tables to join (not the primary table itself, and not a parent of another group)
  const candidateSecondaryTables = tables.filter(t => {
    if (t.id === primaryTableId) return false;
    // If it already has child tables merged into it, cannot be a secondary
    if (t.merged_table_ids && t.merged_table_ids.length > 0) return false;
    return true;
  });

  const toggleSecondary = (id: string) => {
    setSelectedSecondaryIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  // Calculations for live preview
  const primaryCapacity = currentPrimary?.capacity || 0;
  const secondaryCapacitySum = tables
    .filter(t => selectedSecondaryIds.includes(t.id))
    .reduce((sum, t) => sum + (t.capacity || 0), 0);
  const totalCombinedCapacity = primaryCapacity + secondaryCapacitySum;

  const secondaryOrdersCount = tables
    .filter(t => selectedSecondaryIds.includes(t.id))
    .reduce((sum, t) => sum + (t.active_orders_count || 0), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!primaryTableId || selectedSecondaryIds.length === 0) return;
    await onMerge(primaryTableId, selectedSecondaryIds);
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
          maxWidth: '520px',
          background: '#FFFFFF',
          borderRadius: '12px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden',
          animation: 'fadeIn 0.2s ease-out',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '18px 24px',
          borderBottom: '1px solid #F1F5F9',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: '#F8FAFC'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              background: `${primaryColor}15`,
              color: primaryColor,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Link2 size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '17px', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                Merge Tables
              </h3>
              <p style={{ fontSize: '12px', color: '#64748B', margin: '2px 0 0' }}>
                Join tables together for large parties and combine bills
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            style={{
              border: 'none',
              background: '#FFFFFF',
              color: '#64748B',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ padding: '20px 24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Step 1: Lead/Primary Table */}
          <div>
            <label style={{ fontSize: '13px', fontWeight: 800, color: '#1E293B', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
              <span style={{ width: '20px', height: '20px', borderRadius: '50%', background: primaryColor, color: '#FFFFFF', fontSize: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>1</span>
              Select Lead / Primary Table
            </label>
            <p style={{ fontSize: '12px', color: '#64748B', margin: '0 0 10px 26px' }}>
              This table will act as the master identifier for all active tickets and checkout bills.
            </p>
            <select
              value={primaryTableId}
              onChange={(e) => {
                setPrimaryTableId(e.target.value);
                // Remove if it was selected in secondary
                setSelectedSecondaryIds(prev => prev.filter(id => id !== e.target.value));
              }}
              required
              style={{
                width: '100%',
                padding: '11px 14px',
                borderRadius: '8px',
                border: '1.5px solid #CBD5E1',
                fontSize: '14px',
                color: '#0F172A',
                fontWeight: 600,
                outline: 'none',
                background: '#FFFFFF'
              }}
            >
              {candidatePrimaryTables.map(t => (
                <option key={t.id} value={t.id}>
                  Table #{t.table_number} ({t.capacity} seats) — {t.status === 'OCCUPIED' ? '🔴 Occupied' : '🟢 Available'}
                </option>
              ))}
            </select>
          </div>

          {/* Step 2: Select Tables to Join */}
          <div>
            <label style={{ fontSize: '13px', fontWeight: 800, color: '#1E293B', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
              <span style={{ width: '20px', height: '20px', borderRadius: '50%', background: primaryColor, color: '#FFFFFF', fontSize: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>2</span>
              Select Tables to Join into Table #{currentPrimary?.table_number || ''}
            </label>
            <p style={{ fontSize: '12px', color: '#64748B', margin: '0 0 10px 26px' }}>
              Select one or more adjacent tables to merge.
            </p>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
              gap: '10px',
              maxHeight: '190px',
              overflowY: 'auto',
              padding: '4px'
            }}>
              {candidateSecondaryTables.map(t => {
                const isSelected = selectedSecondaryIds.includes(t.id);
                const isOccupied = t.status === 'OCCUPIED';

                return (
                  <div
                    key={t.id}
                    onClick={() => toggleSecondary(t.id)}
                    style={{
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: `2px solid ${isSelected ? primaryColor : '#E2E8F0'}`,
                      background: isSelected ? `${primaryColor}0C` : '#FFFFFF',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                      transition: 'all 0.15s ease',
                      boxShadow: isSelected ? `0 2px 8px ${primaryColor}20` : 'none',
                      position: 'relative'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '14px', fontWeight: 800, color: '#0F172A' }}>
                        Table #{t.table_number}
                      </span>
                      <div style={{
                        width: '18px',
                        height: '18px',
                        borderRadius: '4px',
                        border: `1.5px solid ${isSelected ? primaryColor : '#CBD5E1'}`,
                        background: isSelected ? primaryColor : '#FFFFFF',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#FFFFFF'
                      }}>
                        {isSelected && <Check size={12} strokeWidth={3} />}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#64748B' }}>
                      <Users size={12} /> {t.capacity} seats
                    </div>
                    {isOccupied && (
                      <span style={{
                        fontSize: '10px',
                        fontWeight: 700,
                        color: '#B45309',
                        background: '#FEF3C7',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        width: 'fit-content'
                      }}>
                        Has Active Order
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Step 3: Live Summary Banner */}
          {selectedSecondaryIds.length > 0 && (
            <div style={{
              background: '#F0FDF4',
              border: `1px solid ${primaryColor}40`,
              borderRadius: '8px',
              padding: '14px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#166534' }}>
                  Total Effective Capacity
                </span>
                <span style={{ fontSize: '14px', fontWeight: 900, color: primaryColor }}>
                  {totalCombinedCapacity} Seats ({primaryCapacity} + {secondaryCapacitySum})
                </span>
              </div>

              {secondaryOrdersCount > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#854D0E', background: '#FEF9C3', padding: '6px 10px', borderRadius: '6px' }}>
                  <AlertCircle size={14} color="#CA8A04" />
                  <span>
                    <strong>{secondaryOrdersCount} active order(s)</strong> from joined tables will be consolidated under Table #{currentPrimary?.table_number}.
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              style={{
                flex: 1,
                padding: '11px',
                borderRadius: '8px',
                border: '1px solid #E2E8F0',
                background: '#FFFFFF',
                color: '#475569',
                fontSize: '14px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || selectedSecondaryIds.length === 0}
              style={{
                flex: 2,
                padding: '11px',
                borderRadius: '8px',
                border: 'none',
                background: selectedSecondaryIds.length === 0 ? '#94A3B8' : primaryColor,
                color: '#FFFFFF',
                fontSize: '14px',
                fontWeight: 800,
                cursor: selectedSecondaryIds.length === 0 || loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: selectedSecondaryIds.length > 0 ? `0 4px 12px ${primaryColor}35` : 'none'
              }}
            >
              {loading ? (
                'Merging Tables...'
              ) : (
                <>
                  <Link2 size={16} />
                  Confirm & Merge ({selectedSecondaryIds.length + 1} Tables)
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
