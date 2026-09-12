'use client';
import React from 'react';
import { useAdminLayout } from '@/context/AdminLayoutContext';

interface AdminContentWrapperProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  fullWidth?: boolean;
}

export function AdminContentWrapper({ children, className = '', style = {}, fullWidth = true }: AdminContentWrapperProps) {
  const { isMaximized } = useAdminLayout();
  const shouldBeFullWidth = fullWidth || isMaximized;

  return (
    <>
      <style>{`
        .admin-wrapper-inner {
          padding: 28px 32px 24px 32px;
          max-width: 1200px;
          margin: 0 auto;
          width: 100%;
          box-sizing: border-box;
          transition: max-width 0.3s cubic-bezier(0.4, 0, 0.2, 1), padding 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .admin-wrapper-inner.full-width {
          max-width: 100% !important;
        }
        .admin-wrapper-inner.is-maximized {
          padding: 20px 24px 16px 24px !important;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
        }
        @media (max-width: 768px) {
          .admin-wrapper-inner {
            padding: 20px 16px 16px 16px;
          }
        }
        @media (max-width: 640px) {
          .admin-wrapper-inner {
            padding: 16px 12px 12px 12px;
          }
        }
      `}</style>
      <div className={`admin-wrapper-inner animate-fade-in ${shouldBeFullWidth ? 'full-width' : ''} ${isMaximized ? 'is-maximized' : ''} ${className}`} style={style}>
        {children}
      </div>
    </>
  );
}
