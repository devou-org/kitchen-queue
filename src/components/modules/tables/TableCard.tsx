import React, { useState, useRef, useEffect } from 'react';
import { Users, QrCode, Trash2, ShoppingBag, Edit2, Utensils, Merge, Unlink, MoreVertical, Check } from 'lucide-react';
import { RestaurantTable } from '@/modules/tables/tables.repository';
import { formatPrice } from '@/lib/format';

interface TableCardProps {
  table: RestaurantTable;
  onSelect?: (table: RestaurantTable, order?: any) => void;
  onTakeOrder?: (table: RestaurantTable) => void;
  onViewQR: (table: RestaurantTable) => void;
  onEdit: (table: RestaurantTable) => void;
  onDelete: (table: RestaurantTable) => void;
  onUnmerge?: (table: RestaurantTable) => void;
  onMerge?: (table: RestaurantTable) => void;
  isMergeSource?: boolean;
  isMergeTarget?: boolean;
  isMergeSelectionMode?: boolean;
  onSelectForMerge?: (table: RestaurantTable) => void;
  primaryColor?: string;
  joinedCardPosition?: 'left' | 'right' | 'middle' | null;
  displayTitle?: string;
  hideActiveOrders?: boolean;
  mergedOrdersContext?: any[];
  allocatedSeatedGuests?: number;
  hideHeader?: boolean;
}

