import React, { useState, useRef, useEffect } from 'react';
import { Users, QrCode, Trash2, ShoppingBag, Edit2, Utensils, Link2, Unlink, MoreVertical } from 'lucide-react';
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
  isMergeSelectionMode?: boolean;
  onSelectForMerge?: (table: RestaurantTable) => void;
  primaryColor?: string;
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
  const tableH = compact ? '48px' : '62px';
  const tableMinW = compact ? (topCount > 2 ? `${topCount * 26}px` : '64px') : (topCount > 2 ? `${topCount * 36}px` : '96px');
  const btnSize = compact ? '28px' : '36px';
  const iconSize = compact ? 13 : 17;

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
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: compact ? '8px 0 6px' : '16px 0 12px' }}>
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
  isMergeSelectionMode = false,
  onSelectForMerge,
  primaryColor = '#059669',
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

  const isOccupied = table.status === 'OCCUPIED';
  const activeOrders = table.active_orders || [];

  const isPrimaryMerged = Boolean(table.merged_table_numbers && table.merged_table_numbers.length > 0);
  const isSecondaryMerged = Boolean(table.merged_into_table_id);

  const capacity = Number(table.capacity) || 0;
  const effectiveCapacity = Number(table.effective_capacity) || capacity;
  const seatedGuests = activeOrders.reduce((sum: number, o: any) => sum + (Number(o.party_size) || 1), 0);
  const remainingSeats = isOccupied ? Math.max(0, effectiveCapacity - seatedGuests) : effectiveCapacity;

  const combinedTotal = activeOrders.reduce((sum, o) => sum + Number(o.total_price || 0), 0);

  // Formatted combined title: Table #A1+A2 or Table #T-05+T3
  const mergedTitle = isPrimaryMerged
    ? `Table #${table.table_number}+${table.merged_table_numbers?.join('+')}`
    : `Table #${table.table_number}`;

  // Children tables for visual rendering
  const childrenTables = table.merged_children && table.merged_children.length > 0
    ? table.merged_children
    : (table.merged_table_numbers || []).map((num, i) => ({
        id: (table.merged_table_ids && table.merged_table_ids[i]) || `child-${i}`,
        table_number: num,
        capacity: 4
      }));

  const handleCardClick = () => {
    if (isMergeSelectionMode && onSelectForMerge && !isMergeSource) {
      onSelectForMerge(table);
    }
  };

  return (
    <div
      onClick={handleCardClick}
      style={{
        background: isMergeSource ? '#F0FDF4' : '#FFFFFF',
        borderRadius: '12px',
        border: isMergeSource
          ? `2px solid ${primaryColor}`
          : isMergeSelectionMode
          ? '2px dashed #0284C7'
          : isPrimaryMerged
          ? `1.5px solid ${primaryColor}50`
          : '1px solid #E2E8F0',
        boxShadow: isMergeSource
          ? `0 0 0 4px ${primaryColor}20, 0 8px 20px rgba(0, 0, 0, 0.08)`
          : isPrimaryMerged
          ? `0 4px 14px ${primaryColor}12`
          : '0 2px 8px rgba(0, 0, 0, 0.04)',
        padding: '16px 18px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        position: 'relative',
        overflow: 'visible',
        zIndex: isMenuOpen ? 40 : 1,
        cursor: isMergeSelectionMode && !isMergeSource ? 'pointer' : 'default',
        transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        transform: isMergeSource ? 'scale(1.01)' : 'none',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
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
            title={mergedTitle}
          >
            {mergedTitle}
          </h3>

          {/* Small Merged badge */}
          {isPrimaryMerged && (
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
            >
              <Link2 size={11} /> Merged
            </span>
          )}
        </div>

        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          {/* Quick Unmerge Button for Merged Tables */}
          {(isPrimaryMerged || isSecondaryMerged) && onUnmerge && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onUnmerge(table);
              }}
              title={isPrimaryMerged ? "Unmerge all joined tables" : `Detach from Table #${table.parent_table_number}`}
              style={{
                padding: '6px',
                borderRadius: '8px',
                border: '1px solid #FEE2E2',
                background: '#FEF2F2',
                color: '#DC2626',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Unlink size={16} />
            </button>
          )}

          {/* Quick Merge Button for Standalone Tables */}
          {!isSecondaryMerged && onMerge && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onMerge(table);
              }}
              title={isPrimaryMerged ? "Manage merged tables" : "Merge with another table"}
              style={{
                padding: '6px',
                borderRadius: '8px',
                border: `1px solid ${isPrimaryMerged ? primaryColor : '#E2E8F0'}`,
                background: isPrimaryMerged ? `${primaryColor}12` : '#F8FAFC',
                color: primaryColor,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Link2 size={16} />
            </button>
          )}

          {/* 3-Dots More Options Menu */}
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
        </div>
      </div>

      {/* Table Visual: Single Table Diagram OR Side-by-Side Diagram when Merged */}
      {isPrimaryMerged ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            background: '#F8FAFC',
            borderRadius: '10px',
            padding: '8px 10px',
            border: '1px solid #E2E8F0',
            position: 'relative'
          }}
        >
          {/* Lead Table */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <span style={{ fontSize: '10px', fontWeight: 800, color: '#64748B', marginBottom: '2px' }}>
              #{table.table_number} ({capacity}p)
            </span>
            <TableVisualDiagram
              capacity={capacity}
              seatedGuests={isOccupied ? Math.min(capacity, seatedGuests) : 0}
              isOccupied={isOccupied}
              tableNumber={table.table_number}
              primaryColor={primaryColor}
              compact={true}
              onTakeOrder={onTakeOrder && !isSecondaryMerged ? () => onTakeOrder(table) : undefined}
            />
          </div>

          {/* Merge Connector Icon */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: primaryColor,
              background: `${primaryColor}15`,
              borderRadius: '50%',
              width: '26px',
              height: '26px',
              flexShrink: 0,
            }}
            title="Merged tables"
          >
            <Link2 size={13} />
          </div>

          {/* Joined Child Tables */}
          {childrenTables.map((child: any) => (
            <div key={child.id || child.table_number} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span style={{ fontSize: '10px', fontWeight: 800, color: '#64748B', marginBottom: '2px' }}>
                #{child.table_number} ({child.capacity || 4}p)
              </span>
              <TableVisualDiagram
                capacity={Number(child.capacity) || 4}
                seatedGuests={isOccupied ? Math.max(0, seatedGuests - capacity) : 0}
                isOccupied={isOccupied}
                tableNumber={child.table_number}
                primaryColor={primaryColor}
                compact={true}
              />
            </div>
          ))}
        </div>
      ) : (
        <TableVisualDiagram
          capacity={effectiveCapacity}
          seatedGuests={seatedGuests}
          isOccupied={isOccupied}
          tableNumber={table.table_number}
          primaryColor={primaryColor}
          onTakeOrder={onTakeOrder && !isSecondaryMerged ? () => onTakeOrder(table) : undefined}
        />
      )}

      {/* Plain Text Capacity & Free Seats Display */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '13px',
          padding: '2px 4px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#475569' }}>
          <Users size={15} color={primaryColor} />
          <span>
            Capacity: <strong>{effectiveCapacity}</strong>
          </span>
        </div>

        <span style={{ fontSize: '13px', fontWeight: 700, color: remainingSeats > 0 ? (isOccupied ? '#EA580C' : '#16A34A') : '#DC2626' }}>
          {remainingSeats > 0 ? `${remainingSeats} Seats Free` : 'Full'}
        </span>
      </div>

      {isOccupied ? (
        <div
          onClick={() => onSelect?.(table, activeOrders[0])}
          style={{
            background: '#FFFBEB',
            padding: '10px 12px',
            borderRadius: '8px',
            border: '1px solid #FEF08A',
            cursor: onSelect ? 'pointer' : 'default',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => {
            if (onSelect) {
              e.currentTarget.style.borderColor = '#F59E0B';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(245, 158, 11, 0.15)';
            }
          }}
          onMouseLeave={(e) => {
            if (onSelect) {
              e.currentTarget.style.borderColor = '#FEF08A';
              e.currentTarget.style.boxShadow = 'none';
            }
          }}
          title="Click to view table order details"
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
                      onSelect?.(table, o);
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
          )}
        </div>
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
      )}
    </div>
  );
}
