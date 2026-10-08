import { useState, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';
import { authService } from '@/app/services/auth.api';
import { User, BadgeCheck, Info, Gift, Tag, Check, Loader2, Award } from 'lucide-react';

import OrderTypeSelector from '@/components/modules/orders/OrderTypeSelector';
import { OrderType } from '@/types';
import { COUNTRY_CODES, getDefaultCallingCode } from '@/lib/constants';
import { CountryCodeSelect } from '@/components/ui/CountryCodeSelect';
import { useRestaurant } from '@/hooks/useRestaurant';

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
  rewards_unlocked?: number;
  visit_progress?: number;
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
  const { restaurant } = useRestaurant();
  const defaultCallingCode = useMemo(() => {
    return getDefaultCallingCode(restaurant?.country_code, restaurant?.country);
  }, [restaurant?.country_code, restaurant?.country]);

  const [otpStep, setOtpStep] = useState(false);
  const [otpCode, setOtpCode] = useState<string[]>(['', '', '', '']);
  const [otpToken, setOtpToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);

  const [countryCode, setCountryCode] = useState(defaultCallingCode);
  const [phoneDigits, setPhoneDigits] = useState('');

  // Loyalty & Rewards State
  const [loyaltySettings, setLoyaltySettings] = useState<any>(null);
  const [productsList, setProductsList] = useState<any[]>([]);
  const [loyaltyProfile, setLoyaltyProfile] = useState<CustomerLoyaltyInfo | null>(null);
  const [activeRewards, setActiveRewards] = useState<LoyaltyRewardOption[]>([]);
  const [loadingLoyalty, setLoadingLoyalty] = useState(false);

  // Fetch restaurant loyalty settings, rewards, and products catalog
  useEffect(() => {
    if (!slug) {
      setLoyaltySettings(null);
      setActiveRewards([]);
      setProductsList([]);
      return;
    }
    let isSubscribed = true;

    // 1. Fetch loyalty settings
    fetch(`/api/admin/loyalty/settings?slug=${slug}`)
      .then((r) => r.json())
      .then((json) => {
        if (isSubscribed && json.success && json.data) {
          setLoyaltySettings(json.data);
        }
      })
      .catch(() => {});

    // 2. Fetch active rewards catalog
    fetch(`/api/admin/loyalty/rewards?slug=${slug}`)
      .then((r) => r.json())
      .then((rewJson) => {
        if (isSubscribed && rewJson.success && Array.isArray(rewJson.data)) {
          const activeList = rewJson.data.filter((r: any) => r.is_active !== false);
          setActiveRewards(activeList);
        }
      })
      .catch(() => {});

    // 3. Fetch products list for Punch Card free gift matching
    fetch(`/api/products?slug=${slug}`)
      .then((r) => r.json())
      .then((prodJson) => {
        if (isSubscribed && (prodJson.success || Array.isArray(prodJson))) {
          const pArr = prodJson.data || prodJson || [];
          setProductsList(pArr);
        }
      })
      .catch(() => {});

    return () => {
      isSubscribed = false;
    };
  }, [slug]);

  const isLoyaltyConfigured = useMemo(() => {
    if (!loyaltySettings || loyaltySettings.is_enabled === false) return false;
    if (loyaltySettings.loyalty_mode === 'PUNCH_CARD') {
      return Boolean(loyaltySettings.visit_milestone_count);
    }
    return activeRewards.length > 0;
  }, [loyaltySettings, activeRewards]);

  const punchCardProduct = useMemo(() => {
    if (!loyaltySettings || !loyaltySettings.punch_card_product_id) return null;
    return productsList.find((p: any) => p.id === loyaltySettings.punch_card_product_id) || null;
  }, [loyaltySettings, productsList]);

  // Fetch Loyalty profile when phone is verified and loyalty is configured
  useEffect(() => {
    if (!isVerified || !form.phone || !slug || !isLoyaltyConfigured) {
      setLoyaltyProfile(null);
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
              visit_progress: Number(match.visit_progress || 0),
              rewards_unlocked: Number(match.rewards_unlocked || 0),
            });
          } else {
            setLoyaltyProfile({ id: '', points_balance: 0, total_visits: 0, total_spent: 0, visit_progress: 0, rewards_unlocked: 0 });
          }
        }
      } catch (err) {
        console.error('Error fetching loyalty customer data:', err);
      } finally {
        setLoadingLoyalty(false);
      }
    };

    fetchLoyaltyData();
  }, [isVerified, form.phone, slug, isLoyaltyConfigured]);

  // Notify parent whenever otpStep changes
  useEffect(() => {
    onOtpStepChange?.(otpStep);
  }, [otpStep, onOtpStepChange]);

  // Sync from parent when populated
  useEffect(() => {
    if (!form.phone) {
      setCountryCode(defaultCallingCode);
      setPhoneDigits('');
      return;
    }
    const matched = COUNTRY_CODES.find((c) => form.phone.startsWith(c.code));
    if (matched) {
      setCountryCode(matched.code);
      setPhoneDigits(form.phone.replace(matched.code, '').replace(/\D/g, ''));
    } else if (!form.phone.startsWith('+')) {
      const cleanDigits = form.phone.replace(/\D/g, '');
      setPhoneDigits(cleanDigits);
      setCountryCode(defaultCallingCode);
      if (cleanDigits) {
        setForm((f) => ({ ...f, phone: `${defaultCallingCode}${cleanDigits}` }));
      }
    } else {
      setPhoneDigits(form.phone.replace(/\D/g, ''));
    }
  }, [form.phone, defaultCallingCode, setForm]);

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
              <CountryCodeSelect
                value={countryCode}
                onChange={(code) => {
                  setCountryCode(code);
                  setForm(f => ({ ...f, phone: `${code}${phoneDigits}` }));
                }}
                disabled={otpStep || isVerified}
                buttonHeight="44px"
              />
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
            {/* LOYALTY & REWARDS CARD (WHEN VERIFIED AND REWARDS/PUNCH CARD ARE CONFIGURED) */}
            {isVerified && isLoyaltyConfigured && (
              <div style={{
                marginTop: '16px',
                padding: '16px',
                background: '#f8fafc',
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
              }}>
                {loyaltySettings?.loyalty_mode === 'PUNCH_CARD' ? (
                  /* Punch Card Mode */
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(151, 19, 69, 0.08)', color: 'var(--primary, #971345)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Award size={18} />
                        </div>
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>Loyalty — Visit Punch Card</div>
                          <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 500 }}>
                            {loadingLoyalty ? 'Checking visits...' : `${loyaltyProfile?.total_visits || 0} Total Visit(s) Recorded`}
                          </div>
                        </div>
                      </div>
                      <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '12px', background: '#ECFDF5', color: '#059669', border: '1px solid #A7F3D0' }}>
                        Punch Card Mode
                      </span>
                    </div>

                    {/* Visual Punch Circles */}
                    {(() => {
                      const target = Number(loyaltySettings?.visit_milestone_count || 5);
                      const currentProgress = (loyaltyProfile?.total_visits || 0) % target;
                      return (
                        <div style={{ marginTop: '4px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                            <span style={{ fontSize: '11px', fontWeight: 700, color: '#475569' }}>
                              Milestone Progress: {currentProgress} / {target} Punches
                            </span>
                            <span style={{ fontSize: '10.5px', color: '#64748b' }}>
                              Reward every {target}th visit
                            </span>
                          </div>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            {Array.from({ length: target }).map((_, idx) => {
                              const isPunched = idx < currentProgress;
                              return (
                                <div
                                  key={idx}
                                  style={{
                                    flex: 1,
                                    height: '28px',
                                    borderRadius: '6px',
                                    background: isPunched ? '#10B981' : '#E2E8F0',
                                    color: isPunched ? '#FFFFFF' : '#94A3B8',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '11px',
                                    fontWeight: 700,
                                  }}
                                >
                                  {isPunched ? '✓' : idx + 1}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Milestone Unlocked Banner & Claim Button */}
                    {Number(loyaltyProfile?.rewards_unlocked || 0) > 0 && (
                      <div style={{ marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ 
                          padding: '8px 12px', 
                          background: '#ECFDF5', 
                          border: '1px solid #A7F3D0', 
                          borderRadius: '8px', 
                          fontSize: '11.5px', 
                          fontWeight: 700, 
                          color: '#047857',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}>
                          <Award size={15} color="#059669" />
                          <span>Milestone Reward Unlocked! You have {loyaltyProfile?.rewards_unlocked} visit reward(s) available.</span>
                        </div>

                        {selectedReward?.id === 'PUNCH_CARD_MILESTONE' ? (
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            background: '#F0FDF4',
                            border: '1.5px solid #16A34A',
                            borderRadius: '8px',
                            padding: '8px 12px'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <Gift size={16} color="#16A34A" />
                              <div>
                                <div style={{ fontSize: '12px', fontWeight: 700, color: '#15803D' }}>
                                  ✓ Free Gift Claimed: {punchCardProduct?.name || 'Free Menu Item'}
                                </div>
                                <div style={{ fontSize: '11px', color: '#16A34A', fontWeight: 600 }}>
                                  Price cut off to ₹0
                                </div>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => onSelectReward(null)}
                              style={{
                                fontSize: '11px',
                                color: '#EF4444',
                                background: '#FEF2F2',
                                border: '1px solid #FCA5A5',
                                borderRadius: '6px',
                                padding: '4px 8px',
                                cursor: 'pointer',
                                fontWeight: 600,
                              }}
                            >
                              Remove
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              onSelectReward({
                                id: 'PUNCH_CARD_MILESTONE',
                                name: `Free Gift: ${punchCardProduct?.name || 'Milestone Reward'}`,
                                points_required: 0,
                                reward_type: 'FREE_ITEM',
                                discount_value: punchCardProduct?.price || 0,
                                min_purchase_amount: 0,
                                selected_product_ids: punchCardProduct?.id ? [punchCardProduct.id] : [],
                                is_active: true,
                              });
                            }}
                            style={{
                              width: '100%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '6px',
                              padding: '9px 14px',
                              borderRadius: '8px',
                              background: 'var(--primary, #971345)',
                              color: '#FFFFFF',
                              fontSize: '12.5px',
                              fontWeight: 700,
                              border: 'none',
                              cursor: 'pointer',
                              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                            }}
                          >
                            <Gift size={15} />
                            <span>Claim Free Gift: {punchCardProduct?.name || 'Milestone Reward'} → FREE</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  /* Points Mode Catalog */
                  <div>
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
