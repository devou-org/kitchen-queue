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

  // Primary color fallback
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

  // Timer countdown hook
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  // Route target decider based on user permissions & restaurant modules
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
    if (perms.includes('analytics') && showOrdering) return 'analytics';
    if (perms.includes('staff')) return 'staff';
    if (perms.includes('billing')) return 'billing';
    if (perms.includes('settings')) return 'settings';

    return showOrdering ? 'orders' : 'products';
  };

  // Check already logged in session
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

  // Handle standard admin login
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

  // Step 1: Request 6-digit OTP code to email
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
        setCountdown(60); // 60s cooldown for resend
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

  // Step 2: Handle OTP box typing & pasting
  const handleOtpChange = (index: number, value: string) => {
    // Only accept numeric inputs
    const cleanVal = value.replace(/\D/g, '');
    if (!cleanVal) {
      const newDigits = [...otpDigits];
      newDigits[index] = '';
      setOtpDigits(newDigits);
      return;
    }

    // If user pasted multiple characters
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

    // Auto-advance to next box
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

  // Step 3: Confirm OTP & Save New Password
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
        // Auto-login with the updated credentials
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
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  const isPasswordsMatching = confirmPassword.length > 0 && newPassword === confirmPassword;

  return (
    <div className="min-h-screen relative flex flex-col items-center justify-center p-4 sm:p-6 bg-slate-50 antialiased overflow-hidden selection:bg-slate-900 selection:text-white">
      {/* Dynamic Brand Color Injection */}
      <style dangerouslySetInnerHTML={{
        __html: `
          :root {
            --brand-primary: ${primaryColor};
            --brand-ring: ${primaryColor}25;
          }
        `
      }} />

      {/* Elegant background ambient pattern & gradient */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[400px] rounded-full blur-3xl opacity-20"
          style={{ backgroundColor: primaryColor }}
        />
        <div className="absolute inset-0 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:24px_24px] opacity-40" />
      </div>

      {/* Main Elevated Card Container */}
      <div className="relative w-full max-w-[430px] z-10">
        <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/60 border border-slate-100 p-7 sm:p-9 transition-all">
          
          {/* Header & Logo */}
          <div className="flex flex-col items-center text-center mb-7">
            {/* Logo Wrapper */}
            <div className="w-16 h-16 rounded-2xl p-2 bg-white shadow-md shadow-slate-100 border border-slate-100 flex items-center justify-center mb-4 transition-transform hover:scale-105">
              {restaurant?.logo_url ? (
                <img
                  src={restaurant.logo_url}
                  alt={restaurant.name || 'Brand Logo'}
                  className="w-full h-full object-contain rounded-xl"
                />
              ) : (
                <div
                  className="w-full h-full rounded-xl flex items-center justify-center text-white font-black text-2xl shadow-inner"
                  style={{ backgroundColor: primaryColor }}
                >
                  {restaurant?.name ? restaurant.name.charAt(0).toUpperCase() : 'Q'}
                </div>
              )}
            </div>

            {/* Context Badge */}
            {viewMode === 'LOGIN' && (
              <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 mb-2">
                <Store className="w-3.5 h-3.5 text-slate-500" />
                Kitchen & Store Portal
              </span>
            )}
            {viewMode === 'FORGOT_PASSWORD' && (
              <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200/60 mb-2">
                <KeyRound className="w-3.5 h-3.5 text-amber-600" />
                Password Recovery
              </span>
            )}
            {viewMode === 'RESET_PASSWORD' && (
              <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60 mb-2">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                Step 2 of 2: Verification
              </span>
            )}

            {/* Title */}
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              {viewMode === 'LOGIN' && (restaurant?.name ? `${restaurant.name}` : 'Admin Sign In')}
              {viewMode === 'FORGOT_PASSWORD' && 'Reset Your Password'}
              {viewMode === 'RESET_PASSWORD' && 'Create New Password'}
            </h1>

            {/* Subtitle with styled badge for email */}
            {viewMode === 'LOGIN' && (
              <p className="text-sm text-slate-500 mt-1.5">
                Sign in to manage floor, orders, and kitchen operations
              </p>
            )}

            {viewMode === 'FORGOT_PASSWORD' && (
              <p className="text-sm text-slate-500 mt-1.5 max-w-xs">
                Enter your registered admin email to receive a secure 6-digit verification code.
              </p>
            )}

            {viewMode === 'RESET_PASSWORD' && (
              <div className="mt-2 flex flex-col items-center gap-1">
                <span className="text-xs text-slate-500">Enter the 6-digit code sent to</span>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 text-slate-800 rounded-full text-xs font-medium border border-slate-200/60">
                  <Mail className="w-3.5 h-3.5 text-slate-500" />
                  <span className="font-mono">{resetEmail}</span>
                  <button
                    type="button"
                    onClick={() => setViewMode('FORGOT_PASSWORD')}
                    className="ml-1 font-semibold hover:underline text-slate-900"
                    title="Change email"
                  >
                    Edit
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ==================================================== */}
          {/* VIEW 1: ADMIN LOGIN FORM                            */}
          {/* ==================================================== */}
          {viewMode === 'LOGIN' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Admin Email
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@restaurant.com"
                    autoComplete="email"
                    required
                    className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50/70 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-100 transition-all"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setResetEmail(email || '');
                      setViewMode('FORGOT_PASSWORD');
                    }}
                    className="text-xs font-semibold hover:underline transition-colors"
                    style={{ color: primaryColor }}
                  >
                    Forgot Password?
                  </button>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    required
                    className="w-full pl-10 pr-10 py-2.5 bg-slate-50/70 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-100 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full h-12 rounded-xl text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-lg shadow-slate-900/10 hover:opacity-95 active:scale-[0.99] transition-all disabled:opacity-60 cursor-pointer mt-2"
                style={{ backgroundColor: primaryColor }}
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <span>Secure Sign In</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* ==================================================== */}
          {/* VIEW 2: FORGOT PASSWORD (EMAIL INPUT)                */}
          {/* ==================================================== */}
          {viewMode === 'FORGOT_PASSWORD' && (
            <form onSubmit={handleRequestResetOtp} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Registered Admin Email
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    placeholder="admin@restaurant.com"
                    autoFocus
                    required
                    className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50/70 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-100 transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={resetLoading}
                className="w-full h-12 rounded-xl text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-lg shadow-slate-900/10 hover:opacity-95 active:scale-[0.99] transition-all disabled:opacity-60 cursor-pointer mt-2"
                style={{ backgroundColor: primaryColor }}
              >
                {resetLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <span>Send Verification Code</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setViewMode('LOGIN')}
                className="w-full py-2.5 text-xs text-slate-500 hover:text-slate-800 font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back to Sign In
              </button>
            </form>
          )}

          {/* ==================================================== */}
          {/* VIEW 3: RESET PASSWORD (6-DIGIT OTP & NEW CREDENTIALS) */}
          {/* ==================================================== */}
          {viewMode === 'RESET_PASSWORD' && (
            <form onSubmit={handleConfirmReset} className="space-y-4">
              {/* Segmented 6-Box OTP Input */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2 text-center">
                  6-Digit Verification Code
                </label>
                <div className="flex items-center justify-center gap-2 sm:gap-2.5">
                  {otpDigits.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={(el) => {
                        otpInputRefs.current[idx] = el;
                      }}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={idx === 0 ? 6 : 1} // Allows paste on first box
                      value={digit}
                      onChange={(e) => handleOtpChange(idx, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                      className="w-11 h-13 sm:w-12 sm:h-14 text-center font-mono text-xl sm:text-2xl font-bold text-slate-900 bg-slate-50/70 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-slate-500 focus:ring-4 focus:ring-slate-100 transition-all select-all shadow-sm"
                    />
                  ))}
                </div>
              </div>

              {/* New Password */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  New Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min 6 characters"
                    minLength={6}
                    required
                    className="w-full pl-10 pr-10 py-2.5 bg-slate-50/70 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-100 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
                    tabIndex={-1}
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm New Password */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Confirm Password
                  </label>
                  {isPasswordsMatching && (
                    <span className="text-[11px] font-semibold text-emerald-600 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Passwords match
                    </span>
                  )}
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-type password"
                    minLength={6}
                    required
                    className={`w-full pl-10 pr-10 py-2.5 bg-slate-50/70 border rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-4 transition-all ${
                      confirmPassword && !isPasswordsMatching
                        ? 'border-amber-400 focus:border-amber-500 focus:ring-amber-50'
                        : isPasswordsMatching
                        ? 'border-emerald-400 focus:border-emerald-500 focus:ring-emerald-50'
                        : 'border-slate-200 focus:border-slate-400 focus:ring-slate-100'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
                    tabIndex={-1}
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={resetLoading}
                className="w-full h-12 rounded-xl text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-lg shadow-slate-900/10 hover:opacity-95 active:scale-[0.99] transition-all disabled:opacity-60 cursor-pointer mt-2"
                style={{ backgroundColor: primaryColor }}
              >
                {resetLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <span>Update Password & Log In</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              {/* Secondary Actions (Resend + Back) */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                <button
                  type="button"
                  onClick={() => handleRequestResetOtp()}
                  disabled={countdown > 0 || resetLoading}
                  className="font-semibold inline-flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
                  style={{ color: countdown > 0 ? '#64748b' : primaryColor }}
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${resetLoading ? 'animate-spin' : ''}`} />
                  {countdown > 0 ? `Resend code in ${countdown}s` : 'Resend Code'}
                </button>

                <button
                  type="button"
                  onClick={() => setViewMode('LOGIN')}
                  className="text-slate-500 hover:text-slate-800 font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Back to Sign In
                </button>
              </div>
            </form>
          )}

        </div>

        {/* Global Footer Link: Back to Customer Menu */}
        <div className="text-center mt-5">
          <a
            href={`/${slugStr}/menu`}
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 font-medium transition-colors"
          >
            <Store className="w-3.5 h-3.5" />
            <span>Back to Store Digital Menu</span>
          </a>
        </div>
      </div>
    </div>
  );
}
