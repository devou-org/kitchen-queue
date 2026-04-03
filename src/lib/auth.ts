import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'fallback-secret-change-in-production-32chars!!'
);

// ============================================
// OTP MANAGEMENT (In-memory store)
// ============================================

interface OTPData {
  code: string;
  expires_at: number;
  attempts: number;
  last_sent: number;
}

// Provide a global singleton for Next.js hot-reload survival
const globalAuth = global as typeof global & { otpStore?: Map<string, OTPData> };
if (!globalAuth.otpStore) {
  globalAuth.otpStore = new Map<string, OTPData>();
}
const otpStore = globalAuth.otpStore;

export function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export function storeOTP(phone: string, code: string): void {
  otpStore.set(phone, {
    code,
    expires_at: Date.now() + 5 * 60 * 1000, // 5 minute grace period internally (despite 1 min text)
    attempts: 0,
    last_sent: Date.now(),
  });
}

export function canSendOTP(phone: string): boolean {
  const data = otpStore.get(phone);
  if (!data) return true;
  return Date.now() - data.last_sent > 60 * 1000; // 1 minute cooldown
}

export function verifyOTPCode(phone: string, code: string): { valid: boolean; message: string } {
  const data = otpStore.get(phone);

  if (!data) {
    return { valid: false, message: 'No OTP sent for this phone number' };
  }

  if (Date.now() > data.expires_at) {
    otpStore.delete(phone);
    return { valid: false, message: 'OTP has expired. Please request a new one.' };
  }

  if (data.attempts >= 3) {
    otpStore.delete(phone);
    return { valid: false, message: 'Too many failed attempts. Please request a new OTP.' };
  }

  if (data.code !== code) {
    data.attempts++;
    return { valid: false, message: `Invalid OTP. ${3 - data.attempts} attempts remaining.` };
  }

  otpStore.delete(phone);
  return { valid: true, message: 'OTP verified successfully' };
}

// ============================================
// JWT MANAGEMENT
// ============================================

export interface JWTPayload {
  userId: string;
  phone?: string;
  email?: string;
  isAdmin: boolean;
  iat?: number;
  exp?: number;
}

export async function generateToken(payload: Omit<JWTPayload, 'iat' | 'exp'>, expiresIn = '7d'): Promise<string> {
  return new SignJWT(payload as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(JWT_SECRET);
}

export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as JWTPayload;
  } catch {
    return null;
  }
}

// ============================================
// PASSWORD MANAGEMENT
// ============================================

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ============================================
// FAST2SMS OTP SENDER
// ============================================

export async function sendOTPviaSMS(phone: string, otp: string): Promise<boolean> {
  try {
    const cleanPhone = phone.replace(/^\+91/, '').replace(/\D/g, '');

    const response = await fetch('https://www.fast2sms.com/dev/bulkV2', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'authorization': process.env.FAST2SMS_API_KEY || 'A2ODEeZKJlsnkJRyY2uEAoOr2gr5NOwV7PB2iooB0gal6AvDr3VGNBJtgHHA',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        sender_id: 'DEVOU',
        message: `Dear User, your OTP for login is ${otp}. This OTP is valid for only 1 minute. Do not share it with anyone. - DEVOU SOLUTIONS`,
        route: 'dlt_manual',
        template_id: '1707177408514551819',
        entity_id: '1701177402339097478',
        numbers: cleanPhone,
      }),
    });

    const data = await response.json();
    console.log('SMS Response:', data);
    return data.return === true;
  } catch (error) {
    console.error('SMS send error:', error);
    return false;
  }
}
