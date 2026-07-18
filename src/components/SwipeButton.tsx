'use client';
import React, { useState, useRef, useEffect } from 'react';
import { ChevronRight, Check } from 'lucide-react';

interface SwipeButtonProps {
  onConfirm: () => void | Promise<void | boolean> | boolean;
  text: string | React.ReactNode;
  disabled?: boolean;
  loading?: boolean;
  success?: boolean;
  color?: string;
  height?: string;
}

export default function SwipeButton({
  onConfirm,
  text,
  disabled = false,
  loading = false,
  success = false,
  color = 'var(--primary)',
  height = '56px',
}: SwipeButtonProps) {
  const [sliderWidth, setSliderWidth] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const hasConfirmed = useRef(false); // Guard against duplicate submissions
  const prevLoading = useRef(false);  // Track loading transitions
  const isCompleted = confirmed || success;

  useEffect(() => {
    // Only reset if loading just finished (true→false) without success.
    // This handles failed requests (e.g. network error) so the user can retry.
    // We deliberately do NOT reset on isDragging change — that caused the
    // immediate-reset glitch (effect saw !loading && !success && !isDragging
    // all true right after handleConfirm set isDragging=false).
    if (prevLoading.current && !loading && !success) {
      setConfirmed(false);
      setSliderWidth(0);
      hasConfirmed.current = false;
    }
    prevLoading.current = loading;

    if (success) {
      setSliderWidth(100);
      setConfirmed(true);
    }
  }, [loading, success]);

  const handleStart = (clientX: number) => {
    if (disabled || loading || isCompleted) return;
    setIsDragging(true);
  };

  const handleMove = (clientX: number) => {
    if (!isDragging || !containerRef.current || disabled || loading || isCompleted) return;

    const rect = containerRef.current.getBoundingClientRect();
    const handleWidth = 48; // width of button handle
    const containerWidth = rect.width;
    
    let x = clientX - rect.left - (handleWidth / 2);
    const maxX = containerWidth - handleWidth;
    
    x = Math.max(0, Math.min(x, maxX));
    
    const percentage = (x / maxX) * 100;
    setSliderWidth(percentage);

    if (percentage >= 98) {
      handleConfirm();
    }
  };

  const handleEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);
    
    if (sliderWidth < 98) {
      setSliderWidth(0);
    }
  };

  const handleConfirm = async () => {
    if (hasConfirmed.current) return; // Prevent duplicate calls
    hasConfirmed.current = true;
    setIsDragging(false);
    setSliderWidth(100);
    setConfirmed(true);
    
    try {
      const result = await onConfirm();
      if (result === false) {
         setConfirmed(false);
         setSliderWidth(0);
         hasConfirmed.current = false;
         return;
      }
      
      // Auto-reset if validation failed without returning false (no loading state was triggered)
      setTimeout(() => {
        if (!loading && !success && !prevLoading.current) {
          setConfirmed(false);
          setSliderWidth(0);
          hasConfirmed.current = false;
        }
      }, 50);

    } catch (err) {
      setConfirmed(false);
      setSliderWidth(0);
      hasConfirmed.current = false;
    }
  };

  useEffect(() => {
    const onPointerMove = (e: PointerEvent) => {
      if (isDragging) {
        handleMove(e.clientX);
      }
    };
    const onPointerUp = () => {
      if (isDragging) {
        handleEnd();
      }
    };

    if (isDragging) {
      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
      // Fallback for some touch devices
      const onTouchMove = (e: TouchEvent) => handleMove(e.touches[0].clientX);
      window.addEventListener('touchmove', onTouchMove, { passive: false });
      window.addEventListener('touchend', handleEnd);
      
      return () => {
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
        window.removeEventListener('touchmove', onTouchMove);
        window.removeEventListener('touchend', handleEnd);
      };
    }
  }, [isDragging, sliderWidth]);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        height: height,
        backgroundColor: disabled ? '#cbd5e1' : color, // Full primary background
        borderRadius: '999px',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled && !loading && !success ? 0.6 : 1,
        touchAction: 'none',
        boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
        userSelect: 'none',
      }}
    >
      {/* The white background fill that expands as we swipe */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: `calc(56px + (100% - 56px) * ${sliderWidth / 100})`,
          backgroundColor: 'white',
          borderRadius: '999px',
          transition: isDragging ? 'none' : 'width 0.3s ease-out',
          zIndex: 1,
        }}
      />

      {loading && !success && (
        <div style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: color,
          zIndex: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontWeight: 700
        }}>
          <span className="loader" style={{ width: 18, height: 18, borderWidth: 2, marginRight: '8px' }} /> Processing...
        </div>
      )}

      {success && (
        <div style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: 'white',
          zIndex: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#10b981',
          fontWeight: 700,
          animation: 'fadeIn 0.3s ease-out'
        }}>
          <Check size={20} style={{ marginRight: '6px' }} /> Confirmed!
        </div>
      )}

      <div
        style={{
          position: 'relative',
          zIndex: 2,
          color: sliderWidth > 50 ? '#10b981' : 'white',
          fontWeight: 700,
          transition: 'color 0.2s',
          pointerEvents: 'none',
          opacity: isCompleted || loading ? 0 : 1,
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}
      >
        {text}
      </div>

      <div
        onPointerDown={(e) => handleStart(e.clientX)}
        style={{
          position: 'absolute',
          left: `calc(4px + (100% - 56px) * (${sliderWidth} / 100))`, // 4px padding
          top: '4px', 
          width: '48px',
          height: '48px',
          borderRadius: '50%',
          backgroundColor: 'white', // White handle
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 3,
          cursor: disabled || loading || isCompleted ? 'not-allowed' : 'grab',
          transition: isDragging ? 'none' : 'left 0.3s ease-out',
          opacity: isCompleted || loading ? 0 : 1,
        }}
      >
        <div style={{ display: 'flex', opacity: isDragging ? 0.7 : 1, marginLeft: '6px' }}>
          <ChevronRight size={22} color={color} style={{ marginRight: '-12px' }} />
          <ChevronRight size={22} color={color} style={{ marginRight: '-12px' }} />
          <ChevronRight size={22} color={color} />
        </div>
      </div>
    </div>
  );
}