function TableVisualDiagram({
  capacity,
  seatedGuests,
  isOccupied,
  tableNumber,
  primaryColor,
  onTakeOrder,
  compact = false,
}: {
  capacity: number;
  seatedGuests: number;
  isOccupied: boolean;
  tableNumber: string;
  primaryColor: string;
  onTakeOrder?: () => void;
  compact?: boolean;
}) {
  let leftCount = 0;
  let rightCount = 0;
  let topCount = 0;
  let bottomCount = 0;

  if (capacity === 1) {
    topCount = 1;
  } else if (capacity === 2) {
    topCount = 1;
    bottomCount = 1;
  } else if (capacity === 3) {
    topCount = 1;
    bottomCount = 1;
    leftCount = 1;
  } else {
    leftCount = 1;
    rightCount = 1;
    const sideRemaining = capacity - 2;
    topCount = Math.ceil(sideRemaining / 2);
    bottomCount = Math.floor(sideRemaining / 2);
  }

  const totalChairs = capacity;
  const chairStates: boolean[] = [];
  for (let i = 0; i < totalChairs; i++) {
    chairStates.push(isOccupied && i < seatedGuests);
  }

  let chairIndex = 0;
  const topChairs = [];
  for (let i = 0; i < topCount; i++) topChairs.push(chairStates[chairIndex++] ?? false);
  const rightChairs = [];
  for (let i = 0; i < rightCount; i++) rightChairs.push(chairStates[chairIndex++] ?? false);
  const bottomChairs = [];
  for (let i = 0; i < bottomCount; i++) bottomChairs.push(chairStates[chairIndex++] ?? false);
  const leftChairs = [];
  for (let i = 0; i < leftCount; i++) leftChairs.push(chairStates[chairIndex++] ?? false);

  const chairW = compact ? '18px' : '26px';
  const chairH = compact ? '5px' : '7px';
  const tableH = compact ? '42px' : '62px';
  const tableMinW = compact ? (topCount > 2 ? `${topCount * 24}px` : '58px') : (topCount > 2 ? `${topCount * 36}px` : '96px');
  const btnSize = compact ? '26px' : '36px';
  const iconSize = compact ? 12 : 17;

  const getChairStyle = (occupied: boolean, isVertical: boolean) => ({
    width: isVertical ? chairH : chairW,
    height: isVertical ? chairW : chairH,
    borderRadius: '6px',
    background: occupied
      ? '#EAB308'
      : (isOccupied ? '#E2E8F0' : `${primaryColor}35`),
    border: occupied ? '1px solid #CA8A04' : 'none',
    boxShadow: occupied ? '0 1px 3px rgba(234, 179, 8, 0.3)' : 'none',
    transition: 'all 0.2s ease',
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: compact ? '4px 0 4px' : '16px 0 12px' }}>
      <div style={{ display: 'flex', gap: compact ? '5px' : '8px', marginBottom: '4px', height: chairH, alignItems: 'center' }}>
        {topChairs.map((occ, idx) => (
          <div key={`top-${idx}`} style={getChairStyle(occ, false)} title={occ ? 'Occupied Seat' : 'Free Seat'} />
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: compact ? '5px' : '8px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: compact ? '5px' : '8px', width: chairH, alignItems: 'center' }}>
          {leftChairs.map((occ, idx) => (
            <div key={`left-${idx}`} style={getChairStyle(occ, true)} title={occ ? 'Occupied Seat' : 'Free Seat'} />
          ))}
        </div>

        <div
          style={{
            minWidth: tableMinW,
            height: tableH,
            borderRadius: '8px',
            background: isOccupied ? '#FEF9C3' : '#F8FAFC',
            border: `2px solid ${isOccupied ? '#FDE68A' : `${primaryColor}25`}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 6px',
            position: 'relative',
            boxShadow: isOccupied
              ? '0 4px 12px rgba(234, 179, 8, 0.12)'
              : '0 2px 6px rgba(0, 0, 0, 0.03)',
            transition: 'all 0.2s ease',
          }}
        >
          {onTakeOrder && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onTakeOrder();
              }}
              title={`Take POS Order for Table #${tableNumber}`}
              style={{
                width: btnSize,
                height: btnSize,
                borderRadius: '50%',
                background: '#FFFFFF',
                border: `2px solid ${primaryColor}`,
                color: primaryColor,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                transition: 'all 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
                zIndex: 2,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.14)';
                e.currentTarget.style.background = primaryColor;
                e.currentTarget.style.color = '#FFFFFF';
                e.currentTarget.style.boxShadow = `0 4px 14px ${primaryColor}45`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.background = '#FFFFFF';
                e.currentTarget.style.color = primaryColor;
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.08)';
              }}
            >
              <Utensils size={iconSize} />
            </button>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: compact ? '5px' : '8px', width: chairH, alignItems: 'center' }}>
          {rightChairs.map((occ, idx) => (
            <div key={`right-${idx}`} style={getChairStyle(occ, true)} title={occ ? 'Occupied Seat' : 'Free Seat'} />
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: compact ? '5px' : '8px', marginTop: '4px', height: chairH, alignItems: 'center' }}>
        {bottomChairs.map((occ, idx) => (
          <div key={`bottom-${idx}`} style={getChairStyle(occ, false)} title={occ ? 'Occupied Seat' : 'Free Seat'} />
        ))}
      </div>
    </div>
  );
}

export function TableCard({
  table,
  onSelect,
  onTakeOrder,
  onViewQR,
  onEdit,
  onDelete,
  onUnmerge,
  onMerge,
  isMergeSource = false,
  isMergeTarget = false,
  isMergeSelectionMode = false,
  onSelectForMerge,
  primaryColor = '#059669',
  joinedCardPosition = null,
  displayTitle,
  hideActiveOrders = false,
  mergedOrdersContext,
  allocatedSeatedGuests,
  hideHeader = false,
}: TableCardProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMenuOpen]);

  const activeOrders = mergedOrdersContext || table.active_orders || [];
  const totalMergedSeated = activeOrders.reduce((sum: number, o: any) => sum + (Number(o.party_size) || 1), 0);
  const isOccupied = table.status === 'OCCUPIED' || totalMergedSeated > 0;

  const isPrimaryMerged = Boolean(table.merged_table_numbers && table.merged_table_numbers.length > 0);
  const isSecondaryMerged = Boolean(table.merged_into_table_id);
  const isMerged = isPrimaryMerged || isSecondaryMerged;

  const capacity = Math.min(14, Math.max(1, Number(table.capacity) || 4));
  const effectiveCapacity = Number(table.effective_capacity) || capacity;

  // For visual seated guests:
  // If allocatedSeatedGuests is provided, use it directly.
  // Otherwise, fallback to distribution based on joinedCardPosition
  let seatedGuests = typeof allocatedSeatedGuests === 'number'
    ? allocatedSeatedGuests
    : activeOrders.reduce((sum: number, o: any) => sum + (Number(o.party_size) || 1), 0);
  if (typeof allocatedSeatedGuests !== 'number' && mergedOrdersContext && joinedCardPosition) {
    if (joinedCardPosition === 'left') {
      seatedGuests = Math.min(capacity, totalMergedSeated);
    } else if (joinedCardPosition === 'right') {
      const remainingForRight = Math.max(0, totalMergedSeated - capacity);
      seatedGuests = Math.min(capacity, Math.max(totalMergedSeated > 0 ? 1 : 0, remainingForRight));
    }
  }

  const remainingSeats = isOccupied ? Math.max(0, capacity - seatedGuests) : capacity;
  const combinedTotal = activeOrders.reduce((sum, o) => sum + Number(o.total_price || 0), 0);

  const handleCardClick = () => {
    if (isMergeSelectionMode && onSelectForMerge && !isMergeSource) {
      onSelectForMerge(table);
    }
  };

  // Determine borderRadius and borders for seamless joined cards
  let cardBorderRadius = '12px';
  let cardBorder = (isMergeSource || isMergeTarget)
    ? `2px solid ${primaryColor}`
    : isMergeSelectionMode
    ? '1.5px dashed #CBD5E1'
    : isMerged
    ? `1.5px solid ${primaryColor}60`
    : '1px solid #E2E8F0';

  if (joinedCardPosition === 'left') {
    cardBorderRadius = '12px 0 0 12px';
    cardBorder = 'none';
  } else if (joinedCardPosition === 'right') {
    cardBorderRadius = '0 12px 12px 0';
    cardBorder = 'none';
  } else if (joinedCardPosition === 'middle') {
    cardBorderRadius = '0';
    cardBorder = 'none';
  }

  const titleText = displayTitle !== undefined ? displayTitle : `Table #${table.table_number}`;
  // Show merged badge only if it's not a secondary joined card (avoids 2 duplicate badges)
  const showMergedBadge = isMerged && (joinedCardPosition !== 'right');

  return (
    <div
      onClick={handleCardClick}
      className={joinedCardPosition ? `merged-subtable-card merged-pos-${joinedCardPosition}` : ''}
      style={{
        background: '#FFFFFF',
        borderRadius: cardBorderRadius,
        border: cardBorder,
        borderLeft: (joinedCardPosition === 'right' || joinedCardPosition === 'middle') ? '1px dashed #CBD5E1' : undefined,
        boxShadow: joinedCardPosition ? 'none' : (isMergeSource || isMergeTarget)
          ? `0 0 0 3px ${primaryColor}25, 0 8px 20px rgba(0, 0, 0, 0.08)`
          : isMerged
          ? `0 4px 14px ${primaryColor}12`
          : '0 2px 8px rgba(0, 0, 0, 0.04)',
        padding: joinedCardPosition ? '8px 10px' : '16px 18px',
        display: 'flex',
        flexDirection: 'column',
        gap: joinedCardPosition ? '4px' : '12px',
        position: 'relative',
        overflow: 'visible',
        zIndex: isMenuOpen ? 40 : 1,
        cursor: isMergeSelectionMode && !isMergeSource ? 'pointer' : 'default',
        transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        transform: (isMergeSource || isMergeTarget) ? 'scale(1.01)' : 'none',
        height: '100%',
        boxSizing: 'border-box',
      }}
    >
      {hideHeader ? (
        <div style={{ textAlign: 'center', margin: '0 0 -2px 0' }}>
          <span
            style={{
              fontSize: '10.5px',
              fontWeight: 800,
              color: '#64748B',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              background: '#F1F5F9',
              padding: '2px 8px',
              borderRadius: '5px',
              display: 'inline-block',
            }}
          >
            Table #{table.table_number}
          </span>
        </div>
      ) : (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, height: '28px' }}>
          {titleText ? (
            <h3
              style={{
                fontSize: '17px',
                fontWeight: 900,
                color: '#0F172A',
                margin: 0,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}
            >
              {titleText}
            </h3>
          ) : null}

          {/* Small Merged badge (only 1 badge shown on the joined pair) */}
          {showMergedBadge && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px',
                padding: '2px 7px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 700,
                background: '#FEF3C7',
                color: '#B45309',
                border: '1px solid #FDE68A',
                flexShrink: 0,
              }}
              title={
                isPrimaryMerged
                  ? `Merged with #${table.merged_table_numbers?.join(', #')}`
                  : `Merged into Table #${table.parent_table_number}`
              }
            >
              <Merge size={12} /> Merged
            </span>
          )}
        </div>

        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          {/* Quick Merge Button (Shown on standalone tables OR on the right table of joined merged card, hidden during merge selection) */}
          {!isMergeSelectionMode && onMerge && (!isMerged || joinedCardPosition !== 'left') && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onMerge(table);
              }}
              title="Merge with another table"
              style={{
                padding: '6px',
                borderRadius: '8px',
                border: '1px solid #E2E8F0',
                background: '#F8FAFC',
                color: primaryColor,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s ease'
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
              <Merge size={16} />
            </button>
          )}

          {/* Quick Unmerge Button for Merged Tables */}
          {!isMergeSelectionMode && isMerged && onUnmerge && (joinedCardPosition !== 'left') && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onUnmerge(table);
              }}
              title="Unmerge table"
              style={{
                padding: '6px',
                borderRadius: '8px',
                border: '1px solid #FEE2E2',
                background: '#FEF2F2',
                color: '#DC2626',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#FEE2E2';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#FEF2F2';
              }}
            >
              <Unlink size={16} />
            </button>
          )}

          {/* 3-Dots More Options Menu (Hidden during merge mode and on joined sub-cards) */}
          {!isMergeSelectionMode && !joinedCardPosition && (
            <div ref={menuRef} style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsMenuOpen(prev => !prev);
                }}
                title="More options"
                style={{
                  padding: '6px',
                  borderRadius: '8px',
                  border: '1px solid #E2E8F0',
                  background: isMenuOpen ? '#F1F5F9' : '#F8FAFC',
                  color: isMenuOpen ? '#0F172A' : '#64748B',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.15s ease'
                }}
              >
                <MoreVertical size={16} />
              </button>

              {isMenuOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 4px)',
                    right: 0,
                    background: '#FFFFFF',
                    borderRadius: '10px',
                    border: '1px solid #E2E8F0',
                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.12), 0 8px 10px -6px rgba(0, 0, 0, 0.08)',
                    minWidth: '150px',
                    zIndex: 100,
                    padding: '5px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px',
                    animation: 'fadeIn 0.12s ease-out'
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsMenuOpen(false);
                      onEdit(table);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      border: 'none',
                      background: 'transparent',
                      color: '#334155',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'background 0.12s ease'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#F8FAFC'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <Edit2 size={14} color="#64748B" />
                    <span>Edit Table</span>
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsMenuOpen(false);
                      onViewQR(table);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      border: 'none',
                      background: 'transparent',
                      color: '#334155',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'background 0.12s ease'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#F8FAFC'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <QrCode size={14} color="#64748B" />
                    <span>View QR Code</span>
                  </button>

                  <div style={{ height: '1px', background: '#F1F5F9', margin: '3px 0' }} />

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsMenuOpen(false);
                      onDelete(table);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      border: 'none',
                      background: 'transparent',
                      color: '#DC2626',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'background 0.12s ease'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#FEF2F2'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <Trash2 size={14} color="#DC2626" />
                    <span>Delete Table</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      )}

      <TableVisualDiagram
        capacity={capacity}
        seatedGuests={seatedGuests}
        isOccupied={isOccupied}
        tableNumber={table.table_number}
        primaryColor={primaryColor}
        compact={Boolean(joinedCardPosition || hideHeader)}
        onTakeOrder={!isMergeSelectionMode && onTakeOrder && !isSecondaryMerged ? () => onTakeOrder(table) : undefined}
      />

      {/* Plain Text Capacity & Free Seats Display */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: joinedCardPosition ? '11.5px' : '13px',
          padding: joinedCardPosition ? '0 2px' : '2px 4px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: joinedCardPosition ? '4px' : '6px', color: '#475569' }}>
          <Users size={joinedCardPosition ? 13 : 15} color={primaryColor} />
          <span>
            Capacity: <strong>{capacity}</strong>
          </span>
        </div>

        <span style={{ fontSize: joinedCardPosition ? '11.5px' : '13px', fontWeight: 700, color: remainingSeats > 0 ? (isOccupied ? '#EA580C' : '#16A34A') : '#DC2626' }}>
          {remainingSeats > 0 ? `${remainingSeats} Seats Free` : 'Full'}
        </span>
      </div>

      {!hideActiveOrders && (isOccupied ? (
        <div
          onClick={(e) => {
            if (isMergeSelectionMode) {
              e.stopPropagation();
              if (!isMergeSource) {
                onSelectForMerge ? onSelectForMerge(table) : onSelect?.(table);
              }
            } else {
              onSelect?.(table, activeOrders[0]);
            }
          }}
          style={{
            background: '#FFFBEB',
            padding: '10px 12px',
            borderRadius: '8px',
            border: '1px solid #FEF08A',
            cursor: isMergeSelectionMode ? (!isMergeSource ? 'pointer' : 'default') : onSelect ? 'pointer' : 'default',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => {
            if (!isMergeSelectionMode && onSelect) {
              e.currentTarget.style.borderColor = '#F59E0B';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(245, 158, 11, 0.15)';
            }
          }}
          onMouseLeave={(e) => {
            if (!isMergeSelectionMode && onSelect) {
              e.currentTarget.style.borderColor = '#FEF08A';
              e.currentTarget.style.boxShadow = 'none';
            }
          }}
          title={isMergeSelectionMode ? (isMergeSource ? 'First table selected' : 'Click to merge with this table') : 'Click to view table order details'}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, color: '#854D0E', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <ShoppingBag size={13} /> Active Orders ({activeOrders.length})
            </span>
            <span style={{ fontSize: '13px', fontWeight: 900, color: '#A16207' }}>
              {formatPrice(combinedTotal)}
            </span>
          </div>

          {activeOrders.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
              {activeOrders.map((o: any, idx: number) => {
                const ticketNum = String(o.ticket_number || '').padStart(3, '0');
                const status = o.status || 'PENDING';
                return (
                  <button
                    key={o.id || idx}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isMergeSelectionMode) {
                        if (!isMergeSource) {
                          onSelectForMerge ? onSelectForMerge(table) : onSelect?.(table);
                        }
                      } else {
                        onSelect?.(table, o);
                      }
                    }}
                    style={{
                      background: '#FFFFFF',
                      border: '1px solid #FEF08A',
                      borderRadius: '8px',
                      padding: '4px 8px',
                      fontSize: '11px',
                      fontWeight: 700,
                      color: '#854D0E',
                      display: 'inline-flex',
                      alignItems: 'center',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                      cursor: isMergeSelectionMode && isMergeSource ? 'default' : 'pointer',
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
                    title={isMergeSelectionMode ? 'Click to merge with this table' : `Click to view Order #${ticketNum}`}
                  >
                    #{ticketNum} ({status})
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ) : isMergeSelectionMode ? (
        isMergeSource ? (
          <div
            style={{
              background: `${primaryColor}10`,
              padding: '9px 12px',
              borderRadius: '8px',
              border: `1px solid ${primaryColor}40`,
              color: primaryColor,
              fontSize: '11.5px',
              fontWeight: 700,
              textAlign: 'center',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}
          >
            <Merge size={13} color={primaryColor} />
            <span>Table #{table.table_number} (Selected)</span>
          </div>
        ) : isMergeTarget ? (
          <div
            onClick={(e) => {
              e.stopPropagation();
              onSelectForMerge ? onSelectForMerge(table) : onSelect?.(table);
            }}
            style={{
              background: `${primaryColor}15`,
              padding: '9px 12px',
              borderRadius: '8px',
              border: `1.5px solid ${primaryColor}`,
              color: primaryColor,
              fontSize: '11.5px',
              fontWeight: 700,
              textAlign: 'center',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}
            title="Selected to merge"
          >
            <Check size={13} color={primaryColor} />
            <span>Selected to merge</span>
          </div>
        ) : (
          <div
            onClick={(e) => {
              e.stopPropagation();
              onSelectForMerge ? onSelectForMerge(table) : onSelect?.(table);
            }}
            style={{
              background: '#F8FAFC',
              padding: '9px 12px',
              borderRadius: '8px',
              border: '1px dashed #CBD5E1',
              color: '#64748B',
              fontSize: '11.5px',
              fontWeight: 600,
              textAlign: 'center',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = primaryColor;
              e.currentTarget.style.color = primaryColor;
              e.currentTarget.style.background = '#FFFFFF';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#CBD5E1';
              e.currentTarget.style.color = '#64748B';
              e.currentTarget.style.background = '#F8FAFC';
            }}
            title={`Select Table #${table.table_number} to merge`}
          >
            <Merge size={13} />
            <span>Click to merge with this table</span>
          </div>
        )
      ) : (
        <div
          onClick={() => onTakeOrder?.(table)}
          style={{
            background: '#F8FAFC',
            padding: '10px 12px',
            borderRadius: '8px',
            border: '1px dashed #CBD5E1',
            color: '#64748B',
            fontSize: '12px',
            textAlign: 'center',
            cursor: onTakeOrder ? 'pointer' : 'default',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => {
            if (onTakeOrder) {
              e.currentTarget.style.borderColor = primaryColor;
              e.currentTarget.style.color = primaryColor;
              e.currentTarget.style.background = '#FFFFFF';
            }
          }}
          onMouseLeave={(e) => {
            if (onTakeOrder) {
              e.currentTarget.style.borderColor = '#CBD5E1';
              e.currentTarget.style.color = '#64748B';
              e.currentTarget.style.background = '#F8FAFC';
            }
          }}
          title={`Click to take order for Table #${table.table_number}`}
        >
          <Utensils size={13} color={primaryColor} />
          <span>Available • Click to take order</span>
        </div>
      ))}
    </div>
  );
}
