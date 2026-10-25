import React from 'react';
import { Utensils, ShoppingBag, UtensilsCrossed /* , Truck */ } from 'lucide-react';
import { OrderType } from '@/types';

interface OrderTypeSelectorProps {
  value: OrderType | string;
  onChange: (value: OrderType) => void;
  disabled?: boolean;
  allowDelivery?: boolean;
  hideLabel?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

const ORDER_TYPES: { id: OrderType; label: string; icon: React.ElementType; description: string }[] = [
  {
    id: 'DINE_IN',
    label: 'Dine-in',
    icon: Utensils,
    description: 'Eating at restaurant table',
  },
  {
    id: 'TAKEAWAY',
    label: 'Takeaway',
    icon: ShoppingBag,
    description: 'Pick up and carry out',
  },
  /* {
    id: 'DELIVERY',
    label: 'Delivery',
    icon: Truck,
    description: 'Delivered to your location',
  }, */
];

export default function OrderTypeSelector({
  value,
  onChange,
  disabled = false,
  allowDelivery = true,
  hideLabel = false,
  className = '',
  style = {},
}: OrderTypeSelectorProps) {
  const typesToRender = allowDelivery ? ORDER_TYPES : ORDER_TYPES.filter(t => t.id !== 'DELIVERY');

  return (
    <div
      className={className}
      style={{
        background: '#FFFFFF',
        border: '1px solid #E2E8F0',
        borderRadius: '8px',
        padding: '10px 12px',
        marginBottom: 0,
        ...style,
      }}
    >
      {!hideLabel && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '11px',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: '#64748B',
            marginBottom: '8px',
          }}
        >
          <UtensilsCrossed size={13} />
          <span>Order Type</span>
        </div>
      )}

      {/* Segmented Control Container */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${typesToRender.length}, 1fr)`,
          gap: '8px',
          background: 'rgba(0, 0, 0, 0.04)',
          padding: '4px',
          borderRadius: '8px',
        }}
      >
        {typesToRender.map((t) => {
          const isSelected = value === t.id;
          const Icon = t.icon;

          return (
            <button
              key={t.id}
              type="button"
              disabled={disabled}
              onClick={() => onChange(t.id)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '7px 8px',
                borderRadius: '6px',
                border: 'none',
                background: isSelected ? 'white' : 'transparent',
                color: isSelected ? 'var(--primary)' : 'var(--text-secondary)',
                fontWeight: isSelected ? 800 : 600,
                fontSize: '12.5px',
                cursor: disabled ? 'not-allowed' : 'pointer',
                boxShadow: isSelected ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
                opacity: disabled ? 0.6 : 1,
              }}
            >
              <Icon
                size={16}
                style={{
                  marginBottom: '2px',
                  color: isSelected ? 'var(--primary)' : 'var(--text-secondary)',
                  transition: 'transform 0.15s ease',
                  transform: isSelected ? 'scale(1.05)' : 'scale(1)',
                }}
              />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
