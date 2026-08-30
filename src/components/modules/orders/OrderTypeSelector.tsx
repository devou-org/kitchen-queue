import React from 'react';
import { Utensils, ShoppingBag /* , Truck */ } from 'lucide-react';
import { OrderType } from '@/types';

interface OrderTypeSelectorProps {
  value: OrderType | string;
  onChange: (value: OrderType) => void;
  disabled?: boolean;
  allowDelivery?: boolean;
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
}: OrderTypeSelectorProps) {
  const typesToRender = allowDelivery ? ORDER_TYPES : ORDER_TYPES.filter(t => t.id !== 'DELIVERY');

  return (
    <div className="card" style={{ marginBottom: '16px', padding: '16px' }}>
      <label
        style={{
          display: 'block',
          fontSize: '12px',
          fontWeight: 800,
          color: 'var(--text-secondary)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginBottom: '12px',
        }}
      >
        Select Order Type *
      </label>

      {/* Segmented Control Container */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${typesToRender.length}, 1fr)`,
          gap: '8px',
          background: 'rgba(0, 0, 0, 0.04)',
          padding: '4px',
          borderRadius: '14px',
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
                padding: '12px 8px',
                borderRadius: '10px',
                border: 'none',
                background: isSelected ? 'white' : 'transparent',
                color: isSelected ? 'var(--primary)' : 'var(--text-secondary)',
                fontWeight: isSelected ? 800 : 600,
                fontSize: '13px',
                cursor: disabled ? 'not-allowed' : 'pointer',
                boxShadow: isSelected ? '0 2px 8px rgba(0,0,0,0.08)' : 'none',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                opacity: disabled ? 0.6 : 1,
              }}
            >
              <Icon
                size={20}
                style={{
                  marginBottom: '4px',
                  color: isSelected ? 'var(--primary)' : 'var(--text-secondary)',
                  transition: 'transform 0.2s ease',
                  transform: isSelected ? 'scale(1.1)' : 'scale(1)',
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
