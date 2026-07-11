import React from 'react';

interface AdminContentWrapperProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function AdminContentWrapper({ children, className = '', style = {} }: AdminContentWrapperProps) {
  return (
    <>
      <style>{`
        .admin-wrapper-inner {
          padding: 32px;
          max-width: 1200px;
          margin: 0 auto;
          width: 100%;
          box-sizing: border-box;
        }
        @media (max-width: 768px) {
          .admin-wrapper-inner {
            padding: 20px 12px;
          }
        }
        @media (max-width: 640px) {
          .admin-wrapper-inner {
            padding: 16px 8px;
          }
        }
      `}</style>
      <div className={`admin-wrapper-inner animate-fade-in ${className}`} style={style}>
        {children}
      </div>
    </>
  );
}
