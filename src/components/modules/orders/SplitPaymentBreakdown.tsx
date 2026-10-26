'use client';
import React, { useMemo, useState, useEffect } from 'react';
import { Banknote, QrCode, CreditCard, CheckCircle2, AlertCircle } from 'lucide-react';
import { formatPrice } from '@/lib/format';

export interface SplitAmounts {
  CASH: number;
  UPI: number;
  CARD: number;
}

export type SplitPair = 'CASH_UPI' | 'CASH_CARD' | 'UPI_CARD';

export function formatSplitAmount(val: number): string {
  const num = Math.round(Number(val || 0) * 100) / 100;
  return Number.isInteger(num) ? num.toString() : num.toFixed(2);
}

export function formatSplitSummary(split: SplitAmounts): string {
  const parts: string[] = [];
  if (split.CASH > 0) parts.push(`Cash: ₹${formatSplitAmount(split.CASH)}`);
  if (split.UPI > 0) parts.push(`UPI: ₹${formatSplitAmount(split.UPI)}`);
  if (split.CARD > 0) parts.push(`Card: ₹${formatSplitAmount(split.CARD)}`);
  
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
  onValidationChange?: (isValid: boolean, error?: string, isOvercharged?: boolean) => void;
  className?: string;
  theme?: 'light' | 'emerald';
}

const METHOD_DETAILS: Record<keyof SplitAmounts, { id: keyof SplitAmounts; label: string; icon: any; color: string }> = {
  CASH: { id: 'CASH', label: 'Cash', icon: Banknote, color: '#16A34A' },
  UPI: { id: 'UPI', label: 'UPI / QR', icon: QrCode, color: '#2563EB' },
  CARD: { id: 'CARD', label: 'Card', icon: CreditCard, color: '#7C3AED' },
};

const PAIR_CONFIGS: Record<SplitPair, { m1: keyof SplitAmounts; m2: keyof SplitAmounts; inactive: keyof SplitAmounts; label: string }> = {
  CASH_UPI: { m1: 'CASH', m2: 'UPI', inactive: 'CARD', label: 'Cash + UPI' },
  CASH_CARD: { m1: 'CASH', m2: 'CARD', inactive: 'UPI', label: 'Cash + Card' },
  UPI_CARD: { m1: 'UPI', m2: 'CARD', inactive: 'CASH', label: 'UPI + Card' },
};

