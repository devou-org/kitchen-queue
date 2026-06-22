import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { authService } from '@/app/services/auth.api';
import { User, BadgeCheck, Info } from 'lucide-react';

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
  totalQty?: number;
}

export default function CustomerDetails({ 
  form, 
  setForm, 
  isVerified, 
  onVerified,
  onSubmit,
  totalQty
}: CustomerDetailsProps) {
  const [otpStep, setOtpStep] = useState(false);
  const [otpCode, setOtpCode] = useState<string[]>(['', '', '', '', '', '']);
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
    const cleanCode = otpCode.join('').replace(/\D/g, '');
    if (cleanCode.length !== 6) {
      toast.error('Please enter a valid 6-digit OTP');
      return;
    }
    
    setVerifyingOtp(true);
    try {
      const data = await authService.verifyOtp(cleanCode, otpToken);
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
        <h3 style={{ fontWeight: 700, marginBottom: '18px', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <User size={18} />
          Your Details
        </h3>
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
                  padding: '8px 12px', borderRadius: '8px', fontSize: '13px', fontWeight: 700,
                  display: 'flex', alignItems: 'center', gap: '6px'
                }}>
                  <BadgeCheck size={16} /> Verified
                </span>
              ) : (
                otpStep ? (
                  <button 
                    type="button" 
                    onClick={() => { setOtpStep(false); setOtpCode(['', '', '', '', '', '']); }}
                    style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '13px', fontWeight: 700, cursor: 'pointer', padding: '0 8px' }}
                  >
                    Edit
                  </button>
                ) : (
                  <button 
                    type="button" 
                    onClick={handleVerifyClick}
                    disabled={loading || form.phone.replace(/\D/g, '').length < 10}
                    style={{ 
                      background: 'none', 
                      border: 'none', 
                      color: (loading || form.phone.replace(/\D/g, '').length < 10) ? '#ccc' : 'var(--primary)', 
                      fontSize: '13px', 
                      fontWeight: 700, 
                      cursor: (loading || form.phone.replace(/\D/g, '').length < 10) ? 'not-allowed' : 'pointer',
                      padding: '0 8px',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {loading ? 'Sending...' : 'Send OTP'}
                  </button>
                )
              )}
            </div>
            
            {/* NEW OTP FIELD UI */}
            {otpStep && !isVerified && (
              <div style={{ marginTop: '16px', padding: '20px', background: '#FFF0F2', borderRadius: '16px', animation: 'slideDown 0.3s ease-out' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--primary)', fontWeight: 800 }}>ENTER 6-DIGIT OTP</span>
                  <span style={{ background: 'white', padding: '4px 12px', borderRadius: '16px', fontSize: '11px', color: '#9ca3af', fontWeight: 500 }}>
                    Sent to +91 {form.phone.slice(-4).padStart(10, '*')}
                  </span>
                </div>
                
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'space-between', marginBottom: '24px' }}>
                  {[0, 1, 2, 3, 4, 5].map((index) => (
                    <input
                      key={index}
                      id={`otp-input-${index}`}
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={1}
                      value={otpCode[index] || ''}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '');
                        if (!val && e.target.value !== '') return; // ignore non-numeric
                        const newOtp = [...otpCode];
                        newOtp[index] = val;
                        setOtpCode(newOtp);
                        
                        if (val && index < 5) {
                          const next = document.getElementById(`otp-input-${index + 1}`);
                          if (next) next.focus();
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Backspace' && !otpCode[index] && index > 0) {
                          const prev = document.getElementById(`otp-input-${index - 1}`);
                          if (prev) {
                            prev.focus();
                            const newOtp = [...otpCode];
                            newOtp[index - 1] = '';
                            setOtpCode(newOtp);
                          }
                        }
                      }}
                      onPaste={(e) => {
                        e.preventDefault();
                        const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
                        if (pastedData) {
                          const newOtp = [...otpCode];
                          pastedData.split('').forEach((d, i) => newOtp[i] = d);
                          setOtpCode(newOtp);
                          const nextIndex = Math.min(pastedData.length, 5);
                          const next = document.getElementById(`otp-input-${nextIndex}`);
                          if (next) next.focus();
                        }
                      }}
                      style={{
                        width: '100%',
                        aspectRatio: '1/1.1',
                        textAlign: 'center',
                        fontSize: '20px',
                        fontWeight: 700,
                        borderRadius: '8px',
                        border: '1px solid #fecdd3', // soft pink border
                        background: 'white',
                        color: 'var(--primary)',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
                        outlineColor: 'var(--primary)'
                      }}
                    />
                  ))}
                </div>
                
                <button 
                  type="button" 
                  onClick={verifyOtpSubmit}
                  disabled={verifyingOtp || otpCode.join('').replace(/\D/g, '').length !== 6}
                  style={{ 
                    width: '100%', 
                    padding: '16px', 
                    borderRadius: '12px', 
                    background: 'var(--primary)', 
                    color: 'white', 
                    fontWeight: 700,
                    fontSize: '15px',
                    border: 'none',
                    opacity: (verifyingOtp || otpCode.join('').replace(/\D/g, '').length !== 6) ? 0.7 : 1,
                    cursor: (verifyingOtp || otpCode.join('').replace(/\D/g, '').length !== 6) ? 'not-allowed' : 'pointer',
                    boxShadow: '0 4px 14px rgba(0,0,0,0.1)'
                  }}
                >
                  {verifyingOtp ? 'Verifying...' : 'Verify Code'}
                </button>
                
                <div style={{ marginTop: '20px', textAlign: 'center' }}>
                  {resendTimer > 0 ? (
                    <p style={{ fontSize: '13px', color: '#9ca3af', margin: 0, fontWeight: 500 }}>
                      Didn't receive it? <span style={{ color: '#f472b6' }}>Resend in {resendTimer}s</span>
                    </p>
                  ) : (
                    <p style={{ fontSize: '13px', color: '#9ca3af', margin: 0, fontWeight: 500 }}>
                      Didn't receive it? <button type="button" onClick={handleVerifyClick} style={{ background: 'none', border: 'none', color: '#f472b6', fontWeight: 600, cursor: 'pointer', padding: 0 }}>Resend OTP</button>
                    </p>
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
