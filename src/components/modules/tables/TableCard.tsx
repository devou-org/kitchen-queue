import React from 'react';
import { Users, QrCode, Trash2, ShoppingBag } from 'lucide-react';
import { RestaurantTable } from '@/modules/tables/tables.repository';
import { formatPrice } from '@/lib/format';

interface TableCardProps {
  table: RestaurantTable;
  onViewQR: (table: RestaurantTable) => void;
  onDelete: (table: RestaurantTable) => void;
  primaryColor?: string;
}

function TableVisualDiagram({
  capacity,
  seatedGuests,
  isOccupied,
  tableNumber,
  primaryColor
}: {
  capacity: number;
  seatedGuests: number;
  isOccupied: boolean;
  tableNumber: string;
  primaryColor: string;
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

  const getChairStyle = (occupied: boolean, isVertical: boolean) => ({
    width: isVertical ? '7px' : '26px',
    height: isVertical ? '26px' : '7px',
    borderRadius: '8px',
    background: occupied
      ? '#EAB308'
      : (isOccupied ? '#E2E8F0' : `${primaryColor}35`),
    border: occupied ? '1px solid #CA8A04' : 'none',
    boxShadow: occupied ? '0 1px 3px rgba(234, 179, 8, 0.3)' : 'none',
    transition: 'all 0.2s ease',
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '16px 0 12px' }}>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '5px', height: '8px', alignItems: 'center' }}>
        {topChairs.map((occ, idx) => (
          <div key={`top-${idx}`} style={getChairStyle(occ, false)} title={occ ? 'Occupied Seat' : 'Free Seat'} />
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '8px', alignItems: 'center' }}>
          {leftChairs.map((occ, idx) => (
            <div key={`left-${idx}`} style={getChairStyle(occ, true)} title={occ ? 'Occupied Seat' : 'Free Seat'} />
          ))}
        </div>

        <div
          style={{
            minWidth: topCount > 2 ? `${topCount * 36}px` : '96px',
            height: '62px',
            borderRadius: '16px',
            background: isOccupied ? '#FEF9C3' : '#F8FAFC',
            border: `2px solid ${isOccupied ? '#FDE68A' : `${primaryColor}25`}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 16px',
            position: 'relative',
            boxShadow: isOccupied
              ? '0 4px 12px rgba(234, 179, 8, 0.12)'
              : '0 2px 6px rgba(0, 0, 0, 0.03)',
            transition: 'all 0.2s ease'
          }}
        >
          <div style={{ textAlign: 'center' }}>
            <span style={{ fontSize: '16px', fontWeight: 900, color: isOccupied ? '#854D0E' : '#0F172A', letterSpacing: '-0.01em' }}>
              {tableNumber}
            </span>
          </div>

          <div
            style={{
              position: 'absolute',
              top: '6px',
              right: '6px',
              width: '16px',
              height: '16px',
              borderRadius: '50%',
              background: isOccupied ? '#EAB308' : primaryColor,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontSize: '9px',
              fontWeight: 900,
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}
          >
            ✓
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '8px', alignItems: 'center' }}>
          {rightChairs.map((occ, idx) => (
            <div key={`right-${idx}`} style={getChairStyle(occ, true)} title={occ ? 'Occupied Seat' : 'Free Seat'} />
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginTop: '5px', height: '8px', alignItems: 'center' }}>
        {bottomChairs.map((occ, idx) => (
          <div key={`bottom-${idx}`} style={getChairStyle(occ, false)} title={occ ? 'Occupied Seat' : 'Free Seat'} />
        ))}
      </div>
    </div>
  );
}

export function TableCard({ table, onViewQR, onDelete, primaryColor = '#059669' }: TableCardProps) {
  const isOccupied = table.status === 'OCCUPIED';
  const activeOrders = table.active_orders || [];

  const capacity = Number(table.capacity) || 0;
  const seatedGuests = activeOrders.reduce((sum: number, o: any) => sum + (Number(o.party_size) || 1), 0);
  const remainingSeats = isOccupied ? Math.max(0, capacity - seatedGuests) : capacity;

  const combinedTotal = activeOrders.reduce((sum, o) => sum + Number(o.total_price || 0), 0);

  return (
    <div
      style={{
        background: '#FFFFFF',
        borderRadius: '18px',
        border: '1px solid #F1F5F9',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
        padding: '18px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        transition: 'all 0.2s ease-in-out',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 900, color: '#0F172A', margin: 0 }}>
            Table #{table.table_number}
          </h3>
          {/* <span
            style={{
              fontSize: '11px',
              fontWeight: 800,
              padding: '3px 10px',
              borderRadius: '20px',
              background: isOccupied ? '#FEF9C3' : `${primaryColor}15`,
              color: isOccupied ? '#A16207' : primaryColor,
              border: `1px solid ${isOccupied ? '#FEF08A' : `${primaryColor}40`}`,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: isOccupied ? '#EAB308' : primaryColor }} />
            {isOccupied ? 'OCCUPIED' : 'AVAILABLE'}
          </span> */}
        </div>

        <div style={{ display: 'flex', gap: '4px' }}>
          <button
            onClick={() => onViewQR(table)}
            title="View & Print Table QR Code"
            style={{
              padding: '6px',
              borderRadius: '8px',
              border: '1px solid #E2E8F0',
              background: '#F8FAFC',
              color: '#334155',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <QrCode size={16} color={primaryColor} />
          </button>
          <button
            onClick={() => onDelete(table)}
            title="Delete Table"
            style={{
              padding: '6px',
              borderRadius: '8px',
              border: '1px solid #FEE2E2',
              background: '#FEF2F2',
              color: '#EF4444',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      <TableVisualDiagram
        capacity={capacity}
        seatedGuests={seatedGuests}
        isOccupied={isOccupied}
        tableNumber={table.table_number}
        primaryColor={primaryColor}
      />

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
          <span>Capacity: <strong>{capacity}</strong></span>
        </div>

        <span style={{ fontSize: '13px', fontWeight: 700, color: remainingSeats > 0 ? (isOccupied ? '#EA580C' : '#16A34A') : '#DC2626' }}>
          {remainingSeats > 0 ? `${remainingSeats} Seats Free` : 'Full'}
        </span>
      </div>

      {isOccupied ? (
        <div style={{ background: '#FFFBEB', padding: '10px 12px', borderRadius: '10px', border: '1px solid #FEF08A' }}>
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
                  <div
                    key={o.id || idx}
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
                      boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
                    }}
                  >
                    #{ticketNum} ({status})
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div style={{ background: '#F8FAFC', padding: '8px 12px', borderRadius: '10px', border: '1px solid #F1F5F9', color: '#94A3B8', fontSize: '12px', textAlign: 'center' }}>
          No active orders. Ready for guests.
        </div>
      )}
    </div>
  );
}
