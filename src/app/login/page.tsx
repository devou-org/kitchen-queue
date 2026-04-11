'use client';
import { useState, useRef, useEffect, ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

const COUNTRY_CODES = [
  { code: '+91', label: '🇮🇳 +91', country: 'India' },

];

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [countryCode, setCountryCode] = useState('+91');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    // Check if user is already logged in (skip OTP)
    const token = localStorage.getItem('auth_token');
    const user = localStorage.getItem('user');
    if (token && user) {
      router.push('/menu');
    }
  }, [router]);

  useEffect(() => {
    if (cooldown > 0) {
      const t = setTimeout(() => setCooldown(c => c - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [cooldown]);

  const fullPhone = `${countryCode}${phone.replace(/\D/g, '')}`;

  const handleSendOTP = async () => {
    if (!phone.trim()) return toast.error('Enter your phone number');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: fullPhone }),
      });
      const data = await res.json();
      if (data.success) {
        setStep('otp');
        setCooldown(60);
        toast.success('OTP sent to your phone!');

      } else {
        toast.error(data.error || 'Failed to send OTP');
      }
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleOTPChange = (index: number, value: string) => {
    // Strip non-digits
    const digits = value.replace(/\D/g, '');

    // Handle multi-digit input (Android keyboard or browser autofill)
    if (digits.length > 1) {
      const newOtp = [...otp];
      digits.split('').slice(0, 6 - index).forEach((d, i) => {
        newOtp[index + i] = d;
      });
      setOtp(newOtp);
      const lastFill = Math.min(index + digits.length - 1, 5);
      otpRefs.current[lastFill]?.focus();
      if (newOtp.every(d => d !== '')) handleVerify(newOtp.join(''));
      return;
    }

    // Single digit — normal flow
    if (!/^\d?$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
    if (newOtp.every(d => d !== '')) {
      handleVerify(newOtp.join(''));
    }
  };

  const handleOTPPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    const newOtp = [...otp];
    pasted.split('').forEach((digit, i) => { newOtp[i] = digit; });
    setOtp(newOtp);
    // Focus last filled box
    const lastIndex = Math.min(pasted.length - 1, 5);
    otpRefs.current[lastIndex]?.focus();
    // Auto-verify if full OTP pasted
    if (pasted.length === 6) {
      handleVerify(pasted);
    }
  };

  const handleOTPKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async (code?: string) => {
    const otpCode = code || otp.join('');
    if (otpCode.length !== 6) return toast.error('Enter complete 6-digit OTP');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: fullPhone, code: otpCode }),
      });
      const data = await res.json();
      if (data.success) {
        // Store in localStorage for client-side access
        localStorage.setItem('auth_token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));

        // Also set as a cookie so the Next.js middleware can see it on navigation
        const maxAge = 30 * 24 * 60 * 60; // 30 days in seconds
        document.cookie = `auth_token=${data.token}; path=/; max-age=${maxAge}; SameSite=Lax`;

        toast.success('Welcome to Renjz Kitchen! 🎉');
        router.push('/menu');
      } else {
        toast.error(data.error || 'Invalid OTP');
      }
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #FDF9FA 0%, #F8EDF0 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
    }}>
      <div style={{ width: '100%', maxWidth: '400px' }} className="animate-fade-in">

        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '36px' }}>
          <div style={{
            width: '90px', height: '90px',
            background: 'white',
            borderRadius: '24px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 20px',
            boxShadow: '0 8px 32px rgba(151,19,69,0.2)',
            overflow: 'hidden',
            border: '2px solid white'
          }}>
            <img
              src="/logo.jpeg"
              alt="Renjz Kitchen"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </div>
          <h1 style={{ fontSize: '28px', fontWeight: 900, color: 'var(--text-primary)', marginBottom: '8px', letterSpacing: '-0.5px' }}>
            Renjz Kitchen
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '15px', fontWeight: 500 }}>
            Taste of Home in every bite.
          </p>
        </div>

        {/* Card */}
        <div className="card" style={{ borderRadius: '20px', padding: '28px', boxShadow: '0 8px 32px rgba(0,0,0,0.08)' }}>

          {/* Phone Step */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label className="label">Phone Number</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <select
                  className="select"
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value)}
                  style={{ width: '120px', flexShrink: 0 }}
                >
                  {COUNTRY_CODES.map(c => (
                    <option key={c.code} value={c.code}>{c.label}</option>
                  ))}
                </select>
                <input
                  type="tel"
                  className="input"
                  placeholder="000 000 0000"
                  value={phone}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setPhone(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendOTP()}
                  style={{ flex: 1 }}
                />
              </div>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '6px' }}>
                We'll send a 6-digit code to verify your account.
              </p>
            </div>

            <button
              className="btn btn-primary btn-lg"
              style={{ width: '100%' }}
              onClick={handleSendOTP}
              disabled={loading || !phone.trim()}
            >
              {loading && step === 'phone' ? (
                <><span className="loader" style={{ width: 18, height: 18, borderWidth: 2 }} /> Sending...</>
              ) : (
                <>Send OTP →</>
              )}
            </button>
          </div>

          {/* Divider */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '12px',
            margin: '20px 0', color: 'var(--text-secondary)', fontSize: '12px',
            textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600,
          }}>
            <hr style={{ flex: 1, border: 'none', borderTop: '1px solid var(--border)' }} />
            VERIFICATION
            <hr style={{ flex: 1, border: 'none', borderTop: '1px solid var(--border)' }} />
          </div>

          {/* OTP Step */}
          <div>
            <p style={{ textAlign: 'center', fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '14px' }}>
              Enter 6-digit code
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '16px' }}>
              {otp.map((digit, i) => (
                <input
                  key={i}
                  ref={(el) => { otpRefs.current[i] = el; }}
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  className="otp-input"
                  value={digit}
                  onChange={(e) => handleOTPChange(i, e.target.value)}
                  onKeyDown={(e) => handleOTPKeyDown(i, e)}
                  onPaste={handleOTPPaste}
                  disabled={step === 'phone'}
                  style={{
                    opacity: step === 'phone' ? 0.4 : 1,
                  }}
                />
              ))}
            </div>
            <button
              className="btn btn-secondary btn-lg"
              style={{ width: '100%' }}
              onClick={() => handleVerify()}
              disabled={loading || step === 'phone' || otp.some(d => !d)}
            >
              {loading && step === 'otp' ? (
                <><span className="loader" style={{ width: 18, height: 18, borderWidth: 2, borderColor: 'rgba(151,19,69,0.3)', borderTopColor: 'var(--primary)' }} /> Verifying...</>
              ) : 'Verify & Login'}
            </button>
            <p style={{ textAlign: 'center', fontSize: '13px', color: 'var(--text-secondary)', marginTop: '12px' }}>
              {cooldown > 0 ? (
                <>Resend code in <strong>0:{cooldown.toString().padStart(2, '0')}</strong></>
              ) : step === 'otp' ? (
                <button
                  style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}
                  onClick={handleSendOTP}
                >
                  Resend OTP
                </button>
              ) : null}
            </p>
          </div>
        </div>


      </div>
    </div>
  );
}
