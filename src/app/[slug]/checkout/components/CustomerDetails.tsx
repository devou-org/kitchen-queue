import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { authService } from '@/app/services/auth.api';
import { User, BadgeCheck, Info, Gift, Tag, Check, Loader2 } from 'lucide-react';

import OrderTypeSelector from '@/components/modules/orders/OrderTypeSelector';
import { OrderType } from '@/types';

const COUNTRY_CODES = [
  { code: '+91', label: '+91', country: 'India' },
];

export interface LoyaltyRewardOption {
  id: string;
  name: string;
  points_required: number;
  reward_type: 'DISCOUNT_AMOUNT' | 'DISCOUNT_PERCENTAGE' | 'FREE_ITEM';
  discount_value: number;
  min_purchase_amount: number;
  selected_product_ids?: string[];
  is_active: boolean;
}

export interface CustomerLoyaltyInfo {
  id: string;
  points_balance: number;
  total_visits: number;
  total_spent: number;
}

interface CustomerDetailsProps {
  slug: string;
  subtotal: number;
  form: {
    customer_name: string;
    phone: string;
    party_size: string;
    notes: string;
    order_type?: OrderType | string;
  };
  setForm: React.Dispatch<React.SetStateAction<{
    customer_name: string;
    phone: string;
    party_size: string;
    notes: string;
    order_type?: OrderType | string;
  }>>;
  isVerified: boolean;
  onVerified: (user: any) => void;
  onSubmit: (e: React.FormEvent) => void;
  totalQty?: number;
  onOtpStepChange?: (inOtpStep: boolean) => void;
  selectedReward: LoyaltyRewardOption | null;
  onSelectReward: (reward: LoyaltyRewardOption | null) => void;
}

