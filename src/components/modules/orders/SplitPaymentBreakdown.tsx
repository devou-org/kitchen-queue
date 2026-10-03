'use client';
import React, { useMemo } from 'react';
import { Banknote, QrCode, CreditCard, Sparkles, RotateCcw, CheckCircle2, AlertCircle } from 'lucide-react';
import { formatPrice } from '@/lib/format';

export interface SplitAmounts {
  CASH: number;
  UPI: number;
  CARD: number;
}

export function formatSplitSummary(split: SplitAmounts): string {
  const parts: string[] = [];
  if (split.CASH > 0) parts.push(`Cash: ₹${Math.round(split.CASH)}`);
  if (split.UPI > 0) parts.push(`UPI: ₹${Math.round(split.UPI)}`);
  if (split.CARD > 0) parts.push(`Card: ₹${Math.round(split.CARD)}`);
  
  if (parts.length === 0) return 'SPLIT';
  return `SPLIT (${parts.join(', ')})`;
}

export function parseSplitFromSummary(summary?: string): SplitAmounts | null {
  if (!summary || !summary.toUpperCase().startsWith('SPLIT')) return null;
  const split: SplitAmounts = { CASH: 0, UPI: 0, CARD: 0 };
  
  const cashMatch = summary.match(/Cash:\s*₹?([\d.]+)/i);
  if (cashMatch) split.CASH = parseFloat(cashMatch[1]) || 0;
  
  const upiMatch = summary.match(/UPI:\s*₹?([\d.]+)/i);
  if (upiMatch) split.UPI = parseFloat(upiMatch[1]) || 0;
  
  const cardMatch = summary.match(/Card:\s*₹?([\d.]+)/i);
  if (cardMatch) split.CARD = parseFloat(cardMatch[1]) || 0;

  return split;
}

export function normalizeSplitAmounts(raw?: Record<string, number> | null, summary?: string): SplitAmounts {
  if (raw && typeof raw === 'object') {
    return {
      CASH: Number(raw.CASH) || 0,
      UPI: Number(raw.UPI) || 0,
      CARD: Number(raw.CARD) || 0,
    };
  }
  const parsed = parseSplitFromSummary(summary);
  if (parsed) return parsed;
  return { CASH: 0, UPI: 0, CARD: 0 };
}

interface SplitPaymentBreakdownProps {
  totalAmount: number;
  split: SplitAmounts;
  onChange: (newSplit: SplitAmounts, formattedSummary: string) => void;
  className?: string;
  theme?: 'light' | 'emerald';
}

