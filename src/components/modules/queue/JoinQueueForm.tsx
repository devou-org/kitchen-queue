'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { authService } from '@/app/services/auth.api';
import toast from 'react-hot-toast';

export default function JoinQueueForm({ restaurantId }: { restaurantId: string }) {
  const params = useParams();
  const slug = params?.slug as string;
  const router = useRouter();

  // Join form state
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [partySize, setPartySize] = useState(1);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  // OTP state
  const [isVerified, setIsVerified] = useState(false);
  const [otpStep, setOtpStep] = useState(false);
  const [otpToken, setOtpToken] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);

  // Active Queue State
  const [activeQueue, setActiveQueue] = useState<any>(null);
  const [checkingActive, setCheckingActive] = useState(true);

  // 1. Auto-redirect if they have an active ticket in localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(`queue_ticket_${restaurantId}`);
      if (stored) {
        const { tokenNumber, expiresAt } = JSON.parse(stored);
        if (Date.now() < expiresAt) {
          router.replace(`/${slug}/queue-status/${tokenNumber}`);
        } else {
          localStorage.removeItem(`queue_ticket_${restaurantId}`);
        }
      }
    } catch (e) {
      // ignore
    }
    
    // Check if user is already logged in
    const checkActiveQueue = async (phoneToUse: string) => {
      try {
        const res = await fetch(`/api/queue/history?phone=${phoneToUse}`, {
          headers: { 'x-restaurant-slug': slug }
        });
        const data = await res.json();
        if (data.success && data.data.length > 0) {
          // If the most recent one is not SEATED, they can't join again
          const latest = data.data[0];
          if (latest.queue_status !== 'SEATED') {
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
      setPhone(user.phone);
      if (user.name) setName(user.name);
      setIsVerified(true);
      checkActiveQueue(user.phone);
    } else {
      setCheckingActive(false);
    }
  }, [restaurantId, slug, router]);

  const handleSendOTP = async () => {
    const cleanedPhone = phone.replace(/\D/g, '');
    if (!cleanedPhone || cleanedPhone.length < 10) {
      toast.error('Please enter a valid 10-digit phone number');
      return;
    }
    
    setSendingOtp(true);
    try {
      const data = await authService.sendOtp(phone);
      if (data.success && data.otp_token) {
        setOtpToken(data.otp_token);
        setOtpStep(true);
        toast.success('OTP sent to your phone');
      } else {
        toast.error(data.error || 'Failed to send OTP');
      }
    } catch (err) {
      toast.error('Network error. Please try again.');
    } finally {
      setSendingOtp(false);
    }
  };

  const verifyOtpSubmit = async () => {
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
        setIsVerified(true);
        // After verify, check active queue
        setCheckingActive(true);
        try {
          const res = await fetch(`/api/queue/history?phone=${phone}`, {
            headers: { 'x-restaurant-slug': slug }
          });
          const historyData = await res.json();
          if (historyData.success && historyData.data.length > 0) {
            const latest = historyData.data[0];
            if (latest.queue_status !== 'SEATED') {
              setActiveQueue(latest);
            }
          }
        } catch {}
        setCheckingActive(false);
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

    setLoading(true);
    try {
      const res = await fetch(`/api/queue/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restaurantId, name, phone, partySize, notes })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        localStorage.setItem(`queue_ticket_${restaurantId}`, JSON.stringify({
          tokenNumber: data.token_number,
          expiresAt: Date.now() + 60 * 60 * 1000 // 1 hour
        }));
        router.push(`/${slug}/queue-status/${data.token_number}`);
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
      padding: '36px 28px',
      backgroundColor: '#ffffff',
      borderRadius: '24px',
      boxShadow: '0 20px 40px -15px rgba(0,0,0,0.08)',
      border: '1px solid #f1f5f9',
      maxWidth: '420px',
      margin: '0 auto',
      position: 'relative',
      overflow: 'hidden',
      fontFamily: "'Inter', sans-serif"
    }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '8px', backgroundColor: 'var(--primary)' }} />
      
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
          <button onClick={() => router.push(`/${slug}/queue-status/${activeQueue.token_number}`)} style={{
            width: '100%', padding: '16px', backgroundColor: 'var(--primary)', color: '#ffffff',
            border: 'none', borderRadius: '12px', fontSize: '15px', fontWeight: 700, cursor: 'pointer',
          }}>
            View Queue Status
          </button>
        </div>
      ) : (
      <form onSubmit={handleJoinSubmit}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 800, color: '#334155', marginBottom: '8px' }}>Full Name *</label>
              <input 
                type="text" required minLength={2} maxLength={50}
                value={name} onChange={e => setName(e.target.value)}
                style={{
                  width: '100%', padding: '16px', backgroundColor: '#f8fafc', border: '1.5px solid #e2e8f0',
                  borderRadius: '14px', fontSize: '15px', color: '#0f172a', outline: 'none', transition: 'all 0.2s',
                  borderBottomColor: name ? 'var(--primary)' : '#e2e8f0',
                  boxSizing: 'border-box', fontWeight: 500
                }}
                placeholder="John Doe"
              />
            </div>
            
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 800, color: '#334155', marginBottom: '8px' }}>Phone Number *</label>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input 
                  type="tel" required disabled={otpStep || isVerified}
                  value={phone} onChange={e => setPhone(e.target.value)}
                  style={{
                    flex: 1, padding: '16px', backgroundColor: '#f8fafc', border: '1.5px solid #e2e8f0',
                    borderRadius: '14px', fontSize: '15px', color: '#0f172a', outline: 'none', transition: 'all 0.2s',
                    borderBottomColor: phone ? 'var(--primary)' : '#e2e8f0',
                    boxSizing: 'border-box', fontWeight: 500
                  }}
                  placeholder="+91 9xxxxxxxxx"
                />
                {isVerified ? (
                  <span style={{ color: '#10B981', background: 'rgba(16, 185, 129, 0.1)', padding: '8px 12px', borderRadius: '8px', fontSize: '13px', fontWeight: 700 }}>
                    ✅ Verified
                  </span>
                ) : (
                  otpStep ? (
                    <button type="button" onClick={() => { setOtpStep(false); setOtpCode(''); }} style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '13px', fontWeight: 700, cursor: 'pointer', padding: '0 8px' }}>
                      Edit
                    </button>
                  ) : (
                    <button type="button" onClick={handleSendOTP} disabled={sendingOtp || phone.replace(/\D/g, '').length < 10} style={{ background: 'none', border: 'none', color: (sendingOtp || phone.replace(/\D/g, '').length < 10) ? '#ccc' : 'var(--primary)', fontSize: '13px', fontWeight: 700, cursor: (sendingOtp || phone.replace(/\D/g, '').length < 10) ? 'not-allowed' : 'pointer', padding: '0 8px', whiteSpace: 'nowrap' }}>
                      {sendingOtp ? 'Sending...' : 'Send OTP'}
                    </button>
                  )
                )}
              </div>
            </div>

            {otpStep && !isVerified && (
              <div style={{ padding: '20px', background: '#FFF0F2', borderRadius: '16px', animation: 'slideDown 0.3s ease-out' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--primary)', fontWeight: 800 }}>ENTER 6-DIGIT OTP</span>
                </div>
                
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'space-between', marginBottom: '24px' }}>
                  {[0, 1, 2, 3, 4, 5].map((index) => (
                    <input
                      key={index}
                      id={`otp-input-${index}`}
                      type="text" maxLength={1}
                      value={otpCode[index] || ''}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '');
                        if (!val && e.target.value !== '') return;
                        const newOtp = otpCode.split('');
                        newOtp[index] = val;
                        setOtpCode(newOtp.join(''));
                        if (val && index < 5) document.getElementById(`otp-input-${index + 1}`)?.focus();
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Backspace' && !otpCode[index] && index > 0) {
                          document.getElementById(`otp-input-${index - 1}`)?.focus();
                          const newOtp = otpCode.split('');
                          newOtp[index - 1] = '';
                          setOtpCode(newOtp.join(''));
                        }
                      }}
                      onPaste={(e) => {
                        e.preventDefault();
                        const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
                        if (pastedData) {
                          setOtpCode(pastedData);
                          const nextIndex = Math.min(pastedData.length, 5);
                          document.getElementById(`otp-input-${nextIndex}`)?.focus();
                        }
                      }}
                      style={{
                        width: '100%', aspectRatio: '1/1.1', textAlign: 'center', fontSize: '20px', fontWeight: 700,
                        borderRadius: '8px', border: '1px solid #fecdd3', background: 'white', color: 'var(--primary)',
                        outlineColor: 'var(--primary)'
                      }}
                    />
                  ))}
                </div>
                
                <button type="button" onClick={verifyOtpSubmit} disabled={verifyingOtp || otpCode.length !== 6} style={{ 
                  width: '100%', padding: '16px', borderRadius: '12px', background: 'var(--primary)', color: 'white', 
                  fontWeight: 700, fontSize: '15px', border: 'none', opacity: (verifyingOtp || otpCode.length !== 6) ? 0.7 : 1,
                  cursor: (verifyingOtp || otpCode.length !== 6) ? 'not-allowed' : 'pointer'
                }}>
                  {verifyingOtp ? 'Verifying...' : 'Verify Code'}
                </button>
              </div>
            )}

            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 800, color: '#334155', marginBottom: '8px' }}>Party Size</label>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                backgroundColor: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: '14px', padding: '8px'
              }}>
                <button type="button" onClick={() => setPartySize(Math.max(1, partySize - 1))} style={{
                  width: '44px', height: '44px', borderRadius: '10px', backgroundColor: '#ffffff',
                  border: '1px solid #e2e8f0', color: '#64748b', fontSize: '24px', fontWeight: 700, cursor: 'pointer'
                }}>−</button>
                <span style={{ fontSize: '24px', fontWeight: 900, color: 'var(--primary)' }}>{partySize}</span>
                <button type="button" onClick={() => setPartySize(partySize + 1)} style={{
                  width: '44px', height: '44px', borderRadius: '10px', backgroundColor: '#ffffff',
                  border: '1px solid #e2e8f0', color: '#64748b', fontSize: '24px', fontWeight: 700, cursor: 'pointer'
                }}>+</button>
              </div>
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
