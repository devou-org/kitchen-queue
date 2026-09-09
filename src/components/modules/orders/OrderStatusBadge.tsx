import React from 'react';

interface OrderStatusBadgeProps {
  status?: string;
  className?: string;
}

export function getOrderStatusConfig(status?: string) {
  const normalized = (status || '').toUpperCase();
  switch (normalized) {
    case 'PENDING':
      return {
        bg: '#fffbeb',
        color: '#b45309',
        border: '#fde68a',
        dot: '#f59e0b',
        label: 'Pending',
      };
    case 'PREPARING':
      return {
        bg: '#eff6ff',
        color: '#1d4ed8',
        border: '#bfdbfe',
        dot: '#3b82f6',
        label: 'Preparing',
      };
    case 'READY':
      return {
        bg: '#f0fdf4',
        color: '#15803d',
        border: '#bbf7d0',
        dot: '#22c55e',
        label: 'Ready',
      };
    case 'SERVED':
    case 'COMPLETED':
      return {
        bg: '#f8fafc',
        color: '#475569',
        border: '#e2e8f0',
        dot: '#94a3b8',
        label: normalized === 'SERVED' ? 'Served' : 'Completed',
      };
    case 'CANCELLED':
      return {
        bg: '#fef2f2',
        color: '#b91c1c',
        border: '#fecaca',
        dot: '#ef4444',
        label: 'Cancelled',
      };
    default:
      return {
        bg: '#f8fafc',
        color: '#64748b',
        border: '#e2e8f0',
        dot: '#94a3b8',
        label: status || 'Unknown',
      };
  }
}

export default function OrderStatusBadge({ status, className = '' }: OrderStatusBadgeProps) {
  const config = getOrderStatusConfig(status);

  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '4px 10px',
        borderRadius: '8px',
        fontSize: '12px',
        fontWeight: 700,
        letterSpacing: '0.02em',
        textTransform: 'uppercase',
        backgroundColor: config.bg,
        color: config.color,
        border: `1px solid ${config.border}`,
        whiteSpace: 'nowrap',
        lineHeight: 1.3,
      }}
    >
      <span
        style={{
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          backgroundColor: config.dot,
          flexShrink: 0,
        }}
      />
      {config.label}
    </span>
  );
}