export default function SplitPaymentBreakdown({
  totalAmount,
  split,
  onChange,
  onValidationChange,
  className = '',
  theme = 'light',
}: SplitPaymentBreakdownProps) {
  const roundedTotal = Math.round(Number(totalAmount || 0) * 100) / 100;

  // Detect which pair is currently active based on existing amounts
  const detectedPair: SplitPair = useMemo(() => {
    if (split.CARD > 0 && split.CASH > 0 && (!split.UPI || split.UPI === 0)) return 'CASH_CARD';
    if (split.CARD > 0 && split.UPI > 0 && (!split.CASH || split.CASH === 0)) return 'UPI_CARD';
    return 'CASH_UPI';
  }, [split.CASH, split.UPI, split.CARD]);

  const [activePair, setActivePair] = useState<SplitPair>(detectedPair);

  useEffect(() => {
    setActivePair(detectedPair);
  }, [detectedPair]);

  const currentPairConfig = PAIR_CONFIGS[activePair];

  const allocated = useMemo(() => {
    return Math.round(((split.CASH || 0) + (split.UPI || 0) + (split.CARD || 0)) * 100) / 100;
  }, [split.CASH, split.UPI, split.CARD]);

  const difference = useMemo(() => {
    return Math.round((roundedTotal - allocated) * 100) / 100;
  }, [roundedTotal, allocated]);

  const activeMethodsCount = useMemo(() => {
    return [split.CASH, split.UPI, split.CARD].filter((v) => Number(v) > 0).length;
  }, [split.CASH, split.UPI, split.CARD]);

  const isExact = Math.abs(difference) <= 0.009;
  const isOver = difference < -0.009;
  const isUnder = difference > 0.009;
  const hasExactlyTwoMethods = activeMethodsCount === 2;
  const isValid = hasExactlyTwoMethods && isExact && !isOver;

  let validationError: string | null = null;
  if (isOver) {
    validationError = `Overcharged by ${formatPrice(Math.abs(difference))}. Total allocated cannot exceed ${formatPrice(roundedTotal)}.`;
  } else if (activeMethodsCount < 2) {
    validationError = 'Split payment requires exactly two payment methods with amounts greater than ₹0.';
  } else if (activeMethodsCount > 2) {
    validationError = 'Split payment requires exactly two payment methods (currently 3 allocated).';
  } else if (isUnder) {
    validationError = `Remaining: ${formatPrice(difference)} to be allocated.`;
  }

  useEffect(() => {
    onValidationChange?.(isValid, validationError || undefined, isOver);
  }, [isValid, validationError, isOver, onValidationChange]);

  // When switching between payment pairs (Cash+UPI vs Cash+Card vs UPI+Card)
  const handleSelectPair = (newPair: SplitPair) => {
    setActivePair(newPair);
    const { m1, m2, inactive } = PAIR_CONFIGS[newPair];

    const currentM1 = split[m1] || 0;
    let newM1 = 0;
    let newM2 = 0;

    if (currentM1 > 0 && currentM1 < roundedTotal) {
      newM1 = currentM1;
      newM2 = Math.round((roundedTotal - currentM1) * 100) / 100;
    } else {
      newM1 = Math.round((roundedTotal / 2) * 100) / 100;
      newM2 = Math.round((roundedTotal - newM1) * 100) / 100;
    }

    const newSplit: SplitAmounts = {
      CASH: 0,
      UPI: 0,
      CARD: 0,
      [m1]: newM1,
      [m2]: newM2,
      [inactive]: 0,
    };
    onChange(newSplit, formatSplitSummary(newSplit));
  };

  // When user edits an amount for one method, automatically calculate the partner method
  const handleMethodAmountChange = (method: keyof SplitAmounts, value: number) => {
    const { m1, m2, inactive } = PAIR_CONFIGS[activePair];
    const partner = method === m1 ? m2 : m1;
    const safeVal = Math.max(0, isNaN(value) ? 0 : Math.round(value * 100) / 100);

    let partnerVal = 0;
    if (safeVal < roundedTotal) {
      partnerVal = Math.round((roundedTotal - safeVal) * 100) / 100;
    } else {
      // Overcharged or exact - complementary method is 0
      partnerVal = 0;
    }

    const newSplit: SplitAmounts = {
      CASH: 0,
      UPI: 0,
      CARD: 0,
      [method]: safeVal,
      [partner]: partnerVal,
      [inactive]: 0,
    };
    onChange(newSplit, formatSplitSummary(newSplit));
  };

  // Only display the two active methods in the active pair
  const activeRows = [
    METHOD_DETAILS[currentPairConfig.m1],
    METHOD_DETAILS[currentPairConfig.m2],
  ];

  return (
    <div
      className={className}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '9px',
        background: theme === 'emerald' ? '#F0FDF4' : '#F8FAFC',
        border: theme === 'emerald' ? '1px solid #BBF7D0' : '1px solid #E2E8F0',
        borderRadius: '10px',
        padding: '12px',
        fontSize: '12px',
      }}
    >
      {/* Header bar: Target Total & Allocation status */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 700, color: '#334155' }}>
          <span>Split Target:</span>
          <span style={{ color: '#0F172A', fontWeight: 800 }}>{formatPrice(roundedTotal)}</span>
        </div>

        {isOver ? (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '11px',
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: '6px',
              background: '#FEE2E2',
              color: '#DC2626',
              border: '1px solid #FECACA',
            }}
          >
            <AlertCircle size={12} />
            <span>Over by {formatPrice(Math.abs(difference))}</span>
          </span>
        ) : isValid ? (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '11px',
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: '6px',
              background: '#DCFCE7',
              color: '#15803D',
              border: '1px solid #86EFAC',
            }}
          >
            <CheckCircle2 size={12} />
            <span>Matched</span>
          </span>
        ) : (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '11px',
              fontWeight: 700,
              padding: '2px 8px',
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

      {/* Method Pair Selector (Enforces exactly two valid methods) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <div style={{ fontSize: '11px', fontWeight: 600, color: '#64748B' }}>
          Select 2 payment methods to split:
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '5px' }}>
          {(Object.keys(PAIR_CONFIGS) as SplitPair[]).map((p) => {
            const isSelected = activePair === p;
            const cfg = PAIR_CONFIGS[p];
            return (
              <button
                key={p}
                type="button"
                onClick={() => handleSelectPair(p)}
                style={{
                  height: '30px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                  borderRadius: '6px',
                  border: isSelected ? '1.5px solid #059669' : '1px solid #CBD5E1',
                  background: isSelected ? '#ECFDF5' : '#FFFFFF',
                  color: isSelected ? '#065F46' : '#475569',
                  fontSize: '11px',
                  fontWeight: isSelected ? 700 : 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  padding: '0 4px',
                  whiteSpace: 'nowrap',
                }}
              >
                {isSelected && <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#059669' }} />}
                <span>{cfg.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Input Rows for the two selected methods */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {activeRows.map((row) => {
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
                border: isOver ? '1.5px solid #FCA5A5' : '1px solid #CBD5E1',
                borderRadius: '8px',
                padding: '5px 8px',
                boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  width: '95px',
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
                  padding: '0 8px',
                  height: '32px',
                }}
              >
                <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#94A3B8', marginRight: '4px' }}>₹</span>
                <input
                  type="number"
                  min="0"
                  max={roundedTotal}
                  step="any"
                  placeholder="0"
                  value={currentVal > 0 ? currentVal : ''}
                  onChange={(e) => {
                    const raw = e.target.value;
                    handleMethodAmountChange(row.id, raw === '' ? 0 : parseFloat(raw));
                  }}
                  style={{
                    width: '100%',
                    border: 'none',
                    background: 'transparent',
                    outline: 'none',
                    fontSize: '13px',
                    fontWeight: 700,
                    color: isOver ? '#DC2626' : '#0F172A',
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
