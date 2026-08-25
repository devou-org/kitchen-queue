'use client';

import React, { useState } from 'react';

export interface AICreditData {
  billing_period: string;
  allocated_credits: number;
  used_credits: number;
  used_tokens: number;
  tokens_per_credit: number;
  remaining_credits: number;
}

interface AICreditProgressBarProps {
  creditData: AICreditData | null;
  loading?: boolean;
}

export function AICreditProgressBar({
  creditData,
  loading = false,
}: AICreditProgressBarProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  if (loading) {
    return (
      <div style={{ width: '22px', height: '22px', borderRadius: '50%', border: '2px solid #E2E8F0', borderTopColor: '#6366F1', animation: 'spin 1s linear infinite' }} />
    );
  }

  if (!creditData) return null;

  const allocated = creditData.allocated_credits || 10;
  const used = creditData.used_credits || 0;
  const percentage = Math.min(100, Math.max(0, Math.round((used / allocated) * 100)));
  const isHighUsage = percentage >= 85;
  const isExhausted = percentage >= 100;

  const strokeColor = isExhausted
    ? '#EF4444'
    : isHighUsage
    ? '#F59E0B'
    : '#10B981';

  const radius = 8;
  const circumference = 2 * Math.PI * radius; // ~50.265
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  const usedText = `${Number.isInteger(used) ? used : used.toFixed(1)}/${allocated} credits used`;

  return (
    <div 
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {/* Circular Progress Ring */}
      <div style={{ position: 'relative', width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="22" height="22" viewBox="0 0 22 22" style={{ transform: 'rotate(-90deg)' }}>
          {/* Track */}
          <circle
            cx="11"
            cy="11"
            r={radius}
            fill="none"
            stroke="#E2E8F0"
            strokeWidth="2.5"
          />
          {/* Progress Indicator */}
          <circle
            cx="11"
            cy="11"
            r={radius}
            fill="none"
            stroke={strokeColor}
            strokeWidth="2.5"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.4s ease' }}
          />
        </svg>
      </div>

      {/* Hover Tooltip */}
      {showTooltip && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: '#FFFFFF',
            color: '#0F172A',
            padding: '5px 10px',
            borderRadius: '8px',
            fontSize: '11px',
            fontWeight: 700,
            whiteSpace: 'nowrap',
            boxShadow: '0 4px 16px rgba(15, 23, 42, 0.15)',
            zIndex: 99999,
            pointerEvents: 'none',
            border: '1px solid #E2E8F0',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <span style={{ color: strokeColor, fontSize: '10px' }}>●</span>
          <span>{usedText}</span>
        </div>
      )}
    </div>
  );
}
