'use client';
import React from 'react';
import { LayoutMaximizeToggle } from './LayoutMaximizeToggle';

interface AdminPageHeaderProps {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  backLink?: React.ReactNode;
  hideMaximize?: boolean;
  search?: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
}

export function AdminPageHeader({
  title,
  subtitle,
  description,
  action,
  backLink,
  hideMaximize = false,
  search,
  style = {},
  className = '',
}: AdminPageHeaderProps) {
  const descText = description || subtitle;
  const hasLeftContent = Boolean(backLink || title || search || descText);

  return (
    <>
      <style>{`
        .admin-page-header-container {
          padding-top: 8px;
          margin-bottom: 16px;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
          width: 100%;
        }

        .admin-header-title {
          font-size: 24px;
          font-weight: 800;
          margin: 0;
          color: var(--text-primary);
          line-height: 1.2;
          white-space: nowrap;
        }

        @media (max-width: 640px) {
          .admin-page-header-container {
            flex-direction: column;
            align-items: stretch !important;
            gap: 12px !important;
          }

          .admin-header-left {
            flex: 1 1 100% !important;
            width: 100% !important;
          }

          .admin-header-title {
            font-size: 20px !important;
            white-space: normal !important;
            word-break: break-word !important;
          }

          .admin-header-right {
            flex: 1 1 100% !important;
            width: 100% !important;
            justify-content: flex-end !important;
            margin-left: 0 !important;
          }
        }
      `}</style>
      <div
        className={`admin-page-header-container ${className}`}
        style={style}
      >
        {hasLeftContent && (
          <div
            className="admin-header-left"
            style={{
              flex: '1 1 auto',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              flexWrap: 'wrap',
              minWidth: 0,
            }}
          >
            {backLink && (
              <div style={{ width: '100%', marginBottom: '4px' }}>
                {backLink}
              </div>
            )}
            {title && (
              <h1 className="admin-header-title">
                {title}
              </h1>
            )}
            {search && (
              <div
                className="admin-header-search"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  flexWrap: 'wrap',
                  minWidth: 0,
                  flex: '1 1 auto',
                }}
              >
                {search}
              </div>
            )}
            {descText && (
              <p
                style={{
                  width: '100%',
                  color: 'var(--text-secondary)',
                  margin: '6px 0 0 0',
                  fontSize: '14px',
                  lineHeight: '1.5',
                }}
              >
                {descText}
              </p>
            )}
          </div>
        )}
        {(action || !hideMaximize) && (
          <div
            className="admin-header-right"
            style={{
              display: 'flex',
              gap: '8px',
              alignItems: 'center',
              flexShrink: 0,
              marginLeft: 'auto',
            }}
          >
            {action}
            {!hideMaximize && <LayoutMaximizeToggle />}
          </div>
        )}
      </div>
    </>
  );
}
