'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { authService } from '@/app/services/auth.api';
import toast from 'react-hot-toast';
import { User, BadgeCheck } from 'lucide-react';

const COUNTRY_CODES = [
  { code: '+91', label: 'IN +91', country: 'India' },
];

export default function JoinQueueForm({ restaurantId }: { restaurantId: string }) {
  const params = useParams();
  const slug = params?.slug as string;
  const router = useRouter();

  // Join form state
  const [name, setName] = useState('');
  const [countryCode, setCountryCode] = useState('+91');
  const [phone, setPhone] = useState('');
  const [partySize, setPartySize] = useState<number | ''>('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  // OTP state
  const [isVerified, setIsVerified] = useState(false);
  const [otpStep, setOtpStep] = useState(false);
  const [otpToken, setOtpToken] = useState('');
  const [otpCode, setOtpCode] = useState<string[]>(['', '', '', '']);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);

  // Active Queue State
  const [activeQueue, setActiveQueue] = useState<any>(null);
  const [checkingActive, setCheckingActive] = useState(true);

  // 1. Check if user is already logged in and has an active queue ticket
  useEffect(() => {
    const checkActiveQueue = async (phoneToUse: string) => {
      try {
        const res = await fetch(`/api/queue/history?phone=${phoneToUse}`, {
          headers: { 'x-restaurant-slug': slug }
        });
        const data = await res.json();
        if (data.success && data.data.length > 0) {
          // If the most recent one is not SEATED, they can't join again
          const latest = data.data[0];
          if (latest.queue_status !== 'SEATED' && latest.queue_status !== 'CANCELLED') {
            setActiveQueue(latest);
          }
        }
      } catch (err) {
      } finally {
        setCheckingActive(false);
      }
    };

    const user = authService.getUser();
    if (user && user.phone) {
      if (user.phone.startsWith('+91')) {
        setCountryCode('+91');
        setPhone(user.phone.replace('+91', ''));
      } else {
        setPhone(user.phone);
      }
      if (user.name) setName(user.name);
      setIsVerified(true);
      checkActiveQueue(user.phone);
    } else {
      setCheckingActive(false);
    }
  }, [restaurantId, slug, router]);

  const handleSendOTP = async () => {
    const cleanedPhone = phone.replace(/\D/g, '');
    
    if (!cleanedPhone) {
      toast.error('Please enter your phone number');
      return;
    }

    if (countryCode === '+91' && cleanedPhone.length !== 10) {
      toast.error('Please enter a valid 10-digit phone number');
      return;
    }
    
    if (cleanedPhone.length < 7 || cleanedPhone.length > 15) {
      toast.error('Please enter a valid phone number');
      return;
    }
    
    const fullPhone = `${countryCode}${cleanedPhone}`;
    setSendingOtp(true);
    try {
      const data = await authService.sendOtp(fullPhone);
      if (data.success && data.otp_token) {
        setOtpToken(data.otp_token);
        setOtpStep(true);
        toast.success('OTP sent to your phone');
        setTimeout(() => {
          document.getElementById('otp-input-0')?.focus();
        }, 100);
      } else {
        toast.error(data.error || 'Failed to send OTP');
      }
    } catch (err) {
      toast.error('Network error. Please try again.');
    } finally {
      setSendingOtp(false);
    }
  };

  const verifyOtpSubmit = async (codeToVerify?: string) => {
    const cleanCode = (codeToVerify || otpCode.join('')).replace(/\D/g, '');
    if (cleanCode.length !== 4) {
      toast.error('Please enter a valid 4-digit OTP');
      return;
    }
    
    setVerifyingOtp(true);
    try {
      const data = await authService.verifyOtp(cleanCode, otpToken);
      if (data.success) {
        toast.success('Phone verified successfully!');
        setOtpStep(false);
        setIsVerified(true);
        
        // After verify, check active queue silently without blocking UI
        const fullPhone = `${countryCode}${phone.replace(/\D/g, '')}`;
        fetch(`/api/queue/history?phone=${fullPhone}`, {
          headers: { 'x-restaurant-slug': slug }
        })
        .then(res => res.json())
        .then(historyData => {
          if (historyData.success && historyData.data.length > 0) {
            const latest = historyData.data[0];
            if (latest.queue_status !== 'SEATED' && latest.queue_status !== 'CANCELLED') {
              setActiveQueue(latest);
            }
          }
        })
        .catch(() => {});
      } else {
        toast.error(data.error || 'Invalid OTP');
      }
    } catch (err) {
      toast.error('Network error. Please try again.');
    } finally {
      setVerifyingOtp(false);
    }
  };

  const handleJoinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    if (!isVerified) {
      toast.error('Please verify your phone number first');
      return;
    }
    if (name.trim().length < 2) {
      toast.error('Please enter a valid name');
      return;
    }
    if (!partySize) {
      toast.error('Please select number of persons');
      return;
    }

    setLoading(true);
    const fullPhone = `${countryCode}${phone.replace(/\D/g, '')}`;
    try {
      const res = await fetch(`/api/queue/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restaurantId, name, phone: fullPhone, partySize, notes })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        router.push(`/${slug}/queue-status/${data.queue?.id || data.id}`);
      } else {
        toast.error(data.error || 'Failed to join queue');
      }
    } catch (err) {
      toast.error('Error joining queue');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      padding: '32px 28px',
      backgroundColor: '#ffffff',
      borderRadius: '12px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.06)',
      border: '1px solid #e2e8f0',
      width: '100%',
      position: 'relative',
      overflow: 'hidden',
      fontFamily: "'Inter', sans-serif"
    }}>
      {/* Remove top colored border to match UI */}
      
      {checkingActive ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
          <div className="loader" style={{ width: 24, height: 24, borderWidth: 2 }} />
        </div>
      ) : activeQueue ? (
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎟️</div>
          <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a', marginBottom: '8px' }}>You are already in the queue!</h3>
          <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '24px', lineHeight: 1.5 }}>
            Your current token is <strong>#{activeQueue.token_number}</strong> and your status is <strong style={{ color: 'var(--primary)' }}>{activeQueue.queue_status}</strong>.
            You cannot join the queue again until you are SEATED.
          </p>
          <button onClick={() => router.push(`/${slug}/queue-status/${activeQueue.id}`)} style={{
            width: '100%', padding: '16px', backgroundColor: 'var(--primary)', color: '#ffffff',
            border: 'none', borderRadius: '12px', fontSize: '15px', fontWeight: 700, cursor: 'pointer',
          }}>
            View Queue Status
          </button>
        </div>
      ) : (
      <form onSubmit={handleJoinSubmit}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
            <User size={22} color="#1e293b" />
            <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#1e293b', margin: 0 }}>Your Details</h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 700, color: '#334155', marginBottom: '8px' }}>Full Name *</label>
              <input 
                type="text" required minLength={2} maxLength={50}
                value={name} onChange={e => setName(e.target.value)}
                className="input"
                placeholder="John Doe"
              />
            </div>
            
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 700, color: '#334155', marginBottom: '8px' }}>Phone Number *</label>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <select
                  className="select"
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value)}
                  style={{ width: '100px', flexShrink: 0, paddingLeft: '8px', paddingRight: '28px' }}
                  disabled={otpStep || isVerified}
                >
                  {COUNTRY_CODES.map(c => (
                    <option key={c.code} value={c.code}>{c.label}</option>
                  ))}
                </select>
                <input 
                  type="tel" required disabled={otpStep || isVerified}
                  value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  className="input"
                  style={{ flex: 1 }}
                  placeholder="9xxxxxxxxx"
                />
                {isVerified ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#059669', background: '#ecfdf5', padding: '8px 14px', borderRadius: '8px', fontSize: '14px', fontWeight: 700 }}>
                    <BadgeCheck size={18} color="#059669" />
                    Verified
                  </span>
                ) : (
                  otpStep ? (
                    <button type="button" onClick={() => { setOtpStep(false); setOtpCode(['', '', '', '']); }} style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '14px', fontWeight: 700, cursor: 'pointer', padding: '0 4px' }}>
                      Edit
                    </button>
                  ) : (
                    <button type="button" onClick={handleSendOTP} disabled={sendingOtp || phone.length !== 10} style={{ background: 'none', border: 'none', color: (sendingOtp || phone.length !== 10) ? '#cbd5e1' : 'var(--primary)', fontSize: '14px', fontWeight: 700, cursor: (sendingOtp || phone.length !== 10) ? 'not-allowed' : 'pointer', padding: '0 4px', whiteSpace: 'nowrap', transition: 'color 0.2s' }}>
                      {sendingOtp ? 'Sending...' : 'Send OTP'}
                    </button>
                  )
                )}
              </div>
            </div>

            {otpStep && !isVerified && (
              <div style={{ padding: '20px', background: 'color-mix(in srgb, var(--primary) 8%, white)', borderRadius: '16px', border: '1px solid color-mix(in srgb, var(--primary) 20%, white)', animation: 'slideDown 0.3s ease-out' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--primary)', fontWeight: 800 }}>ENTER 4-DIGIT OTP</span>
                </div>
                
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginBottom: '24px' }}>
                  {[0, 1, 2, 3].map((index) => (
                    <input
                      key={index}
                      id={`otp-input-${index}`}
                      type="text" maxLength={1}
                      inputMode="numeric"
                      value={otpCode[index] || ''}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '');
                        if (!val && e.target.value !== '') return;
                        const newOtp = [...otpCode];
                        newOtp[index] = val;
                        setOtpCode(newOtp);
                        if (val && index < 3) document.getElementById(`otp-input-${index + 1}`)?.focus();

                        if (val && index === 3) {
                          const completeCode = newOtp.join('');
                          if (completeCode.length === 4) {
                            verifyOtpSubmit(completeCode);
                          }
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Backspace' && !otpCode[index] && index > 0) {
                          document.getElementById(`otp-input-${index - 1}`)?.focus();
                          const newOtp = [...otpCode];
                          newOtp[index - 1] = '';
                          setOtpCode(newOtp);
                        }
                      }}
                      onPaste={(e) => {
                        e.preventDefault();
                        const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4);
                        if (pastedData) {
                          const newOtp = ['', '', '', ''];
                          pastedData.split('').forEach((d, i) => { if (i < 4) newOtp[i] = d; });
                          setOtpCode(newOtp);
                          const nextIndex = Math.min(pastedData.length, 3);
                          document.getElementById(`otp-input-${nextIndex}`)?.focus();
                          if (pastedData.length === 4) {
                            verifyOtpSubmit(pastedData);
                          }
                        }
                      }}
                      style={{
                        width: '52px', height: '56px', textAlign: 'center', fontSize: '22px', fontWeight: 800,
                        borderRadius: '12px', border: '1.5px solid color-mix(in srgb, var(--primary) 25%, white)', background: 'white', color: 'var(--primary)',
                        outlineColor: 'var(--primary)', boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
                      }}
                    />
                  ))}
                </div>
                
                <button type="button" onClick={() => verifyOtpSubmit()} disabled={verifyingOtp || otpCode.join('').replace(/\D/g, '').length !== 4} style={{ 
                  width: '100%', padding: '16px', borderRadius: '12px', background: 'var(--primary)', color: 'white', 
                  fontWeight: 700, fontSize: '15px', border: 'none', opacity: (verifyingOtp || otpCode.join('').replace(/\D/g, '').length !== 4) ? 0.7 : 1,
                  cursor: (verifyingOtp || otpCode.join('').replace(/\D/g, '').length !== 4) ? 'not-allowed' : 'pointer'
                }}>
                  {verifyingOtp ? 'Verifying...' : 'Verify Code'}
                </button>
              </div>
            )}

            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 700, color: '#334155', marginBottom: '8px' }}>Number of Persons *</label>
              <select
                value={partySize}
                onChange={e => setPartySize(Number(e.target.value))}
                className="select"
                style={{ width: '100%', color: partySize ? '#0f172a' : '#94a3b8' }}
              >
                <option value="" disabled>Select persons</option>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(num => (
                  <option key={num} value={num}>{num} {num === 1 ? 'Person' : 'Persons'}</option>
                ))}
              </select>
            </div>

            <button type="submit" disabled={loading || !isVerified} style={{
              width: '100%', padding: '18px', backgroundColor: 'var(--primary)', color: '#ffffff',
              border: 'none', borderRadius: '14px', fontSize: '16px', fontWeight: 800, cursor: (loading || !isVerified) ? 'not-allowed' : 'pointer',
              marginTop: '8px', opacity: (loading || !isVerified) ? 0.5 : 1, transition: 'opacity 0.2s', letterSpacing: '0.02em',
              boxShadow: '0 8px 20px -8px var(--primary)'
            }}>
              {loading ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <div className="loader" style={{ width: 16, height: 16, borderWidth: 2, borderColor: '#fff', borderBottomColor: 'transparent' }} />
                  Joining...
                </div>
              ) : 'Confirm Waitlist'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
