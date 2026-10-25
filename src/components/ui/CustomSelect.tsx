'use client';
import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, Search, X } from 'lucide-react';

export interface SelectOption<T = string> {
  value: T;
  label: React.ReactNode;
  icon?: React.ComponentType<{ size?: number; style?: React.CSSProperties; className?: string }>;
}

export interface CustomSelectProps<T = string> {
  options: SelectOption<T>[];
  value: T;
  onChange: (val: T) => void;
  placeholder?: string;
  disabled?: boolean;
  style?: React.CSSProperties;
  className?: string;
  buttonStyle?: React.CSSProperties;
  dropdownStyle?: React.CSSProperties;
  iconColor?: string;
  defaultIcon?: React.ComponentType<{ size?: number; style?: React.CSSProperties; className?: string }>;
  direction?: 'down' | 'up' | 'auto';
}

export function CustomSelect<T extends string = string>({
  options,
  value,
  onChange,
  placeholder = 'Select option...',
  disabled = false,
  style = {},
  className = '',
  buttonStyle = {},
  dropdownStyle = {},
  iconColor = 'var(--primary)',
  defaultIcon: DefaultIcon,
  direction = 'down',
}: CustomSelectProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [computedDirection, setComputedDirection] = useState<'down' | 'up'>(
    direction === 'up' ? 'up' : 'down'
  );

  useEffect(() => {
    if (direction === 'up') {
      setComputedDirection('up');
    } else if (direction === 'down') {
      setComputedDirection('down');
    } else if (direction === 'auto' && isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      setComputedDirection(spaceBelow < 260 && spaceAbove > spaceBelow ? 'up' : 'down');
    }
  }, [isOpen, direction]);

  const selectedOption = options.find((opt) => opt.value === value) ?? null;
  const OptionIcon = selectedOption?.icon || DefaultIcon;

  useEffect(() => {
    const handleOutsideInteraction = (event: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideInteraction);
    document.addEventListener('touchstart', handleOutsideInteraction, { passive: true });
    return () => {
      document.removeEventListener('mousedown', handleOutsideInteraction);
      document.removeEventListener('touchstart', handleOutsideInteraction);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        zIndex: isOpen ? 60 : undefined,
        ...style,
      }}
      className={className}
    >
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
          color: selectedOption ? 'var(--text-primary)' : '#94A3B8',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.6 : 1,
          transition: 'all 0.2s ease',
          boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
          touchAction: 'manipulation',
          WebkitTapHighlightColor: 'transparent',
          ...buttonStyle,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {OptionIcon && <OptionIcon size={16} style={{ color: iconColor, flexShrink: 0 }} />}
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </div>
        <ChevronDown
          size={16}
          style={{
            color: 'var(--text-secondary)',
            transition: 'transform 0.2s ease',
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            flexShrink: 0,
            marginLeft: '8px',
          }}
        />
      </button>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            ...(computedDirection === 'up'
              ? { bottom: 'calc(100% + 4px)', top: 'auto', boxShadow: '0 -10px 25px -5px rgba(0, 0, 0, 0.1), 0 -8px 10px -6px rgba(0, 0, 0, 0.05)' }
              : { top: 'calc(100% + 4px)', bottom: 'auto', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05)' }
            ),
            left: 0,
            right: 0,
            zIndex: 100,
            background: 'white',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm, 8px)',
            overflowY: 'auto',
            maxHeight: '340px',
            padding: '4px',
            WebkitOverflowScrolling: 'touch',
            ...dropdownStyle,
          }}
        >
          {options.map((option) => {
            const ItemIcon = option.icon || DefaultIcon;
            const isSelected = option.value === value;

            return (
              <button
                key={String(option.value)}
                type="button"
                onPointerDown={(e) => {
                  e.stopPropagation();
                }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onChange(option.value);
                  setIsOpen(false);
                }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  background: isSelected ? 'rgba(0, 0, 0, 0.05)' : 'transparent',
                  color: isSelected ? 'var(--primary, #971345)' : 'var(--text-primary, #0F172A)',
                  fontWeight: isSelected ? 700 : 500,
                  fontSize: '13.5px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  touchAction: 'manipulation',
                  WebkitTapHighlightColor: 'transparent',
                  userSelect: 'none',
                  transition: 'background 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) e.currentTarget.style.background = 'rgba(0, 0, 0, 0.02)';
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) e.currentTarget.style.background = 'transparent';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {ItemIcon && (
                    <ItemIcon
                      size={16}
                      style={{
                        color: isSelected ? 'var(--primary, #971345)' : 'var(--text-secondary, #64748B)',
                        flexShrink: 0,
                      }}
                    />
                  )}
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{option.label}</span>
                </div>
                {isSelected && <Check size={14} style={{ color: 'var(--primary, #971345)', flexShrink: 0, marginLeft: '8px' }} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export interface MultiSelectOption<T = string> {
  value: T;
  label: string;
  sublabel?: string;
  price?: number;
}

export interface CustomMultiSelectProps<T = string> {
  options: MultiSelectOption<T>[];
  value: T[];
  onChange: (val: T[]) => void;
  placeholder?: string;
  disabled?: boolean;
  style?: React.CSSProperties;
  className?: string;
}

export function CustomMultiSelect<T extends string = string>({
  options,
  value,
  onChange,
  placeholder = 'Select products...',
  disabled = false,
  style = {},
  className = '',
}: CustomMultiSelectProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutside = (event: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('touchstart', handleOutside, { passive: true });
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('touchstart', handleOutside);
    };
  }, []);

  const filteredOptions = options.filter((opt) =>
    opt.label.toLowerCase().includes(search.toLowerCase()) ||
    (opt.sublabel && opt.sublabel.toLowerCase().includes(search.toLowerCase()))
  );

  const toggleOption = (val: T) => {
    if (value.includes(val)) {
      onChange(value.filter((v) => v !== val));
    } else {
      onChange([...value, val]);
    }
  };

  const removeValue = (val: T, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(value.filter((v) => v !== val));
  };

  return (
    <div
      ref={containerRef}
      style={{ position: 'relative', width: '100%', ...style }}
      className={className}
    >
      <div
        onClick={() => !disabled && setIsOpen(!isOpen)}
        style={{
          minHeight: '44px',
          padding: '6px 12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'white',
          border: '1px solid var(--border, #cbd5e1)',
          borderRadius: '8px',
          cursor: disabled ? 'not-allowed' : 'pointer',
          boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
          gap: '8px',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', flex: 1, alignItems: 'center' }}>
          {value.length === 0 ? (
            <span style={{ fontSize: '13px', color: '#94a3b8', fontWeight: 500 }}>
              {placeholder}
            </span>
          ) : (
            value.map((val) => {
              const opt = options.find((o) => o.value === val);
              if (!opt) return null;
              return (
                <span
                  key={String(val)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '3px 8px',
                    borderRadius: '6px',
                    background: '#f1f5f9',
                    border: '1px solid #e2e8f0',
                    fontSize: '12px',
                    fontWeight: 700,
                    color: '#0f172a',
                  }}
                >
                  {opt.label} {opt.price !== undefined ? `(₹${opt.price})` : ''}
                  <X
                    size={12}
                    onClick={(e) => removeValue(val, e)}
                    style={{ cursor: 'pointer', color: '#64748b' }}
                  />
                </span>
              );
            })
          )}
        </div>
        <ChevronDown
          size={16}
          style={{
            color: '#64748b',
            transition: 'transform 0.2s ease',
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            flexShrink: 0,
          }}
        />
      </div>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            zIndex: 100,
            background: 'white',
            border: '1px solid var(--border, #cbd5e1)',
            borderRadius: '8px',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
            padding: '8px',
            maxHeight: '280px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
          }}
        >
          {/* Search bar & quick select controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingBottom: '6px', borderBottom: '1px solid #f1f5f9' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={14} style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                type="text"
                placeholder="Search products..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                style={{
                  width: '100%',
                  padding: '6px 8px 6px 28px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '12px',
                  outline: 'none',
                }}
              />
            </div>
            {value.length > 0 ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange([]);
                }}
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  color: '#dc2626',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px 6px',
                }}
              >
                Clear All
              </button>
            ) : (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(options.map((o) => o.value));
                }}
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  color: 'var(--primary, #059669)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px 6px',
                }}
              >
                Select All
              </button>
            )}
          </div>

          {/* Product list */}
          <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {filteredOptions.length === 0 ? (
              <div style={{ padding: '12px', textAlign: 'center', color: '#94a3b8', fontSize: '12px' }}>
                No matching products found.
              </div>
            ) : (
              filteredOptions.map((option) => {
                const isSelected = value.includes(option.value);
                return (
                  <div
                    key={String(option.value)}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleOption(option.value);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      background: isSelected ? '#f0fdf4' : 'transparent',
                      cursor: 'pointer',
                      fontSize: '13px',
                      transition: 'background 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.background = '#f8fafc';
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}}
                        style={{ width: '16px', height: '16px', accentColor: 'var(--primary, #059669)', cursor: 'pointer' }}
                      />
                      <span style={{ fontWeight: isSelected ? 700 : 500, color: '#0f172a' }}>
                        {option.label}
                      </span>
                    </div>
                    {option.price !== undefined && (
                      <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>
                        ₹{option.price}
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
