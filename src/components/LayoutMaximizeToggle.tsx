'use client';
import React from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';
import { useAdminLayout } from '@/context/AdminLayoutContext';

interface LayoutMaximizeToggleProps {
  className?: string;
  style?: React.CSSProperties;
  showText?: boolean;
}

export function LayoutMaximizeToggle({ className = '', style = {}, showText = false }: LayoutMaximizeToggleProps) {
  const { isMaximized, toggleMaximize } = useAdminLayout();

  return (
    <>
      <style>{`
        @media (max-width: 768px) {
          .layout-maximize-toggle-btn {
            display: none !important;
          }
        }
        .layout-maximize-toggle-btn:hover {
          opacity: 0.9;
          transform: translateY(-1px);
        }
      `}</style>
      <button
        onClick={toggleMaximize}
        className={`layout-maximize-toggle-btn ${className}`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px',
          fontWeight: 700,
          fontSize: '13px',
          height: '38px',
          width: showText ? 'auto' : '38px',
          minWidth: showText ? 'auto' : '38px',
          padding: showText ? '0 12px' : 0,
          borderRadius: '8px',
          border: 'none',
          background: isMaximized ? 'var(--primary)' : '#F1F5F9',
          color: isMaximized ? 'white' : 'var(--text-secondary)',
          cursor: 'pointer',
          transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
          boxShadow: isMaximized ? '0 4px 12px rgba(0,0,0,0.15)' : 'none',
          ...style
        }}
        title={isMaximized ? 'Minimize' : 'Maximize'}
        type="button"
      >
      {isMaximized ? (
        <>
          <Minimize2 size={18} strokeWidth={2.5} />
          {showText && <span>Minimize</span>}
        </>
      ) : (
        <>
          <Maximize2 size={18} strokeWidth={2.5} />
          {showText && <span>Maximize</span>}
        </>
      )}
    </button>
    </>
  );
}
