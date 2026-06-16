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