export default function SplitPaymentBreakdown({
  totalAmount,
  split,
  onChange,
  className = '',
  theme = 'light',
}: SplitPaymentBreakdownProps) {
  const roundedTotal = Math.round(Number(totalAmount || 0) * 100) / 100;

  const allocated = useMemo(() => {
    return Math.round(((split.CASH || 0) + (split.UPI || 0) + (split.CARD || 0)) * 100) / 100;
  }, [split]);

  const difference = useMemo(() => {
    return Math.round((roundedTotal - allocated) * 100) / 100;
  }, [roundedTotal, allocated]);

  const isExact = Math.abs(difference) < 0.01;
  const isOver = difference < -0.01;
  const isUnder = difference > 0.01;

  const updateMethodAmount = (method: keyof SplitAmounts, value: number) => {
    const safeVal = Math.max(0, isNaN(value) ? 0 : Math.round(value * 100) / 100);
    const newSplit = { ...split, [method]: safeVal };
    onChange(newSplit, formatSplitSummary(newSplit));
  };

  const handleFillRemaining = (method: keyof SplitAmounts) => {
    const currentVal = split[method] || 0;
    const targetVal = Math.max(0, currentVal + difference);
    updateMethodAmount(method, targetVal);
  };

  const handleSplitFiftyFifty = (m1: keyof SplitAmounts, m2: keyof SplitAmounts) => {
    const half = Math.round((roundedTotal / 2) * 100) / 100;
    const otherHalf = Math.round((roundedTotal - half) * 100) / 100;
    const newSplit: SplitAmounts = {
      CASH: 0,
      UPI: 0,
      CARD: 0,
      [m1]: half,
      [m2]: otherHalf,
    };
    onChange(newSplit, formatSplitSummary(newSplit));
  };

  const handleReset = () => {
    const empty: SplitAmounts = { CASH: 0, UPI: 0, CARD: 0 };
    onChange(empty, formatSplitSummary(empty));
  };

  const rows: { id: keyof SplitAmounts; label: string; icon: any; color: string }[] = [
    { id: 'CASH', label: 'Cash', icon: Banknote, color: '#16A34A' },
    { id: 'UPI', label: 'UPI / QR', icon: QrCode, color: '#2563EB' },
    { id: 'CARD', label: 'Card', icon: CreditCard, color: '#7C3AED' },
  ];

  return (
    <div
      className={className}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        background: theme === 'emerald' ? '#F0FDF4' : '#F8FAFC',
        border: theme === 'emerald' ? '1px solid #BBF7D0' : '1px solid #E2E8F0',
        borderRadius: '10px',
        padding: '10px 12px',
        fontSize: '12px',
      }}
    >
      {/* Header bar: Target Total & Allocation status */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 700, color: '#334155' }}>
          <span>Split Target:</span>
          <span style={{ color: '#0F172A', fontWeight: 800 }}>{formatPrice(roundedTotal)}</span>
        </div>

        {isExact ? (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '11px',
              fontWeight: 700,
              padding: '2px 7px',
              borderRadius: '6px',
              background: '#DCFCE7',
              color: '#15803D',
              border: '1px solid #86EFAC',
            }}
          >
            <CheckCircle2 size={12} />
            <span>Matched</span>
          </span>
        ) : isOver ? (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '11px',
              fontWeight: 700,
              padding: '2px 7px',
              borderRadius: '6px',
              background: '#FEE2E2',
              color: '#B91C1C',
              border: '1px solid #FECACA',
            }}
          >
            <AlertCircle size={12} />
            <span>Over by {formatPrice(Math.abs(difference))}</span>
          </span>
        ) : (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '11px',
              fontWeight: 700,
              padding: '2px 7px',
              borderRadius: '6px',
              background: '#FEF3C7',
              color: '#B45309',
              border: '1px solid #FDE68A',
            }}
          >
            <span>Remaining: {formatPrice(difference)}</span>
          </span>
        )}
      </div>

      {/* Inputs per method */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {rows.map((row) => {
          const Icon = row.icon;
          const currentVal = split[row.id] || 0;
          return (
            <div
              key={row.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: '#FFFFFF',
                border: '1px solid #CBD5E1',
                borderRadius: '8px',
                padding: '4px 8px',
                boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  width: '90px',
                  flexShrink: 0,
                  fontWeight: 600,
                  fontSize: '11.5px',
                  color: '#334155',
                }}
              >
                <Icon size={14} style={{ color: row.color, flexShrink: 0 }} />
                <span>{row.label}</span>
              </div>

              {/* Amount Input */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  flex: 1,
                  background: '#F8FAFC',
                  borderRadius: '6px',
                  border: '1px solid #E2E8F0',
                  padding: '0 6px',
                  height: '30px',
                }}
              >
                <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#94A3B8', marginRight: '4px' }}>₹</span>
                <input
                  type="number"
                  min="0"
                  step="any"
                  placeholder="0"
                  value={currentVal > 0 ? currentVal : ''}
                  onChange={(e) => updateMethodAmount(row.id, parseFloat(e.target.value))}
                  style={{
                    width: '100%',
                    border: 'none',
                    background: 'transparent',
                    outline: 'none',
                    fontSize: '12.5px',
                    fontWeight: 700,
                    color: '#0F172A',
                  }}
                />
              </div>

              {/* Quick Fill / Clear Buttons */}
              {isUnder && (
                <button
                  type="button"
                  onClick={() => handleFillRemaining(row.id)}
                  title={`Fill remaining ${formatPrice(difference)} into ${row.label}`}
                  style={{
                    height: '28px',
                    padding: '0 8px',
                    borderRadius: '6px',
                    border: '1px solid #CBD5E1',
                    background: '#F1F5F9',
                    color: '#475569',
                    fontSize: '10.5px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#E2E8F0';
                    e.currentTarget.style.color = '#0F172A';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#F1F5F9';
                    e.currentTarget.style.color = '#475569';
                  }}
                >
                  + Fill
                </button>
              )}

              {currentVal > 0 && (
                <button
                  type="button"
                  onClick={() => updateMethodAmount(row.id, 0)}
                  title="Clear"
                  style={{
                    height: '24px',
                    width: '24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '50%',
                    border: 'none',
                    background: '#F1F5F9',
                    color: '#94A3B8',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: 800,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#FEE2E2';
                    e.currentTarget.style.color = '#DC2626';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#F1F5F9';
                    e.currentTarget.style.color = '#94A3B8';
                  }}
                >
                  ×
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Quick Presets */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px', paddingTop: '2px' }}>
        <div style={{ display: 'flex', gap: '5px' }}>
          <button
            type="button"
            onClick={() => handleSplitFiftyFifty('CASH', 'UPI')}
            style={{
              padding: '3px 8px',
              borderRadius: '5px',
              border: '1px solid #E2E8F0',
              background: '#FFFFFF',
              color: '#475569',
              fontSize: '10.5px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <Sparkles size={11} style={{ color: '#059669' }} />
            <span>50/50 Cash+UPI</span>
          </button>
          <button
            type="button"
            onClick={() => handleSplitFiftyFifty('CASH', 'CARD')}
            style={{
              padding: '3px 8px',
              borderRadius: '5px',
              border: '1px solid #E2E8F0',
              background: '#FFFFFF',
              color: '#475569',
              fontSize: '10.5px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <span>50/50 Cash+Card</span>
          </button>
        </div>

        {allocated > 0 && (
          <button
            type="button"
            onClick={handleReset}
            style={{
              padding: '3px 6px',
              border: 'none',
              background: 'transparent',
              color: '#94A3B8',
              fontSize: '10.5px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '3px',
            }}
          >
            <RotateCcw size={10} />
            <span>Reset</span>
          </button>
        )}
      </div>
    </div>
  );
}
