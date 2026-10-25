'use client';
import React from 'react';
import { Order } from '@/types';
import { formatPrice, formatDateTime } from '@/lib/format';
import { Users } from 'lucide-react';
import OrderTypeBadge from './OrderTypeBadge';
import OrderStatusBadge from './OrderStatusBadge';

export function OrderTableHeader() {
  return (
    <thead>
      <tr style={{ borderBottom: '1px solid var(--border)', background: '#F8FAFC' }}>
        <th style={{ padding: '14px 20px', fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>Customer</th>
        <th style={{ padding: '14px 20px', fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>Ticket</th>
        <th style={{ padding: '14px 20px', fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>Order Type</th>
        <th style={{ padding: '14px 20px', fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>Table</th>
        <th style={{ padding: '14px 20px', fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>Persons</th>
        <th style={{ padding: '14px 20px', fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>Status</th>
        <th style={{ padding: '14px 20px', fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>Subtotal</th>
      </tr>
    </thead>
  );
}

interface OrderTableRowProps {
  order: Order;
  onClick?: () => void;
  showCustomerPhone?: boolean;
  isSelected?: boolean;
}

export function OrderTableRow({ order, onClick, showCustomerPhone = false, isSelected = false }: OrderTableRowProps) {
  return (
    <tr
      onClick={onClick}
      style={{
        cursor: onClick ? 'pointer' : 'default',
        borderBottom: '1px solid #F1F5F9',
        backgroundColor: isSelected ? '#EFF6FF' : 'transparent',
        boxShadow: isSelected ? 'inset 3px 0 0 var(--primary)' : 'none',
        transition: 'background-color 0.15s ease',
      }}
      onMouseEnter={(e) => {
        if (!isSelected) e.currentTarget.style.backgroundColor = '#F8FAFC';
      }}
      onMouseLeave={(e) => {
        if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
      }}
    >
      {/* 1. Customer */}
      <td style={{ padding: '18px 20px', verticalAlign: 'middle' }}>
        <div style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A', whiteSpace: 'nowrap' }}>
          {order.customer_name || 'Guest'}
        </div>
        {showCustomerPhone && order.phone && (
          <div style={{ fontSize: '13px', color: '#64748B', marginTop: '3px', whiteSpace: 'nowrap' }}>
            {order.phone}
          </div>
        )}
      </td>

      {/* 2. Ticket */}
      <td style={{ padding: '18px 20px', verticalAlign: 'middle' }}>
        <div style={{ fontSize: '15px', fontWeight: 800, color: '#0F172A', letterSpacing: '-0.01em', fontFamily: 'monospace, var(--font-mono)' }}>
          #{String(order.ticket_number).padStart(3, '0')}
        </div>
        <div style={{ fontSize: '12px', color: '#64748B', marginTop: '3px', whiteSpace: 'nowrap' }}>
          {formatDateTime(order.created_at)}
          {order.staff_name && <span style={{ color: '#94A3B8' }}> · {order.staff_name.split(' ')[0]}</span>}
        </div>
      </td>

      {/* 3. Order Type */}
      <td style={{ padding: '18px 20px', verticalAlign: 'middle' }}>
        <OrderTypeBadge type={order.order_type} variant="minimal" />
      </td>

      {/* 4. Table */}
      <td style={{ padding: '18px 20px', verticalAlign: 'middle' }}>
        {order.table_number ? (
          <span style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A', whiteSpace: 'nowrap' }}>
            {order.table_number.toLowerCase().startsWith('table') ? order.table_number : `Table ${order.table_number}`}
          </span>
        ) : (
          <span style={{ color: '#94A3B8', fontSize: '15px', fontWeight: 700 }}>—</span>
        )}
      </td>

      {/* 5. Persons */}
      <td style={{ padding: '18px 20px', verticalAlign: 'middle' }}>
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '15px',
          fontWeight: 700,
          color: '#0F172A',
          whiteSpace: 'nowrap',
        }}>
          <Users size={16} style={{ color: '#0F172A', flexShrink: 0 }} />
          {order.party_size || 1}
        </span>
      </td>

      {/* 6. Status */}
      <td style={{ padding: '18px 20px', verticalAlign: 'middle' }}>
        <OrderStatusBadge status={order.status} />
      </td>

      {/* 7. Subtotal */}
      <td style={{ padding: '18px 20px', verticalAlign: 'middle' }}>
        <span style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
          {formatPrice(order.total_price)}
        </span>
      </td>
    </tr>
  );
}

export default OrderTableRow;

