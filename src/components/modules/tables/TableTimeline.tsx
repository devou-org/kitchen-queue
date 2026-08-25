import React from 'react';
import { Clock, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';
import { formatDateTime } from '@/lib/format';

interface TableTimelineProps {
  pendingAt?: string;
  preparingAt?: string;
  readyAt?: string;
  paidAt?: string;
  status: string;
}

export function TableTimeline({ pendingAt, preparingAt, readyAt, paidAt, status }: TableTimelineProps) {
  const steps = [
    { label: 'Pending', time: pendingAt, active: Boolean(pendingAt) || status === 'PENDING' },
    { label: 'Preparing', time: preparingAt, active: Boolean(preparingAt) || status === 'PREPARING' },
    { label: 'Ready', time: readyAt, active: Boolean(readyAt) || status === 'READY' },
    { label: 'Paid', time: paidAt, active: Boolean(paidAt) || status === 'PAID' },
  ];

  return (
    <div style={{ padding: '8px 0', borderTop: '1px solid #F1F5F9', marginTop: '10px' }}>
      <p style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        Status Timestamps
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px', textAlign: 'center' }}>
        {steps.map((step, idx) => {
          const isDone = Boolean(step.time);
          return (
            <div
              key={idx}
              style={{
                background: isDone ? '#F0FDF4' : '#F8FAFC',
                border: `1px solid ${isDone ? '#DCFCE7' : '#E2E8F0'}`,
                borderRadius: '6px',
                padding: '6px 4px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '2px'
              }}
            >
              <span style={{ fontSize: '10px', fontWeight: 700, color: isDone ? '#059669' : '#94A3B8' }}>
                {step.label}
              </span>
              <span style={{ fontSize: '9px', color: isDone ? '#047857' : '#CBD5E1', fontWeight: 600 }}>
                {step.time ? new Date(step.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
