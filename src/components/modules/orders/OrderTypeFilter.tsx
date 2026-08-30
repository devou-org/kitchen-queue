import React, { useState, useRef, useEffect } from 'react';
import { Utensils, ShoppingBag, Filter, ChevronDown, Check } from 'lucide-react';
import { OrderType } from '@/types';

interface OrderTypeFilterProps {
  value: string;
  onChange: (val: string) => void;
  style?: React.CSSProperties;
  className?: string;
  disabled?: boolean;
}

const OPTIONS = [
  { value: '', label: 'All Order Types', icon: Filter },
  { value: 'DINE_IN', label: 'Dine-in', icon: Utensils },
  { value: 'TAKEAWAY', label: 'Takeaway', icon: ShoppingBag },
  /* { value: 'DELIVERY', label: 'Delivery', icon: Truck }, */
];

export default function OrderTypeFilter({
  value,
  onChange,
  style,
  disabled = false,
}: OrderTypeFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = OPTIONS.find(opt => opt.value === value) || OPTIONS[0];
  const SelectedIcon = selectedOption.icon;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', ...style }}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '100%',
          height: '42px',
          padding: '0 12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'white',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm, 8px)',
          fontWeight: 600,
          fontSize: '14px',
          color: 'var(--text-primary)',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.6 : 1,
          transition: 'all 0.2s ease',
          boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <SelectedIcon size={16} style={{ color: 'var(--primary)' }} />
          <span>{selectedOption.label}</span>
        </div>
        <ChevronDown
          size={16}
          style={{
            color: 'var(--text-secondary)',
            transition: 'transform 0.2s ease',
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        />
      </button>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            zIndex: 100,
            background: 'white',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm, 8px)',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05)',
            overflow: 'hidden',
            padding: '4px',
          }}
        >
          {OPTIONS.map((option) => {
            const Icon = option.icon;
            const isSelected = option.value === value;

            return (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  background: isSelected ? 'rgba(0, 0, 0, 0.04)' : 'transparent',
                  color: isSelected ? 'var(--primary)' : 'var(--text-primary)',
                  fontWeight: isSelected ? 700 : 500,
                  fontSize: '13.5px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) e.currentTarget.style.background = 'rgba(0, 0, 0, 0.02)';
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) e.currentTarget.style.background = 'transparent';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Icon
                    size={16}
                    style={{
                      color: isSelected ? 'var(--primary)' : 'var(--text-secondary)',
                    }}
                  />
                  <span>{option.label}</span>
                </div>
                {isSelected && <Check size={14} style={{ color: 'var(--primary)' }} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
