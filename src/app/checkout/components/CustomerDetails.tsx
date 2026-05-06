import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { authService } from '@/app/services/auth.api';

interface CustomerDetailsProps {
  form: {
    customer_name: string;
    phone: string;
    party_size: string;
    notes: string;
  };
  setForm: React.Dispatch<React.SetStateAction<{
    customer_name: string;
    phone: string;
    party_size: string;
    notes: string;
  }>>;
  isVerified: boolean;
  onVerified: (user: any) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export default function CustomerDetails({ 
  form, 
  setForm, 
  isVerified, 
  onVerified,
  onSubmit 
}: CustomerDetailsProps) {
  const [otpStep, setOtpStep] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpToken, setOtpToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);

  // Countdown timer for Resend OTP
  useEffect(() => {
    let interval: any;
    if (resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [resendTimer]);

  const handleVerifyClick = async () => {
    const cleanedPhone = form.phone.replace(/\D/g, '');
    if (!cleanedPhone || cleanedPhone.length < 10) {
      toast.error('Please enter a valid 10-digit phone number');
      return;
    }
    
    setLoading(true);
    try {
      const data = await authService.sendOtp(form.phone);
      if (data.success && data.otp_token) {
        setOtpToken(data.otp_token);
        setOtpStep(true);
        setResendTimer(60);
        toast.success('OTP sent to your phone');
      } else {
        toast.error(data.error || 'Failed to send OTP');
      }
    } catch (err) {
      toast.error('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const verifyOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otpCode.length !== 6) {
      toast.error('Please enter a valid 6-digit OTP');
      return;
    }
    
    setVerifyingOtp(true);
    try {
      const data = await authService.verifyOtp(otpCode, otpToken);
      if (data.success) {
        toast.success('Phone verified successfully!');
        setOtpStep(false);
        const updatedUser = authService.getUser();
        onVerified(updatedUser);
      } else {
        toast.error(data.error || 'Invalid OTP');
      }
    } catch (err) {
      toast.error('Network error. Please try again.');
    } finally {
      setVerifyingOtp(false);
    }
  };

  return (
    <form onSubmit={onSubmit} id="new-order-form">
      <div className="card">
        <h3 style={{ fontWeight: 700, marginBottom: '18px', fontSize: '16px' }}>👤 Your Details</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label className="label">Full Name *</label>
            <input
              type="text"
              className="input"
              placeholder="Enter your name"
              value={form.customer_name}
              onChange={e => setForm(f => ({ ...f, customer_name: e.target.value }))}
              maxLength={50}
              required
            />
          </div>
          <div>
            <label className="label">Phone Number *</label>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                type="tel"
                className="input"
                placeholder="+91 9xxxxxxxxx"
                value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                style={{ flex: 1 }}
                required
                disabled={otpStep}
              />
              {isVerified ? (
                <span style={{ 
                  color: '#10B981', background: 'rgba(16, 185, 129, 0.1)', 
                  padding: '8px 12px', borderRadius: '8px', fontSize: '13px', fontWeight: 700 
                }}>
                  ✅ Verified
                </span>
              ) : (
                !otpStep && (
                  <button 
                    type="button" 
                    className="btn btn-secondary" 
                    onClick={handleVerifyClick}
                    disabled={loading || form.phone.replace(/\D/g, '').length < 10}
                    style={{ padding: '0 16px', height: '48px' }}
                  >
                    {loading ? '...' : 'Verify'}
                  </button>
                )
              )}
            </div>
            
            {/* INLINE OTP FIELD */}
            {otpStep && !isVerified && (
              <div style={{ marginTop: '12px', padding: '12px', background: '#F9FAFB', borderRadius: '12px', border: '1px solid var(--border)', animation: 'slideDown 0.3s ease-out' }}>
                <label className="label" style={{ fontSize: '12px', color: 'var(--primary)' }}>Enter 6-Digit OTP</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    className="input"
                    placeholder="000000"
                    value={otpCode}
                    onChange={e => setOtpCode(e.target.value.replace(/\D/g, ''))}
                    maxLength={6}
                    style={{ textAlign: 'center', letterSpacing: '4px', fontWeight: 800, fontSize: '18px' }}
                  />
                  <button 
                    type="button" 
                    className="btn" 
                    onClick={verifyOtpSubmit}
                    disabled={verifyingOtp || otpCode.length !== 6}
                    style={{ padding: '0 20px', height: '48px', background: 'var(--primary)', color: 'white' }}
                  >
                    {verifyingOtp ? '...' : 'Confirm'}
                  </button>
                </div>
                
                <div style={{ marginTop: '10px' }}>
                  {resendTimer > 0 ? (
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ display: 'inline-block', width: '8px', height: '8px', background: 'var(--primary)', borderRadius: '50%', animation: 'pulse 1s infinite' }}></span>
                      Resend available in {resendTimer}s
                    </p>
                  ) : (
                    <button 
                      type="button" 
                      onClick={handleVerifyClick} 
                      style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '12px', cursor: 'pointer', fontWeight: 700, textDecoration: 'underline' }}
                    >
                      Resend OTP
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
          <div>
            <label className="label">Number of Persons *</label>
            <select
              className="select"
              value={form.party_size}
              onChange={e => setForm(f => ({ ...f, party_size: e.target.value }))}
              required
            >
              <option value="" disabled>Select persons</option>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                <option key={n} value={n}>{n} Party</option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </form>
  );
}
