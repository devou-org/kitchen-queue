'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, Search } from 'lucide-react';
import { COUNTRY_CODES } from '@/lib/constants';

interface CountryCodeSelectProps {
  value: string;
  onChange: (code: string) => void;
  disabled?: boolean;
  buttonHeight?: string;
  style?: React.CSSProperties;
}

export function CountryCodeSelect({
  value,
  onChange,
  disabled = false,
  buttonHeight = '42px',
  style,
}: CountryCodeSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
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

  const selectedItem = COUNTRY_CODES.find((c) => c.code === value) || { code: value || '+91', country: 'India' };

  const filteredCodes = COUNTRY_CODES.filter(
    (c) =>
      c.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.country.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '85px',
        flexShrink: 0,
        ...style,
      }}
    >
      {/* Trigger Button: Closed State UI */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '100%',
          height: buttonHeight,
          padding: '0 8px 0 10px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: '#FFFFFF',
          border: '1px solid #CBD5E1',
          borderRadius: '8px',
          fontSize: '13px',
          fontWeight: 600,
          color: '#0F172A',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.6 : 1,
          transition: 'all 0.15s ease',
          boxSizing: 'border-box',
          boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
        }}
      >
        <span style={{ fontWeight: 700, fontSize: '13px' }}>{selectedItem.code}</span>
        <ChevronDown
          size={15}
          style={{
            color: '#64748B',
            transition: 'transform 0.2s ease',
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            flexShrink: 0,
          }}
        />
      </button>

      {/* Floating Dropdown Panel: Open State UI with Search & Country Names */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            width: '250px',
            zIndex: 999999,
            background: '#FFFFFF',
            border: '1px solid #CBD5E1',
            borderRadius: '10px',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.05)',
            padding: '6px',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
          }}
        >
          {/* Quick Search Field */}
          <div
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              padding: '2px 4px 6px 4px',
              borderBottom: '1px solid #F1F5F9',
            }}
          >
            <Search size={13} style={{ position: 'absolute', left: '10px', color: '#94A3B8' }} />
            <input
              type="text"
              placeholder="Search country or code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              autoFocus
              style={{
                width: '100%',
                padding: '6px 8px 6px 26px',
                borderRadius: '6px',
                border: '1px solid #E2E8F0',
                fontSize: '12px',
                outline: 'none',
                background: '#F8FAFC',
                color: '#0F172A',
              }}
            />
          </div>

          {/* List of Countries with Codes */}
          <div
            style={{
              maxHeight: '220px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '2px',
              WebkitOverflowScrolling: 'touch',
            }}
          >
            {filteredCodes.length === 0 ? (
              <div style={{ padding: '10px', fontSize: '12px', color: '#94A3B8', textAlign: 'center' }}>
                No country found
              </div>
            ) : (
              filteredCodes.map((c, i) => {
                const isSelected = c.code === value;
                return (
                  <button
                    key={`${c.code}-${i}`}
                    type="button"
                    onClick={() => {
                      onChange(c.code);
                      setIsOpen(false);
                      setSearchQuery('');
                    }}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      border: 'none',
                      background: isSelected ? 'rgba(5, 150, 105, 0.08)' : 'transparent',
                      color: isSelected ? 'var(--primary, #059669)' : '#0F172A',
                      fontSize: '13px',
                      fontWeight: isSelected ? 700 : 500,
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'background 0.12s ease',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.background = '#F8FAFC';
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontWeight: 700, minWidth: '42px', color: isSelected ? 'var(--primary, #059669)' : '#334155' }}>
                        {c.code}
                      </span>
                      <span style={{ fontSize: '12.5px', color: isSelected ? 'var(--primary, #059669)' : '#64748B' }}>
                        {c.country}
                      </span>
                    </div>
                    {isSelected && <Check size={14} style={{ color: 'var(--primary, #059669)', flexShrink: 0 }} />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
