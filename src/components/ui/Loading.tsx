'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ChefHat } from 'lucide-react';

/* =========================================================================
   Types & Interfaces
   ========================================================================= */

export type LoadingVariant = 'bars' | 'cup' | 'spinner' | 'kitchen' | 'pulse' | 'dots' | 'bar';
export type LoadingSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number;
export type LoadingLayout = 'inline' | 'area' | 'page' | 'fullscreen';

export interface LoadingConfig {
  defaultVariant?: LoadingVariant;
  defaultSize?: LoadingSize;
  defaultColor?: string;
  defaultLayout?: LoadingLayout;
  brandName?: string;
}

export interface LoadingProps {
  /** Visual variant: 'cup' | 'spinner' | 'kitchen' | 'pulse' | 'dots' | 'bar' */
  variant?: LoadingVariant;
  /** Size preset ('xs' | 'sm' | 'md' | 'lg' | 'xl') or pixel number */
  size?: LoadingSize;
  /** Primary accent color (defaults to CSS var(--primary) or #971345) */
  color?: string;
  /** Layout mode: 'inline' | 'area' | 'page' | 'fullscreen' */
  layout?: LoadingLayout;
  /** Main loading message or title */
  text?: React.ReactNode;
  /** Secondary subtitle or description */
  description?: React.ReactNode;
  /** Custom CSS class */
  className?: string;
  /** Custom inline styles */
  style?: React.CSSProperties;
  /** Backdrop blur intensity for fullscreen (default: '8px') */
  backdropBlur?: string;
  /** Whether loading is currently active (defaults to true) */
  active?: boolean;
}

/* =========================================================================
   Global Configuration State & Controller (Singleton)
   ========================================================================= */

let _globalConfig: LoadingConfig = {
  defaultVariant: 'bars',
  defaultSize: 'md',
  defaultColor: 'var(--primary)',
  defaultLayout: 'area',
  brandName: 'Renjz Kitchen',
};

type GlobalListener = (state: { active: boolean; text?: ReactNode; description?: ReactNode }) => void;
const _listeners = new Set<GlobalListener>();
let _globalState = { active: false, text: undefined as ReactNode, description: undefined as ReactNode };

export function setGlobalLoadingConfig(config: Partial<LoadingConfig>) {
  _globalConfig = { ..._globalConfig, ...config };
}

export function getGlobalLoadingConfig(): LoadingConfig {
  return { ..._globalConfig };
}

export const globalLoading = {
  show(text?: ReactNode, description?: ReactNode) {
    _globalState = { active: true, text, description };
    _listeners.forEach((fn) => fn(_globalState));
  },
  hide() {
    _globalState = { active: false, text: undefined, description: undefined };
    _listeners.forEach((fn) => fn(_globalState));
  },
  toggle(text?: ReactNode, description?: ReactNode) {
    if (_globalState.active) {
      this.hide();
    } else {
      this.show(text, description);
    }
  },
};

/* =========================================================================
   Context & Hook for React Component Trees
   ========================================================================= */

interface LoadingContextValue {
  config: LoadingConfig;
  updateConfig: (newConfig: Partial<LoadingConfig>) => void;
  isLoading: boolean;
  showLoading: (text?: ReactNode, description?: ReactNode) => void;
  hideLoading: () => void;
  text?: ReactNode;
  description?: ReactNode;
}

const LoadingContext = createContext<LoadingContextValue | null>(null);

export function LoadingProvider({
  children,
  initialConfig,
}: {
  children: ReactNode;
  initialConfig?: Partial<LoadingConfig>;
}) {
  const [config, setConfig] = useState<LoadingConfig>(() => ({
    ..._globalConfig,
    ...initialConfig,
  }));
  const [state, setState] = useState<{ active: boolean; text?: ReactNode; description?: ReactNode }>({
    active: false,
    text: undefined,
    description: undefined,
  });

  useEffect(() => {
    const listener: GlobalListener = (newState) => setState(newState);
    _listeners.add(listener);
    return () => {
      _listeners.delete(listener);
    };
  }, []);

  const updateConfig = (newConfig: Partial<LoadingConfig>) => {
    setConfig((prev) => {
      const updated = { ...prev, ...newConfig };
      setGlobalLoadingConfig(updated);
      return updated;
    });
  };

  const showLoading = (text?: ReactNode, description?: ReactNode) => {
    globalLoading.show(text, description);
  };

  const hideLoading = () => {
    globalLoading.hide();
  };

  return (
    <LoadingContext.Provider
      value={{
        config,
        updateConfig,
        isLoading: state.active,
        showLoading,
        hideLoading,
        text: state.text,
        description: state.description,
      }}
    >
      {children}
      {state.active && (
        <Loading
          layout="fullscreen"
          text={state.text || 'Loading...'}
          description={state.description}
          variant={config.defaultVariant}
          color={config.defaultColor}
        />
      )}
    </LoadingContext.Provider>
  );
}