export default function CustomerDetails({ 
  slug,
  subtotal,
  form, 
  setForm, 
  isVerified, 
  onVerified,
  onSubmit,
  totalQty,
  onOtpStepChange,
  selectedReward,
  onSelectReward
}: CustomerDetailsProps) {
  const [otpStep, setOtpStep] = useState(false);
  const [otpCode, setOtpCode] = useState<string[]>(['', '', '', '']);
  const [otpToken, setOtpToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);

  const [countryCode, setCountryCode] = useState('+91');
  const [phoneDigits, setPhoneDigits] = useState('');

  // Loyalty & Rewards State
  const [loyaltyProfile, setLoyaltyProfile] = useState<CustomerLoyaltyInfo | null>(null);
  const [activeRewards, setActiveRewards] = useState<LoyaltyRewardOption[]>([]);
  const [loadingLoyalty, setLoadingLoyalty] = useState(false);

  // Fetch Loyalty profile and rewards when phone is verified
  useEffect(() => {
    if (!isVerified || !form.phone || !slug) {
      setLoyaltyProfile(null);
      setActiveRewards([]);
      return;
    }

    const fetchLoyaltyData = async () => {
      setLoadingLoyalty(true);
      try {
        const cleanedPhone = form.phone.replace(/\D/g, '').slice(-10);
        // Fetch customer profile
        const custRes = await fetch(`/api/admin/loyalty/customers?slug=${slug}&search=${encodeURIComponent(cleanedPhone)}`);
        const custJson = await custRes.json();
        if (custJson.success && Array.isArray(custJson.data)) {
          const match = custJson.data.find((c: any) => {
            const cPhone = (c.phone || '').replace(/\D/g, '');
            return cPhone.endsWith(cleanedPhone) || cleanedPhone.endsWith(cPhone);
          });
          if (match) {
            setLoyaltyProfile({
              id: match.id,
              points_balance: Number(match.points_balance || 0),
              total_visits: Number(match.total_visits || 0),
              total_spent: Number(match.total_spent || 0),
            });
          } else {
            setLoyaltyProfile({ id: '', points_balance: 0, total_visits: 0, total_spent: 0 });
          }
        }

        // Fetch active rewards catalog
        const rewRes = await fetch(`/api/admin/loyalty/rewards?slug=${slug}`);
        const rewJson = await rewRes.json();
        if (rewJson.success && Array.isArray(rewJson.data)) {
          const activeList = rewJson.data.filter((r: any) => r.is_active !== false);
          setActiveRewards(activeList);
        }
      } catch (err) {
        console.error('Error fetching loyalty customer data:', err);
      } finally {
        setLoadingLoyalty(false);
      }
    };

    fetchLoyaltyData();
  }, [isVerified, form.phone, slug]);

  // Notify parent whenever otpStep changes
  useEffect(() => {
    onOtpStepChange?.(otpStep);
  }, [otpStep, onOtpStepChange]);

  // Sync from parent when populated
  useEffect(() => {
    if (form.phone) {
      if (form.phone.startsWith('+91')) {
        setCountryCode('+91');
        setPhoneDigits(form.phone.replace('+91', ''));
      } else if (!form.phone.startsWith('+')) {
        const cleanDigits = form.phone.replace(/\D/g, '');
        setPhoneDigits(cleanDigits);
        // Correct the parent state to include the country code
        if (cleanDigits) {
           setForm(f => ({ ...f, phone: `+91${cleanDigits}` }));
        }
      } else {
        setPhoneDigits(form.phone.replace(/\D/g, ''));
      }
    }
  }, [form.phone]);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '');
    setPhoneDigits(val);
    setForm(f => ({ ...f, phone: `${countryCode}${val}` }));
  };

  const handleCountryCodeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const code = e.target.value;
    setCountryCode(code);
    setForm(f => ({ ...f, phone: `${code}${phoneDigits}` }));
  };

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
        setTimeout(() => {
          document.getElementById('otp-input-0')?.focus();
        }, 100);
      } else {
        toast.error(data.error || 'Failed to send OTP');
      }
    } catch (err) {
      toast.error('Network error. Please try again.');
    } finally {
      setLoading(false);
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
      <div style={{ marginBottom: '16px' }}>
        <OrderTypeSelector
          value={(form.order_type as OrderType) || 'DINE_IN'}
          onChange={(val) => setForm(f => ({ ...f, order_type: val }))}
        />
      </div>
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
              <select
                className="select"
                value={countryCode}
                onChange={handleCountryCodeChange}
                style={{ width: '75px', flexShrink: 0, paddingLeft: '8px', paddingRight: '24px' }}
                disabled={otpStep || isVerified}
              >
                {COUNTRY_CODES.map(c => (
                  <option key={c.code} value={c.code}>{c.label}</option>
                ))}
              </select>
              <input
                type="tel"
                className="input"
                placeholder="9xxxxxxxxx"
                value={phoneDigits}
                onChange={handlePhoneChange}
                maxLength={10}
                style={{ flex: 1, minWidth: 0 }}
                required
                disabled={otpStep || isVerified}
              />
              {isVerified ? (
                <span style={{ 
                  color: '#10B981', background: 'rgba(16, 185, 129, 0.1)', 
                  padding: '0 12px', borderRadius: '8px', fontSize: '13px', fontWeight: 700,
                  display: 'flex', alignItems: 'center', gap: '6px', height: '44px'
                }}>
                  <BadgeCheck size={16} /> Verified
                </span>
              ) : (
                otpStep ? (
                  <button 
                    type="button" 
                    onClick={() => { setOtpStep(false); setOtpCode(['', '', '', '']); }}
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
            
            {/* NEW 4-DIGIT OTP FIELD UI */}
            {otpStep && !isVerified && (
              <div style={{ marginTop: '16px', padding: '20px', background: 'color-mix(in srgb, var(--primary) 8%, white)', borderRadius: '16px', border: '1px solid color-mix(in srgb, var(--primary) 20%, white)', animation: 'slideDown 0.3s ease-out' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--primary)', fontWeight: 800 }}>ENTER 4-DIGIT OTP</span>
                  <span style={{ background: 'white', padding: '4px 12px', borderRadius: '16px', fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 500, border: '1px solid color-mix(in srgb, var(--primary) 15%, white)' }}>
                    Sent to {countryCode} {phoneDigits.slice(-4).padStart(10, '*')}
                  </span>
                </div>
                
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginBottom: '24px' }}>
                  {[0, 1, 2, 3].map((index) => (
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
                        
                        if (val && index < 3) {
                          const next = document.getElementById(`otp-input-${index + 1}`);
                          if (next) next.focus();
                        }

                        // Auto submit when 4th digit is entered
                        if (val && index === 3) {
                          const completeCode = newOtp.join('');
                          if (completeCode.length === 4) {
                            verifyOtpSubmit(completeCode);
                          }
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
                        const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4);
                        if (pastedData) {
                          const newOtp = ['', '', '', ''];
                          pastedData.split('').forEach((d, i) => {
                            if (i < 4) newOtp[i] = d;
                          });
                          setOtpCode(newOtp);
                          const nextIndex = Math.min(pastedData.length, 3);
                          const next = document.getElementById(`otp-input-${nextIndex}`);
                          if (next) next.focus();
                          if (pastedData.length === 4) {
                            verifyOtpSubmit(pastedData);
                          }
                        }
                      }}
                      style={{
                        width: '52px',
                        height: '56px',
                        textAlign: 'center',
                        fontSize: '22px',
                        fontWeight: 800,
                        borderRadius: '12px',
                        border: '1.5px solid color-mix(in srgb, var(--primary) 25%, white)',
                        background: 'white',
                        color: 'var(--primary)',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
                        outlineColor: 'var(--primary)'
                      }}
                    />
                  ))}
                </div>
                
                <button 
                  type="button" 
                  onClick={() => verifyOtpSubmit()}
                  disabled={verifyingOtp || otpCode.join('').replace(/\D/g, '').length !== 4}
                  style={{ 
                    width: '100%', 
                    padding: '16px', 
                    borderRadius: '12px', 
                    background: 'var(--primary)', 
                    color: 'white', 
                    fontWeight: 700,
                    fontSize: '15px',
                    border: 'none',
                    opacity: (verifyingOtp || otpCode.join('').replace(/\D/g, '').length !== 4) ? 0.7 : 1,
                    cursor: (verifyingOtp || otpCode.join('').replace(/\D/g, '').length !== 4) ? 'not-allowed' : 'pointer',
                    boxShadow: '0 4px 14px rgba(0,0,0,0.1)'
                  }}
                >
                  {verifyingOtp ? 'Verifying...' : 'Verify Code'}
                </button>
                
                <div style={{ marginTop: '20px', textAlign: 'center' }}>
                  {resendTimer > 0 ? (
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0, fontWeight: 500 }}>
                      Didn't receive it? <span style={{ color: 'var(--primary)', fontWeight: 700 }}>Resend in {resendTimer}s</span>
                    </p>
                  ) : (
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0, fontWeight: 500 }}>
                      Didn't receive it? <button type="button" onClick={handleVerifyClick} style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: 700, cursor: 'pointer', padding: 0 }}>Resend OTP</button>
                    </p>
                  )}
                </div>
              </div>
            )}
            {/* LOYALTY & REWARDS CARD (WHEN VERIFIED) */}
            {isVerified && (
              <div style={{
                marginTop: '16px',
                padding: '16px',
                background: '#f8fafc',
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: activeRewards.length > 0 ? '12px' : 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#ecfdf5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Gift size={18} />
                    </div>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>Loyalty Member Balance</div>
                      <div style={{ fontSize: '12px', color: '#059669', fontWeight: 700 }}>
                        {loadingLoyalty ? 'Checking balance...' : `${(loyaltyProfile?.points_balance || 0).toLocaleString()} Points Available`}
                      </div>
                    </div>
                  </div>
                  {loyaltyProfile && loyaltyProfile.total_visits > 0 && (
                    <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '12px', background: '#e0f2fe', color: '#0369a1' }}>
                      {loyaltyProfile.total_visits} Visit{loyaltyProfile.total_visits === 1 ? '' : 's'}
                    </span>
                  )}
                </div>

                {/* Available Rewards Catalog - Carousel Format */}
                {activeRewards.length > 0 && (
                  <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Redeem Available Reward
                      </span>
                      {activeRewards.length > 1 && (
                        <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 500 }}>
                          Scroll for more →
                        </span>
                      )}
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        gap: '12px',
                        overflowX: 'auto',
                        paddingBottom: '8px',
                        paddingTop: '2px',
                        scrollSnapType: 'x mandatory',
                        WebkitOverflowScrolling: 'touch',
                      }}
                    >
                      {activeRewards.map(reward => {
                        const userPoints = loyaltyProfile?.points_balance || 0;
                        const hasEnoughPoints = userPoints >= reward.points_required;
                        const meetsMinSpend = subtotal >= reward.min_purchase_amount;
                        const isSelected = selectedReward?.id === reward.id;

                        let benefitText = '';
                        if (reward.reward_type === 'DISCOUNT_AMOUNT') {
                          benefitText = `₹${reward.discount_value} Flat Discount`;
                        } else if (reward.reward_type === 'DISCOUNT_PERCENTAGE') {
                          benefitText = `${reward.discount_value}% Off Order`;
                        } else {
                          benefitText = `Free Item Voucher`;
                        }

                        return (
                          <div
                            key={reward.id}
                            style={{
                              flex: '0 0 230px',
                              minWidth: '230px',
                              scrollSnapAlign: 'start',
                              display: 'flex',
                              flexDirection: 'column',
                              justifyContent: 'space-between',
                              padding: '12px',
                              borderRadius: '12px',
                              background: isSelected ? 'color-mix(in srgb, var(--primary, #059669) 8%, white)' : 'white',
                              border: isSelected ? '1.5px solid var(--primary, #059669)' : '1px solid #cbd5e1',
                              boxShadow: isSelected ? '0 4px 12px rgba(5, 150, 105, 0.12)' : '0 1px 3px rgba(0,0,0,0.04)',
                              gap: '10px',
                            }}
                          >
                            <div>
                              <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                                <Tag size={14} style={{ color: 'var(--primary, #059669)', flexShrink: 0 }} />
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{reward.name}</span>
                              </div>
                              <div style={{ fontSize: '12px', fontWeight: 700, color: '#059669', marginBottom: '4px' }}>
                                {benefitText}
                              </div>
                              <div style={{ fontSize: '11px', color: '#d97706', fontWeight: 700 }}>
                                {reward.points_required} pts required
                              </div>
                              {reward.min_purchase_amount > 0 && (
                                <div style={{ fontSize: '10.5px', color: '#64748b', marginTop: '2px' }}>
                                  Min spend: ₹{reward.min_purchase_amount}
                                </div>
                              )}
                            </div>

                            {/* Action Button */}
                            <div>
                              {isSelected ? (
                                <button
                                  type="button"
                                  onClick={() => onSelectReward(null)}
                                  style={{
                                    width: '100%',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '4px',
                                    padding: '7px 12px',
                                    borderRadius: '8px',
                                    background: 'var(--primary, #059669)',
                                    color: 'white',
                                    fontSize: '12px',
                                    fontWeight: 700,
                                    border: 'none',
                                    cursor: 'pointer',
                                  }}
                                >
                                  <Check size={14} /> Applied
                                </button>
                              ) : hasEnoughPoints && meetsMinSpend ? (
                                <button
                                  type="button"
                                  onClick={() => onSelectReward(reward)}
                                  style={{
                                    width: '100%',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '4px',
                                    padding: '7px 12px',
                                    borderRadius: '8px',
                                    background: 'white',
                                    color: 'var(--primary, #059669)',
                                    fontSize: '12px',
                                    fontWeight: 700,
                                    border: '1px solid var(--primary, #059669)',
                                    cursor: 'pointer',
                                  }}
                                >
                                  Redeem
                                </button>
                              ) : !meetsMinSpend ? (
                                <div style={{ width: '100%', textAlign: 'center', fontSize: '11px', fontWeight: 600, color: '#94a3b8', background: '#f1f5f9', padding: '6px 8px', borderRadius: '6px' }}>
                                  Min spend ₹{reward.min_purchase_amount}
                                </div>
                              ) : (
                                <div style={{ width: '100%', textAlign: 'center', fontSize: '11px', fontWeight: 600, color: '#94a3b8', background: '#f1f5f9', padding: '6px 8px', borderRadius: '6px' }}>
                                  Needs {reward.points_required - userPoints} pts
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          {form.order_type !== 'TAKEAWAY' && (
            <div>
              <label className="label">Number of Persons *</label>
              <select
                className="select"
                value={form.party_size}
                onChange={e => setForm(f => ({ ...f, party_size: e.target.value }))}
                required={form.order_type !== 'TAKEAWAY'}
              >
                <option value="" disabled>Select persons</option>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                  <option key={n} value={n}>{n} Party</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>
    </form>
  );
}
