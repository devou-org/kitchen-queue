'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import toast from 'react-hot-toast';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  KeyRound,
  ShieldCheck,
  RefreshCw,
  Store,
  Loader2,
} from 'lucide-react';
import { authService } from '@/app/services/auth.api';
import { useRestaurant } from '@/hooks/useRestaurant';

type ViewMode = 'LOGIN' | 'FORGOT_PASSWORD' | 'RESET_PASSWORD';

export default function AdminLogin() {
  const router = useRouter();
  const { slug } = useParams();
  const slugStr = (Array.isArray(slug) ? slug[0] : slug) || '';
  const { restaurant, loading: resLoading } = useRestaurant();

  // Primary brand color
  const primaryColor = restaurant?.primary_color || '#065f46';

  // Login form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Forgot / Reset Password State
  const [viewMode, setViewMode] = useState<ViewMode>('LOGIN');
  const [resetEmail, setResetEmail] = useState('');
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  // Resend countdown timer
  const [countdown, setCountdown] = useState<number>(0);
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Focus input state for active borders
  const [focusedInput, setFocusedInput] = useState<string | null>(null);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const getTargetRoute = (user: any) => {
    const showOrdering = restaurant?.modules?.ONLINE_ORDERING !== false;
    const showQueue = restaurant?.modules?.QUEUE_MANAGEMENT !== false;

    if (user?.is_admin || (user?.permissions && user.permissions.includes('*'))) {
      return showOrdering ? 'orders' : showQueue ? 'queue' : 'products';
    }

    const perms: string[] = user?.permissions || [];
    if (perms.includes('pos') && showOrdering) return 'pos';
    if (perms.includes('orders') && showOrdering) return 'orders';
    if (perms.includes('tables')) return 'tables';
    if (perms.includes('products')) return 'products';
    if (perms.includes('inventory')) return 'inventory';
    if (perms.includes('finance')) return 'finance';
    if (perms.includes('analytics') && showOrdering) return 'analytics/sales';
    if (perms.includes('staff')) return 'staff';
    if (perms.includes('billing')) return 'billing';
    if (perms.includes('settings')) return 'settings';

    return showOrdering ? 'orders' : 'products';
  };

  useEffect(() => {
    const checkAuth = async () => {
      const hasCookie = document.cookie.split('; ').find((row) => row.startsWith('admin_logged_in='));
      if (hasCookie) {
        const res = await authService.refresh();
        if (res.success && (res.user?.is_admin || res.user?.is_staff)) {
          const target = getTargetRoute(res.user);
          window.location.assign(`/${slugStr}/admin/${target}`);
        }
      }
    };
    checkAuth();
  }, [slugStr, restaurant]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return toast.error('Email and password are required');

    setLoading(true);
    try {
      const data = await authService.adminLogin(email.trim().toLowerCase(), password);
      if (data.success) {
        const target = getTargetRoute(data.user);
        toast.success(`Welcome back, ${data.user?.name || 'Admin'}!`);
        window.location.assign(`/${slugStr}/admin/${target}`);
      } else {
        toast.error(data.error || 'Invalid credentials');
      }
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestResetOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!resetEmail || !resetEmail.trim()) {
      return toast.error('Please enter your admin email address');
    }

    setResetLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetEmail.trim().toLowerCase() }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Verification code sent to your email!');
        setViewMode('RESET_PASSWORD');
        setCountdown(60);
        setOtpDigits(['', '', '', '', '', '']);
        setTimeout(() => otpInputRefs.current[0]?.focus(), 150);
      } else {
        toast.error(data.error || 'Failed to send reset code');
      }
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setResetLoading(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    const cleanVal = value.replace(/\D/g, '');
    if (!cleanVal) {
      const newDigits = [...otpDigits];
      newDigits[index] = '';
      setOtpDigits(newDigits);
      return;
    }

    if (cleanVal.length > 1) {
      const pastedChars = cleanVal.slice(0, 6).split('');
      const newDigits = [...otpDigits];
      pastedChars.forEach((ch, idx) => {
        if (index + idx < 6) newDigits[index + idx] = ch;
      });
      setOtpDigits(newDigits);
      const nextFocus = Math.min(index + pastedChars.length, 5);
      otpInputRefs.current[nextFocus]?.focus();
      return;
    }

    const newDigits = [...otpDigits];
    newDigits[index] = cleanVal;
    setOtpDigits(newDigits);

    if (index < 5 && cleanVal) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowLeft' && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleConfirmReset = async (e: React.FormEvent) => {
    e.preventDefault();
    const fullOtp = otpDigits.join('').trim();
    if (fullOtp.length !== 6) {
      return toast.error('Please enter the full 6-digit verification code');
    }
    if (!newPassword || newPassword.length < 6) {
      return toast.error('Password must be at least 6 characters long');
    }
    if (newPassword !== confirmPassword) {
      return toast.error('Passwords do not match');
    }

    setResetLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: resetEmail.trim().toLowerCase(),
          otp: fullOtp,
          new_password: newPassword,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Password updated successfully! Signing you in...');
        const loginRes = await authService.adminLogin(resetEmail.trim().toLowerCase(), newPassword);
        if (loginRes.success) {
          const target = getTargetRoute(loginRes.user);
          window.location.assign(`/${slugStr}/admin/${target}`);
        } else {
          setEmail(resetEmail);
          setPassword('');
          setViewMode('LOGIN');
          toast.success('Please sign in with your new password.');
        }
      } else {
        toast.error(data.error || 'Failed to reset password');
      }
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setResetLoading(false);
    }
  };

  if (resLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8FAFC' }}>
        <Loader2 size={32} className="animate-spin" style={{ color: '#94A3B8' }} />
      </div>
    );
  }

  const isPasswordsMatching = confirmPassword.length > 0 && newPassword === confirmPassword;

  // Reusable input style generator for rock-solid cross-browser rendering
  const getInputStyle = (inputName: string, hasLeftIcon = true, hasRightIcon = false) => {
    const isFocused = focusedInput === inputName;
    return {
      width: '100%',
      height: '46px',
      boxSizing: 'border-box' as const,
      paddingLeft: hasLeftIcon ? '42px' : '14px',
      paddingRight: hasRightIcon ? '42px' : '14px',
      backgroundColor: '#F8FAFC',
      border: `1.5px solid ${isFocused ? primaryColor : '#E2E8F0'}`,
      boxShadow: isFocused ? `0 0 0 3px ${primaryColor}20` : 'none',
      borderRadius: '12px',
      fontSize: '14.5px',
      color: '#0F172A',
      outline: 'none',
      transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
    };
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px 16px',
      backgroundColor: '#F8FAFC',
      position: 'relative',
      overflow: 'hidden',
      boxSizing: 'border-box',
    }}>

      {/* Ambient background glow */}
      <div style={{
        position: 'absolute',
        top: '-150px',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '650px',
        height: '400px',
        borderRadius: '50%',
        background: `radial-gradient(circle, ${primaryColor}18 0%, transparent 70%)`,
        pointerEvents: 'none',
        zIndex: 0,
      }} />

      {/* Main Elevated Card */}
      <div style={{
        position: 'relative',
        width: '100%',
        maxWidth: '430px',
        backgroundColor: '#FFFFFF',
        borderRadius: '24px',
        boxShadow: '0 20px 40px -15px rgba(0,0,0,0.07), 0 0 0 1px rgba(0,0,0,0.05)',
        padding: '36px 32px',
        zIndex: 10,
        boxSizing: 'border-box',
      }}>

        {/* Brand Logo & Header */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBottom: '24px' }}>
          
          <div style={{
            width: '68px',
            height: '68px',
            borderRadius: '18px',
            backgroundColor: '#FFFFFF',
            border: '1px solid #E2E8F0',
            boxShadow: '0 4px 14px rgba(0,0,0,0.06)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '14px',
            overflow: 'hidden',
            padding: '6px',
            boxSizing: 'border-box',
          }}>
            {restaurant?.logo_url ? (
              <img
                src={restaurant.logo_url}
                alt={restaurant.name || 'Brand Logo'}
                style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '12px' }}
              />
            ) : (
              <div style={{
                width: '100%',
                height: '100%',
                borderRadius: '12px',
                backgroundColor: primaryColor,
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 900,
                fontSize: '26px',
              }}>
                {restaurant?.name ? restaurant.name.charAt(0).toUpperCase() : 'Q'}
              </div>
            )}
          </div>

          {/* Context Badge */}
          {viewMode === 'LOGIN' && (
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 12px',
              borderRadius: '9999px',
              fontSize: '11.5px',
              fontWeight: 600,
              backgroundColor: '#F1F5F9',
              color: '#475569',
              marginBottom: '10px',
            }}>
              <Store size={14} style={{ color: '#64748B' }} />
              Kitchen & Store Portal
            </span>
          )}
          {viewMode === 'FORGOT_PASSWORD' && (
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 12px',
              borderRadius: '9999px',
              fontSize: '11.5px',
              fontWeight: 600,
              backgroundColor: '#FEF3C7',
              color: '#B45309',
              border: '1px solid #FDE68A',
              marginBottom: '10px',
            }}>
              <KeyRound size={14} style={{ color: '#D97706' }} />
              Password Recovery
            </span>
          )}
          {viewMode === 'RESET_PASSWORD' && (
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 12px',
              borderRadius: '9999px',
              fontSize: '11.5px',
              fontWeight: 600,
              backgroundColor: '#ECFDF5',
              color: '#047857',
              border: '1px solid #A7F3D0',
              marginBottom: '10px',
            }}>
              <ShieldCheck size={14} style={{ color: '#059669' }} />
              Step 2 of 2: Verification
            </span>
          )}

          {/* Heading */}
          <h1 style={{
            fontSize: '23px',
            fontWeight: 800,
            color: '#0F172A',
            letterSpacing: '-0.02em',
            margin: '0 0 6px 0',
            lineHeight: 1.2,
          }}>
            {viewMode === 'LOGIN' && (restaurant?.name ? restaurant.name : 'Qdine Admin')}
            {viewMode === 'FORGOT_PASSWORD' && 'Reset Your Password'}
            {viewMode === 'RESET_PASSWORD' && 'Create New Password'}
          </h1>

          {/* Description */}
          {viewMode === 'LOGIN' && (
            <p style={{ fontSize: '13px', color: '#64748B', margin: 0 }}>
              Sign in to manage floor, orders, and kitchen operations
            </p>
          )}

          {viewMode === 'FORGOT_PASSWORD' && (
            <p style={{ fontSize: '13px', color: '#64748B', margin: 0, maxWidth: '320px', lineHeight: 1.45 }}>
              Enter your registered admin email to receive a secure 6-digit verification code.
            </p>
          )}

          {viewMode === 'RESET_PASSWORD' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
              <span style={{ fontSize: '12.5px', color: '#64748B' }}>Enter the 6-digit code sent to</span>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 12px',
                backgroundColor: '#F1F5F9',
                borderRadius: '9999px',
                border: '1px solid #E2E8F0',
                fontSize: '12px',
                color: '#1E293B',
              }}>
                <Mail size={13} style={{ color: '#64748B' }} />
                <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{resetEmail}</span>
                <button
                  type="button"
                  onClick={() => setViewMode('FORGOT_PASSWORD')}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: primaryColor,
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontSize: '11.5px',
                    marginLeft: '4px',
                    padding: 0,
                  }}
                >
                  Edit
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ==================================================== */}
        {/* VIEW 1: LOGIN FORM                                   */}
        {/* ==================================================== */}
        {viewMode === 'LOGIN' && (
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            
            {/* Email Field */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '11px',
                fontWeight: 700,
                color: '#475569',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                marginBottom: '7px',
              }}>
                Admin Email
              </label>
              <div style={{ position: 'relative', width: '100%', display: 'flex', alignItems: 'center' }}>
                <span style={{
                  position: 'absolute',
                  left: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  color: focusedInput === 'email' ? primaryColor : '#94A3B8',
                  pointerEvents: 'none',
                  zIndex: 2,
                  transition: 'color 0.15s ease',
                }}>
                  <Mail size={18} />
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onFocus={() => setFocusedInput('email')}
                  onBlur={() => setFocusedInput(null)}
                  placeholder="admin@restaurant.com"
                  autoComplete="email"
                  required
                  style={getInputStyle('email', true, false)}
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '7px' }}>
                <label style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  color: '#475569',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  margin: 0,
                }}>
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setResetEmail(email || '');
                    setViewMode('FORGOT_PASSWORD');
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: primaryColor,
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  Forgot Password?
                </button>
              </div>

              <div style={{ position: 'relative', width: '100%', display: 'flex', alignItems: 'center' }}>
                <span style={{
                  position: 'absolute',
                  left: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  color: focusedInput === 'password' ? primaryColor : '#94A3B8',
                  pointerEvents: 'none',
                  zIndex: 2,
                  transition: 'color 0.15s ease',
                }}>
                  <Lock size={18} />
                </span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setFocusedInput('password')}
                  onBlur={() => setFocusedInput(null)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                  style={getInputStyle('password', true, true)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    background: 'none',
                    border: 'none',
                    color: '#94A3B8',
                    cursor: 'pointer',
                    padding: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 2,
                  }}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                height: '48px',
                borderRadius: '12px',
                backgroundColor: primaryColor,
                color: '#FFFFFF',
                fontWeight: 700,
                fontSize: '14.5px',
                border: 'none',
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 4px 14px rgba(0,0,0,0.12)',
                marginTop: '6px',
                opacity: loading ? 0.7 : 1,
                transition: 'all 0.15s ease',
              }}
            >
              {loading ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                <>
                  <span>Secure Sign In</span>
                  <ArrowRight size={17} />
                </>
              )}
            </button>
          </form>
        )}

        {/* ==================================================== */}
        {/* VIEW 2: FORGOT PASSWORD (EMAIL INPUT)                */}
        {/* ==================================================== */}
        {viewMode === 'FORGOT_PASSWORD' && (
          <form onSubmit={handleRequestResetOtp} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div>
              <label style={{
                display: 'block',
                fontSize: '11px',
                fontWeight: 700,
                color: '#475569',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                marginBottom: '7px',
              }}>
                Registered Admin Email
              </label>
              <div style={{ position: 'relative', width: '100%', display: 'flex', alignItems: 'center' }}>
                <span style={{
                  position: 'absolute',
                  left: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  color: focusedInput === 'resetEmail' ? primaryColor : '#94A3B8',
                  pointerEvents: 'none',
                  zIndex: 2,
                }}>
                  <Mail size={18} />
                </span>
                <input
                  type="email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  onFocus={() => setFocusedInput('resetEmail')}
                  onBlur={() => setFocusedInput(null)}
                  placeholder="admin@restaurant.com"
                  autoFocus
                  required
                  style={getInputStyle('resetEmail', true, false)}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={resetLoading}
              style={{
                width: '100%',
                height: '48px',
                borderRadius: '12px',
                backgroundColor: primaryColor,
                color: '#FFFFFF',
                fontWeight: 700,
                fontSize: '14.5px',
                border: 'none',
                cursor: resetLoading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 4px 14px rgba(0,0,0,0.12)',
                marginTop: '6px',
                opacity: resetLoading ? 0.7 : 1,
              }}
            >
              {resetLoading ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                <>
                  <span>Send Verification Code</span>
                  <ArrowRight size={17} />
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => setViewMode('LOGIN')}
              style={{
                background: 'none',
                border: 'none',
                color: '#64748B',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                padding: '6px',
              }}
            >
              <ArrowLeft size={15} />
              Back to Sign In
            </button>
          </form>
        )}

        {/* ==================================================== */}
        {/* VIEW 3: RESET PASSWORD (6-DIGIT OTP & NEW PASSWORD)  */}
        {/* ==================================================== */}
        {viewMode === 'RESET_PASSWORD' && (
          <form onSubmit={handleConfirmReset} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            {/* Segmented 6-Box OTP Input */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '11px',
                fontWeight: 700,
                color: '#475569',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                marginBottom: '10px',
                textAlign: 'center',
              }}>
                6-Digit Verification Code
              </label>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                {otpDigits.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={(el) => {
                      otpInputRefs.current[idx] = el;
                    }}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={idx === 0 ? 6 : 1}
                    value={digit}
                    onChange={(e) => handleOtpChange(idx, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                    style={{
                      width: '46px',
                      height: '54px',
                      textAlign: 'center',
                      fontFamily: 'monospace',
                      fontSize: '22px',
                      fontWeight: 800,
                      color: '#0F172A',
                      backgroundColor: '#F8FAFC',
                      border: `2px solid ${digit ? primaryColor : '#CBD5E1'}`,
                      borderRadius: '12px',
                      outline: 'none',
                      boxSizing: 'border-box',
                      transition: 'border-color 0.15s ease',
                    }}
                  />
                ))}
              </div>
            </div>

            {/* New Password */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '11px',
                fontWeight: 700,
                color: '#475569',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                marginBottom: '7px',
              }}>
                New Password
              </label>
              <div style={{ position: 'relative', width: '100%', display: 'flex', alignItems: 'center' }}>
                <span style={{
                  position: 'absolute',
                  left: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  color: focusedInput === 'newPassword' ? primaryColor : '#94A3B8',
                  pointerEvents: 'none',
                  zIndex: 2,
                }}>
                  <Lock size={18} />
                </span>
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  onFocus={() => setFocusedInput('newPassword')}
                  onBlur={() => setFocusedInput(null)}
                  placeholder="Min 6 characters"
                  minLength={6}
                  required
                  style={getInputStyle('newPassword', true, true)}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    background: 'none',
                    border: 'none',
                    color: '#94A3B8',
                    cursor: 'pointer',
                    padding: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 2,
                  }}
                  tabIndex={-1}
                >
                  {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Confirm New Password */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '7px' }}>
                <label style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  color: '#475569',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  margin: 0,
                }}>
                  Confirm Password
                </label>
                {isPasswordsMatching && (
                  <span style={{ fontSize: '11px', fontWeight: 600, color: '#059669', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <CheckCircle2 size={13} /> Passwords match
                  </span>
                )}
              </div>

              <div style={{ position: 'relative', width: '100%', display: 'flex', alignItems: 'center' }}>
                <span style={{
                  position: 'absolute',
                  left: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  color: focusedInput === 'confirmPassword' ? primaryColor : '#94A3B8',
                  pointerEvents: 'none',
                  zIndex: 2,
                }}>
                  <Lock size={18} />
                </span>
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  onFocus={() => setFocusedInput('confirmPassword')}
                  onBlur={() => setFocusedInput(null)}
                  placeholder="Re-type password"
                  minLength={6}
                  required
                  style={{
                    ...getInputStyle('confirmPassword', true, true),
                    borderColor:
                      confirmPassword && !isPasswordsMatching
                        ? '#F59E0B'
                        : isPasswordsMatching
                        ? '#10B981'
                        : focusedInput === 'confirmPassword'
                        ? primaryColor
                        : '#E2E8F0',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    background: 'none',
                    border: 'none',
                    color: '#94A3B8',
                    cursor: 'pointer',
                    padding: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 2,
                  }}
                  tabIndex={-1}
                >
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={resetLoading}
              style={{
                width: '100%',
                height: '48px',
                borderRadius: '12px',
                backgroundColor: primaryColor,
                color: '#FFFFFF',
                fontWeight: 700,
                fontSize: '14.5px',
                border: 'none',
                cursor: resetLoading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 4px 14px rgba(0,0,0,0.12)',
                marginTop: '4px',
                opacity: resetLoading ? 0.7 : 1,
              }}
            >
              {resetLoading ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                <>
                  <span>Update Password & Log In</span>
                  <ArrowRight size={17} />
                </>
              )}
            </button>

            {/* Secondary Actions: Resend Code & Back */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingTop: '12px',
              borderTop: '1px solid #F1F5F9',
              fontSize: '12px',
            }}>
              <button
                type="button"
                onClick={() => handleRequestResetOtp()}
                disabled={countdown > 0 || resetLoading}
                style={{
                  background: 'none',
                  border: 'none',
                  color: countdown > 0 ? '#94A3B8' : primaryColor,
                  fontWeight: 700,
                  cursor: countdown > 0 || resetLoading ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: 0,
                }}
              >
                <RefreshCw size={13} className={resetLoading ? 'animate-spin' : ''} />
                {countdown > 0 ? `Resend code in ${countdown}s` : 'Resend Code'}
              </button>

              <button
                type="button"
                onClick={() => setViewMode('LOGIN')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#64748B',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: 0,
                }}
              >
                <ArrowLeft size={13} />
                Back to Sign In
              </button>
            </div>
          </form>
        )}

      </div>

      {/* Footer Link */}
      <div style={{ marginTop: '20px', textAlign: 'center', zIndex: 10 }}>
        <a
          href={`/${slugStr}/menu`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '12.5px',
            color: '#64748B',
            textDecoration: 'none',
            fontWeight: 500,
          }}
        >
          <Store size={14} style={{ color: '#94A3B8' }} />
          <span>Back to Store Digital Menu</span>
        </a>
      </div>

    </div>
  );
}