export function useLoading() {
  const ctx = useContext(LoadingContext);
  if (!ctx) {
    // Graceful fallback to global singleton if outside provider
    return {
      config: getGlobalLoadingConfig(),
      updateConfig: setGlobalLoadingConfig,
      isLoading: _globalState.active,
      showLoading: globalLoading.show.bind(globalLoading),
      hideLoading: globalLoading.hide.bind(globalLoading),
      text: _globalState.text,
      description: _globalState.description,
    };
  }
  return ctx;
}

/* =========================================================================
   Size Helpers
   ========================================================================= */

function resolveSizePx(size: LoadingSize = 'md'): number {
  if (typeof size === 'number') return size;
  switch (size) {
    case 'xs':
      return 14;
    case 'sm':
      return 18;
    case 'md':
      return 28;
    case 'lg':
      return 42;
    case 'xl':
      return 56;
    default:
      return 28;
  }
}

/* =========================================================================
   Visual Sub-components
   ========================================================================= */

/** 1. Dual-Ring Glowing Modern Spinner */
function SpinnerGraphic({ sizePx, color }: { sizePx: number; color: string }) {
  const strokeWidth = Math.max(2, Math.round(sizePx * 0.09));
  const radius = (sizePx - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * 0.35;

  return (
    <div
      style={{
        position: 'relative',
        width: sizePx,
        height: sizePx,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <svg
        width={sizePx}
        height={sizePx}
        viewBox={`0 0 ${sizePx} ${sizePx}`}
        style={{
          animation: 'devouSpin 0.9s cubic-bezier(0.45, 0.05, 0.55, 0.95) infinite',
          transformOrigin: 'center',
        }}
      >
        {/* Track circle */}
        <circle
          cx={sizePx / 2}
          cy={sizePx / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          opacity="0.15"
        />
        {/* Animated accent arc */}
        <circle
          cx={sizePx / 2}
          cy={sizePx / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
        />
      </svg>
      {/* Subtle inner pulse for larger sizes */}
      {sizePx >= 36 && (
        <div
          style={{
            position: 'absolute',
            width: sizePx * 0.28,
            height: sizePx * 0.28,
            borderRadius: '50%',
            backgroundColor: color,
            opacity: 0.25,
            animation: 'devouPulse 1.4s ease-in-out infinite',
          }}
        />
      )}
    </div>
  );
}

/** 2. Animated Kitchen / Chef Cloche with Glow & Rings */
function KitchenGraphic({ sizePx, color }: { sizePx: number; color: string }) {
  const containerSize = Math.max(sizePx, 52);
  const iconSize = Math.round(containerSize * 0.44);

  return (
    <div
      style={{
        position: 'relative',
        width: containerSize,
        height: containerSize,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      {/* Outer ripple wave 1 */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          border: `2px solid ${color}`,
          opacity: 0.2,
          animation: 'devouRipple 1.8s cubic-bezier(0, 0.2, 0.8, 1) infinite',
        }}
      />
      {/* Outer ripple wave 2 */}
      <div
        style={{
          position: 'absolute',
          inset: 4,
          borderRadius: '50%',
          border: `2px solid ${color}`,
          opacity: 0.3,
          animation: 'devouRipple 1.8s cubic-bezier(0, 0.2, 0.8, 1) infinite',
          animationDelay: '0.6s',
        }}
      />
      {/* Inner glowing circle */}
      <div
        style={{
          position: 'relative',
          width: containerSize * 0.76,
          height: containerSize * 0.76,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${color} 0%, rgba(151,19,69,0.85) 100%)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#FFFFFF',
          boxShadow: `0 8px 24px -4px ${color}66`,
          animation: 'devouFloat 2.2s ease-in-out infinite',
        }}
      >
        <ChefHat size={iconSize} strokeWidth={2.2} />
      </div>
    </div>
  );
}

/** 3. Pulse Graphic */
function PulseGraphic({ sizePx, color }: { sizePx: number; color: string }) {
  return (
    <div
      style={{
        position: 'relative',
        width: sizePx,
        height: sizePx,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          backgroundColor: color,
          opacity: 0.25,
          animation: 'devouPing 1.2s cubic-bezier(0, 0, 0.2, 1) infinite',
        }}
      />
      <div
        style={{
          width: sizePx * 0.65,
          height: sizePx * 0.65,
          borderRadius: '50%',
          backgroundColor: color,
          boxShadow: `0 0 12px ${color}88`,
          animation: 'devouPulse 1.2s ease-in-out infinite',
        }}
      />
    </div>
  );
}

/** 4. Three Bouncing Gradient Dots */
function DotsGraphic({ sizePx, color }: { sizePx: number; color: string }) {
  const dotSize = Math.max(5, Math.round(sizePx * 0.25));
  const gap = Math.max(4, Math.round(dotSize * 0.6));

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap,
        height: sizePx,
        flexShrink: 0,
      }}
    >
      {[0, 0.18, 0.36].map((delay, i) => (
        <span
          key={i}
          style={{
            width: dotSize,
            height: dotSize,
            borderRadius: '50%',
            backgroundColor: color,
            display: 'inline-block',
            animation: 'devouBounce 1s cubic-bezier(0.28, 0.84, 0.42, 1) infinite',
            animationDelay: `${delay}s`,
          }}
        />
      ))}
    </div>
  );
}

/** 5. Thin Indeterminate Progress Bar */
function BarGraphic({ color }: { color: string }) {
  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: '220px',
        height: '4px',
        borderRadius: '999px',
        backgroundColor: 'rgba(151,19,69,0.12)',
        overflow: 'hidden',
        margin: '6px 0',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          borderRadius: '999px',
          backgroundColor: color,
          animation: 'devouBar 1.4s ease-in-out infinite',
        }}
      />
    </div>
  );
}

