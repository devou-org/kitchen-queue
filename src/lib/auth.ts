import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';


const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'fallback-secret-change-in-production-32chars!!'
);
//STATELESS OTP ARCHITECTURE
export function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

interface OTPTokenPayload {
  phone: string;
  otp: string;
  purpose: 'otp_verification';
  iat?: number;
  exp?: number;
}

export async function generateOTPToken(phone: string, otp: string, expiresIn = '1m'): Promise<string> {
  return new SignJWT({
    phone,
    otp,
    purpose: 'otp_verification',
  } as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(JWT_SECRET);
}

export async function verifyOTPToken(token: string): Promise<OTPTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const otpPayload = payload as unknown as OTPTokenPayload;
    if (otpPayload.purpose !== 'otp_verification' || !otpPayload.phone || !otpPayload.otp) {
      return null;
    }
    return otpPayload;
  } catch {
    return null;
  }
}

// ============================================
// JWT MANAGEMENT
// ============================================

export interface JWTPayload {
  userId: string;
  phone?: string;
  email?: string;
  isAdmin: boolean;
  isSuperAdmin?: boolean;
  iat?: number;
  exp?: number;
}

export async function generateAccessToken(payload: Omit<JWTPayload, 'iat' | 'exp'>, expiresIn = '1d'): Promise<string> {
  return new SignJWT(payload as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(JWT_SECRET);
}

export interface RefreshTokenPayload {
  userId: string;
  tokenVersion: number;
  iat?: number;
  exp?: number;
}

export async function generateRefreshToken(payload: Omit<RefreshTokenPayload, 'iat' | 'exp'>, expiresIn = '90d'): Promise<string> {
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
// FAST2SMS OTP SENDER (Dynamic import to prevent Edge runtime crash in middleware)
// ============================================

export async function sendOTPviaSMS(phone: string, otp: string, restaurantId?: string): Promise<boolean> {
  try {
    const cleanPhone = phone.replace(/^\+91/, '').replace(/\D/g, '');

    const response = await fetch('https://www.fast2sms.com/dev/bulkV2', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'authorization': process.env.FAST2SMS_API_KEY || '',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        sender_id: 'DEVOU',
        message: `Dear User, your OTP for login is ${otp}. This OTP is valid for only 1 minute. Do not share it with anyone. - DEVOU SOLUTIONS`,
        route: 'dlt_manual',
        template_id: process.env.FAST2SMS_TEMPLATE_ID || '',
        entity_id: process.env.FAST2SMS_ENTITY_ID || '',
        numbers: cleanPhone,
      }),
    });

    const data = await response.json();
    console.log('SMS Response:', data);
    if (data.return === true) {
      const { incrementOtpCount } = await import('./db');
      await incrementOtpCount(phone, restaurantId);
      return true;
    }
    return false;
  } catch (error) {
    console.error('SMS send error:', error);
    return false;
  }
}
