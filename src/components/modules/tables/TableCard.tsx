import React from 'react';
import { Users, QrCode, Trash2, ShoppingBag, CheckCircle, Clock } from 'lucide-react';
import { RestaurantTable } from '@/modules/tables/tables.repository';
import { TableTimeline } from './TableTimeline';
import { formatPrice } from '@/lib/format';

interface TableCardProps {
  table: RestaurantTable;
  onViewQR: (table: RestaurantTable) => void;
  onDelete: (tableId: string, tableNumber: string) => void;
  primaryColor?: string;
}

export function TableCard({ table, onViewQR, onDelete, primaryColor = '#059669' }: TableCardProps) {
  const isOccupied = table.status === 'OCCUPIED';
  const activeOrders = table.active_orders || [];

  // Get combined total for active table orders
  const combinedTotal = activeOrders.reduce((sum, o) => sum + Number(o.total_price || 0), 0);

  // Latest active order for timeline
  const latestOrder = activeOrders[0];

  return (
    <div
      style={{
        background: '#FFFFFF',
        borderRadius: '16px',
        border: 'none',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
        padding: '18px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        transition: 'all 0.2s ease-in-out',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      {/* Top Accent Line */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: '4px',
        background: isOccupied ? '#EAB308' : primaryColor
      }} />

      {/* Card Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h3 style={{ fontSize: '20px', fontWeight: 900, color: '#0F172A', margin: 0 }}>
              Table #{table.table_number}
            </h3>
            <span
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
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748B', fontSize: '12px', marginTop: '4px' }}>
            <Users size={14} />
            <span>Capacity: <strong>{table.capacity} Persons</strong></span>
          </div>
        </div>

        {/* Actions */}
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
            onClick={() => onDelete(table.id, table.table_number)}
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

      {/* Active Orders Summary */}
      {isOccupied ? (
        <div style={{ background: '#FFFBEB', padding: '10px 12px', borderRadius: '10px', border: '1px solid #FEF08A' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, color: '#854D0E', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <ShoppingBag size={13} /> Active Orders ({activeOrders.length})
            </span>
            <span style={{ fontSize: '13px', fontWeight: 900, color: '#A16207' }}>
              {formatPrice(combinedTotal)}
            </span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
            {activeOrders.map((ord: any) => (
              <span
                key={ord.id}
                style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  background: '#FFFFFF',
                  color: '#713F12',
                  border: '1px solid #FDE68A',
                  padding: '2px 8px',
                  borderRadius: '6px'
                }}
              >
                #{String(ord.ticket_number).padStart(3, '0')} ({ord.status})
              </span>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ background: '#F8FAFC', padding: '8px 12px', borderRadius: '10px', border: '1px solid #F1F5F9', color: '#94A3B8', fontSize: '12px', textAlign: 'center' }}>
          No active orders. Ready for guests.
        </div>
      )}

      {/* Timestamps Timeline for latest active order (commented out for now) */}
      {/* {latestOrder && (
        <TableTimeline
          pendingAt={latestOrder.pending_at}
          preparingAt={latestOrder.preparing_at}
          readyAt={latestOrder.ready_at}
          paidAt={latestOrder.paid_at}
          status={latestOrder.status}
        />
      )} */}
    </div>
  );
}
