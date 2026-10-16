import React from 'react';

export interface PrinterIllustrationProps {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
  status?: 'printing' | 'success' | 'error' | 'idle';
}

export function PrinterIllustration({
  size = 22,
  className = '',
  style,
  status = 'printing',
}: PrinterIllustrationProps) {
  const getLedColor = () => {
    switch (status) {
      case 'printing':
        return '#0EA5E9'; // Sky / Blue (active printing)
      case 'success':
        return '#10B981'; // Emerald (finished)
      case 'error':
        return '#EF4444'; // Red
      case 'idle':
      default:
        return '#94A3B8'; // Slate
    }
  };

  const ledColor = getLedColor();

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{
        display: 'inline-block',
        verticalAlign: 'middle',
        flexShrink: 0,
        ...style,
      }}
      aria-label="Thermal Printer"
    >
      <defs>
        <linearGradient id="printerBodyGrad" x1="16" y1="12" x2="16" y2="28" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#334155" />
          <stop offset="100%" stopColor="#0F172A" />
        </linearGradient>
        <linearGradient id="printerPaperGrad" x1="16" y1="3" x2="16" y2="13" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#F1F5F9" />
        </linearGradient>
        <filter id="printerShadow" x="0" y="0" width="32" height="32" filterUnits="userSpaceOnUse">
          <feDropShadow dx="0" dy="1.5" stdDeviation="1.5" floodColor="#000000" floodOpacity="0.25" />
        </filter>
      </defs>

      <g filter="url(#printerShadow)">
        {/* Receipt Paper Slip */}
        <path
          d="M8 13V4.2L9.5 3L11 4.2L12.5 3L14 4.2L15.5 3L17 4.2L18.5 3L20 4.2L21.5 3L23 4.2L24 3V13H8Z"
          fill="url(#printerPaperGrad)"
          stroke="#CBD5E1"
          strokeWidth="0.8"
        />

        {/* Printed Lines on Ticket */}
        <line x1="10.5" y1="6" x2="21.5" y2="6" stroke="#94A3B8" strokeWidth="1.2" strokeLinecap="round" />
        <line x1="10.5" y1="8.5" x2="17.5" y2="8.5" stroke="#CBD5E1" strokeWidth="1.2" strokeLinecap="round" />
        <line x1="10.5" y1="11" x2="19.5" y2="11" stroke="#94A3B8" strokeWidth="1" strokeLinecap="round" />

        {/* Printer Main Chassis */}
        <rect
          x="4"
          y="12"
          width="24"
          height="16"
          rx="3.5"
          fill="url(#printerBodyGrad)"
          stroke="#1E293B"
          strokeWidth="1"
        />

        {/* Paper Exit Mouth / Slot */}
        <rect x="7" y="11.5" width="18" height="2.5" rx="1.25" fill="#020617" />

        {/* Front Panel Lip Line */}
        <line x1="4" y1="18.5" x2="28" y2="18.5" stroke="#1E293B" strokeWidth="0.8" />

        {/* LED Indicator Glow Ring */}
        <circle cx="8" cy="23" r="2.8" fill={ledColor} fillOpacity="0.35" />
        {/* LED Core */}
        <circle cx="8" cy="23" r="1.5" fill={ledColor} />

        {/* Feed Button */}
        <rect x="20" y="22" width="4.5" height="2" rx="1" fill="#475569" />
      </g>
    </svg>
  );
}

export default PrinterIllustration;
