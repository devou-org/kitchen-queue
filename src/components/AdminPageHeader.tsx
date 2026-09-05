'use client';
import React from 'react';
import { LayoutMaximizeToggle } from './LayoutMaximizeToggle';

interface AdminPageHeaderProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  backLink?: React.ReactNode;
  hideMaximize?: boolean;
}

export function AdminPageHeader({ title, description, action, backLink, hideMaximize = false }: AdminPageHeaderProps) {
  return (
    <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
      <div style={{ flex: 1, minWidth: '240px' }}>
        {backLink && (
          <div style={{ marginBottom: '12px' }}>
            {backLink}
          </div>
        )}
        <h1 style={{ fontSize: '24px', fontWeight: 800, margin: 0, color: 'var(--text-primary)', lineHeight: '1.2' }}>
          {title}
        </h1>
        {description && (
          <p style={{ color: 'var(--text-secondary)', margin: '6px 0 0 0', fontSize: '14px', lineHeight: '1.5' }}>
            {description}
          </p>
        )}
      </div>
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexShrink: 0 }}>
        {action}
        {!hideMaximize && <LayoutMaximizeToggle />}
      </div>
    </div>
  );
}
