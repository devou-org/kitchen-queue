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
}

export function AdminPageHeader({ title, subtitle, description, action, backLink, hideMaximize = false, search, style = {} }: AdminPageHeaderProps) {
  const descText = description || subtitle;
  const hasLeftContent = Boolean(backLink || title || search || descText);

  return (
    <div style={{ paddingTop: '8px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: descText ? 'flex-start' : 'center', flexWrap: 'wrap', gap: '16px', ...style }}>
      {hasLeftContent && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'nowrap' }}>
          {backLink && (
            <div style={{ width: '100%', marginBottom: '4px' }}>
              {backLink}
            </div>
          )}
          {title && (
            <h1 style={{ fontSize: '24px', fontWeight: 800, margin: 0, color: 'var(--text-primary)', lineHeight: '1.2', whiteSpace: 'nowrap' }}>
              {title}
            </h1>
          )}
          {search && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'nowrap' }}>
              {search}
            </div>
          )}
          {description && (
            <p style={{ width: '100%', color: 'var(--text-secondary)', margin: '6px 0 0 0', fontSize: '14px', lineHeight: '1.5' }}>
              {description}
            </p>
          )}
        </div>
      )}
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexShrink: 0, marginLeft: hasLeftContent ? undefined : 'auto' }}>
        {action}
        {!hideMaximize && <LayoutMaximizeToggle />}
      </div>
    </div>
  );
}
