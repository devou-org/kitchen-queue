'use client';
import React from 'react';

export type DietaryPreferenceFilter = 'ALL' | 'VEG' | 'NON_VEG';

interface DietaryFilterProps {
  value: DietaryPreferenceFilter;
  onChange: (val: DietaryPreferenceFilter) => void;
  className?: string;
  style?: React.CSSProperties;
}

export function DietaryFilter({ value, onChange, className = '', style = {} }: DietaryFilterProps) {
  const options: { id: DietaryPreferenceFilter; label: string; iconColor?: string; borderColor?: string }[] = [
    { id: 'ALL', label: 'All' },
    { id: 'VEG', label: 'Veg', iconColor: '#16a34a', borderColor: '#16a34a' },
    { id: 'NON_VEG', label: 'Non-Veg', iconColor: '#dc2626', borderColor: '#dc2626' },
  ];

  return (
    <div
      className={`dietary-filter-container ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        backgroundColor: '#F1F5F9',
        padding: '3px',
        borderRadius: '8px',
        userSelect: 'none',
        ...style,
      }}
    >
      {options.map((option) => {
        const isActive = value === option.id;

        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '6px',
              fontSize: '12.5px',
              fontWeight: isActive ? 700 : 600,
              color: isActive
                ? option.id === 'VEG'
                  ? '#166534'
                  : option.id === 'NON_VEG'
                  ? '#991b1b'
                  : '#0f172a'
                : '#64748b',
              backgroundColor: isActive
                ? option.id === 'VEG'
                  ? '#F0FDF4'
                  : option.id === 'NON_VEG'
                  ? '#FEF2F2'
                  : '#FFFFFF'
                : 'transparent',
              border: isActive
                ? option.borderColor
                  ? `1px solid ${option.borderColor}`
                  : '1px solid #CBD5E1'
                : '1px solid transparent',
              boxShadow: isActive ? '0 1px 2px rgba(0, 0, 0, 0.05)' : 'none',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              whiteSpace: 'nowrap',
            }}
          >
            {option.iconColor && (
              <div
                style={{
                  width: '12px',
                  height: '12px',
                  border: `1px solid ${option.borderColor}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '2px',
                  background: 'white',
                  flexShrink: 0,
                }}
              >
                <div
                  style={{
                    width: '5px',
                    height: '5px',
                    borderRadius: '50%',
                    backgroundColor: option.iconColor,
                  }}
                />
              </div>
            )}
            <span>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
