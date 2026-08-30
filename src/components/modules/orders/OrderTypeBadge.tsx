import React from 'react';
import { Utensils, ShoppingBag, Truck } from 'lucide-react';
import { OrderType } from '@/types';

interface OrderTypeBadgeProps {
  type?: OrderType | string;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  className?: string;
}

export function getOrderTypeConfig(type?: string) {
  const normalized = (type || 'DINE_IN').toUpperCase();
  switch (normalized) {
    case 'TAKEAWAY':
      return {
        label: 'Takeaway',
        shortLabel: 'Takeaway',
        icon: ShoppingBag,
        color: '#d97706',
        bg: '#fffbe6',
        borderColor: '#fde68a',
      };
    case 'DELIVERY':
      return {
        label: 'Delivery',
        shortLabel: 'Delivery',
        icon: Truck,
        color: '#7e22ce',
        bg: '#faf5ff',
        borderColor: '#e9d5ff',
      };
    case 'DINE_IN':
    default:
      return {
        label: 'Dine-in',
        shortLabel: 'Dine-in',
        icon: Utensils,
        color: '#2563eb',
        bg: '#eff6ff',
        borderColor: '#bfdbfe',
      };
  }
}

export default function OrderTypeBadge({
  type = 'DINE_IN',
  size = 'sm',
  showIcon = true,
  className = '',
}: OrderTypeBadgeProps) {
  const config = getOrderTypeConfig(type);
  const Icon = config.icon;

  const sizeStyles = {
    sm: {
      padding: '3px 8px',
      fontSize: '11px',
      iconSize: 12,
      gap: '4px',
      borderRadius: '6px',
    },
    md: {
      padding: '4px 10px',
      fontSize: '12px',
      iconSize: 14,
      gap: '5px',
      borderRadius: '8px',
    },
    lg: {
      padding: '6px 14px',
      fontSize: '13px',
      iconSize: 16,
      gap: '6px',
      borderRadius: '10px',
    },
  }[size];

  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: sizeStyles.gap,
        padding: sizeStyles.padding,
        fontSize: sizeStyles.fontSize,
        fontWeight: 700,
        color: config.color,
        backgroundColor: config.bg,
        border: `1px solid ${config.borderColor}`,
        borderRadius: sizeStyles.borderRadius,
        whiteSpace: 'nowrap',
        letterSpacing: '0.01em',
        lineHeight: 1.2,
      }}
    >
      {showIcon && <Icon size={sizeStyles.iconSize} style={{ flexShrink: 0 }} />}
      {config.label}
    </span>
  );
}