/** 0. Animated Equalizer / Bars Loader (User's Brand Animation) */
function BarsLoaderGraphic({ color }: { color?: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        margin: 'auto',
      }}
    >
      <div
        className="loader"
        style={color && color !== 'var(--primary)' ? { ['--loader-color' as any]: color } : undefined}
      />
    </div>
  );
}

/* =========================================================================
   Main Loading Component
   ========================================================================= */

export function Loading({
  variant,
  size,
  color,
  layout,
  text,
  description,
  className = '',
  style,
  backdropBlur = '8px',
  active = true,
}: LoadingProps) {
  const ctx = useContext(LoadingContext);
  const cfg = ctx?.config || _globalConfig;

  if (!active) return null;

  // Resolve defaults from global config or fallback
  const resolvedVariant = variant || cfg.defaultVariant || 'bars';
  const resolvedSize = size !== undefined ? size : cfg.defaultSize || 'md';
  const resolvedColor = color || cfg.defaultColor || 'var(--primary)';
  const resolvedLayout = layout || (text || description ? 'area' : cfg.defaultLayout || 'inline');
  const sizePx = resolveSizePx(resolvedSize);

  // Render visual graphic
  const renderGraphic = () => {
    switch (resolvedVariant) {
      case 'bars':
        return <BarsLoaderGraphic color={resolvedColor} />;
      case 'kitchen':
        return <KitchenGraphic sizePx={sizePx} color={resolvedColor} />;
      case 'pulse':
        return <PulseGraphic sizePx={sizePx} color={resolvedColor} />;
      case 'dots':
        return <DotsGraphic sizePx={sizePx} color={resolvedColor} />;
      case 'bar':
        return <BarGraphic color={resolvedColor} />;
      case 'spinner':
        return <SpinnerGraphic sizePx={sizePx} color={resolvedColor} />;
      default:
        return <BarsLoaderGraphic color={resolvedColor} />;
    }
  };

  /* ---------------- Layout: INLINE ---------------- */
  if (resolvedLayout === 'inline') {
    return (
      <span
        className={`devou-loading-inline ${className}`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          verticalAlign: 'middle',
          ...style,
        }}
      >
        {renderGraphic()}
        {text && (
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'inherit' }}>
            {text}
          </span>
        )}
      </span>
    );
  }

  /* ---------------- Layout: FULLSCREEN ---------------- */
  if (resolvedLayout === 'fullscreen') {
    return (
      <div
        className={`devou-loading-fullscreen ${className}`}
        role="dialog"
        aria-modal="true"
        aria-label="Loading"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 999999,
          background: 'rgba(15, 23, 42, 0.45)',
          backdropFilter: `blur(${backdropBlur})`,
          WebkitBackdropFilter: `blur(${backdropBlur})`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px',
          boxSizing: 'border-box',
          animation: 'devouFadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards',
          ...style,
        }}
      >
        <div
          style={{
            background: '#FFFFFF',
            border: '1px solid rgba(226, 232, 240, 0.9)',
            boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.25), 0 0 0 1px rgba(15, 23, 42, 0.05)',
            borderRadius: '16px',
            padding: '28px 36px',
            maxWidth: '360px',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            boxSizing: 'border-box',
            animation: 'devouScaleIn 0.24s cubic-bezier(0.16, 1, 0.3, 1) forwards',
          }}
        >
          {renderGraphic()}

          {text && (
            <div
              style={{
                fontSize: '16px',
                fontWeight: 700,
                color: '#0F172A',
                marginTop: '16px',
                letterSpacing: '-0.01em',
              }}
            >
              {text}
            </div>
          )}

          {description && (
            <div
              style={{
                fontSize: '13px',
                color: '#64748B',
                marginTop: '4px',
                lineHeight: 1.45,
              }}
            >
              {description}
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ---------------- Layout: PAGE ---------------- */
  if (resolvedLayout === 'page') {
    return (
      <div
        className={`devou-loading-page ${className}`}
        style={{
          minHeight: '60vh',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px 20px',
          boxSizing: 'border-box',
          textAlign: 'center',
          animation: 'devouFadeIn 0.2s ease forwards',
          ...style,
        }}
      >
        {renderGraphic()}

        {text && (
          <div
            style={{
              fontSize: '15px',
              fontWeight: 700,
              color: '#0F172A',
              marginTop: '14px',
              letterSpacing: '-0.01em',
            }}
          >
            {text}
          </div>
        )}

        {description && (
          <div
            style={{
              fontSize: '13px',
              color: '#64748B',
              marginTop: '4px',
              maxWidth: '320px',
              lineHeight: 1.45,
            }}
          >
            {description}
          </div>
        )}
      </div>
    );
  }

  /* ---------------- Layout: AREA (Containers, Cards, Tables) ---------------- */
  return (
    <div
      className={`devou-loading-area ${className}`}
      style={{
        width: '100%',
        flex: 1,
        minHeight: '300px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        boxSizing: 'border-box',
        textAlign: 'center',
        margin: 'auto',
        animation: 'devouFadeIn 0.2s ease forwards',
        ...style,
      }}
    >
      {renderGraphic()}

      {text && (
        <div
          style={{
            fontSize: '14px',
            fontWeight: 600,
            color: '#1E293B',
            marginTop: '10px',
          }}
        >
          {text}
        </div>
      )}

      {description && (
        <div
          style={{
            fontSize: '12px',
            color: '#64748B',
            marginTop: '2px',
          }}
        >
          {description}
        </div>
      )}
    </div>
  );
}

/* =========================================================================
   Convenience Named Aliases
   ========================================================================= */

export const LoadingSpinner = (props: Omit<LoadingProps, 'variant'>) => (
  <Loading {...props} variant="spinner" />
);

export const LoadingScreen = (props: Omit<LoadingProps, 'layout'>) => (
  <Loading {...props} layout="fullscreen" />
);

export const LoadingArea = (props: Omit<LoadingProps, 'layout'>) => (
  <Loading {...props} layout="area" />
);

export const GlobalLoadingScreen = () => {
  const { isLoading, text, description, config } = useLoading();
  if (!isLoading) return null;
  return (
    <Loading
      layout="fullscreen"
      text={text || 'Please wait...'}
      description={description}
      variant={config.defaultVariant}
      color={config.defaultColor}
    />
  );
};

export default Loading;
