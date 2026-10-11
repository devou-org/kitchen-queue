import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';


const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'fallback-secret-change-in-production-32chars!!'
);
//STATELESS OTP ARCHITECTURE
export function generateOTP(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
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
  name?: string;
  isAdmin: boolean;
  isSuperAdmin?: boolean;
  restaurantId?: string;
  restaurantSlug?: string;
  restaurantName?: string;
  isStaff?: boolean;
  role?: string;
  roleId?: string;
  permissions?: string[];
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

export async function requireAdmin(request: Request | any): Promise<JWTPayload | null> {
  // --- TEST BYPASS (Development only) ---
  // if (process.env.NODE_ENV === 'development' && request.headers.get('x-test-bypass') === 'true') {
  //   return { isAdmin: true, userId: 'test-admin' } as JWTPayload;
  // }

  let adminToken: string | undefined;
  let staffToken: string | undefined;

  if (request.cookies && typeof request.cookies.get === 'function') {
    adminToken = request.cookies.get('admin_token')?.value;
    staffToken = request.cookies.get('staff_token')?.value;
  } else {
    const cookieHeader = request.headers.get('cookie');
    if (cookieHeader) {
      const matchAdmin = cookieHeader.match(/admin_token=([^;]+)/);
      if (matchAdmin) adminToken = matchAdmin[1];
      const matchStaff = cookieHeader.match(/staff_token=([^;]+)/);
      if (matchStaff) staffToken = matchStaff[1];
    }
  }

  let authHeader = request.headers.get('Authorization')?.replace('Bearer ', '');
  if (authHeader === 'null' || authHeader === 'undefined' || authHeader === '') {
    authHeader = undefined;
  }

  const tokensToTry = [authHeader, adminToken, staffToken].filter(Boolean) as string[];

  for (const t of tokensToTry) {
    const payload = await verifyToken(t);
    if (payload && (payload.isAdmin || payload.isStaff)) {
      return payload;
    }
  }

  return null;
}

export async function getAuthContext(request: Request | any): Promise<{ admin: JWTPayload | null, customer: JWTPayload | null }> {
  // --- TEST BYPASS (Development only) ---
  if (process.env.NODE_ENV === 'development' && request.headers.get('x-test-bypass') === 'true') {
    return { admin: { isAdmin: true, userId: 'test-admin' } as JWTPayload, customer: null };
  }

  let adminToken: string | undefined;
  let staffToken: string | undefined;
  let authToken: string | undefined;

  if (request.cookies && typeof request.cookies.get === 'function') {
    adminToken = request.cookies.get('admin_token')?.value;
    staffToken = request.cookies.get('staff_token')?.value;
    authToken = request.cookies.get('auth_token')?.value;
  } else {
    const cookieHeader = request.headers.get('cookie');
    if (cookieHeader) {
      const matchAdmin = cookieHeader.match(/admin_token=([^;]+)/);
      if (matchAdmin) adminToken = matchAdmin[1];
      const matchStaff = cookieHeader.match(/staff_token=([^;]+)/);
      if (matchStaff) staffToken = matchStaff[1];
      const matchAuth = cookieHeader.match(/auth_token=([^;]+)/);
      if (matchAuth) authToken = matchAuth[1];
    }
  }

  let authHeader = request.headers.get('Authorization')?.replace('Bearer ', '');
  if (authHeader === 'null' || authHeader === 'undefined' || authHeader === '') {
    authHeader = undefined;
  }

  const tokensToTry = [authHeader, adminToken, staffToken, authToken].filter(Boolean) as string[];

  let adminPayload: JWTPayload | null = null;
  let customerPayload: JWTPayload | null = null;

  for (const t of tokensToTry) {
    const payload = await verifyToken(t);
    if (payload) {
      if (payload.isAdmin || payload.isStaff) {
        if (!adminPayload) adminPayload = payload;
      } else {
        if (!customerPayload) customerPayload = payload;
      }
    }
  }

  return { admin: adminPayload, customer: customerPayload };
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

export async function sendOTPviaSMS(phone: string, otp: string, restaurantId?: string): Promise<{ success: boolean; error?: string; data?: any }> {
  try {
    const cleanPhone = phone.replace(/^\+91/, '').replace(/\D/g, '').slice(-10);

    const apiKey = process.env.FAST2SMS_API_KEY || '';
    if (!apiKey) {
      console.warn(`[SMS] FAST2SMS_API_KEY not configured. Dev OTP for ${phone}: ${otp}`);
      if (process.env.NODE_ENV !== 'production') {
        const { incrementOtpCount } = await import('./db');
        await incrementOtpCount(phone, restaurantId);
        return { success: true };
      }
      return { success: false, error: 'SMS service is not configured' };
    }

    const response = await fetch('https://www.fast2sms.com/dev/bulkV2', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Authorization': apiKey,
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
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

    const rawText = await response.text();
    let data: any = null;
    try {
      data = JSON.parse(rawText);
    } catch {
      console.error(`Fast2SMS returned non-JSON response (HTTP ${response.status}):`, rawText.slice(0, 300));
      if (process.env.NODE_ENV !== 'production') {
        console.warn(`[DEV FALLBACK] Fast2SMS returned HTML. Dev OTP for ${phone} is: ${otp}`);
        const { incrementOtpCount } = await import('./db');
        await incrementOtpCount(phone, restaurantId);
        return { success: true };
      }
      return { success: false, error: 'SMS provider gateway error. Please try again shortly.' };
    }

    console.log('SMS Response:', data);
    if (data && (data.return === true || data.return === "true" || (Array.isArray(data.message) && data.message.some((m: string) => m.toLowerCase().includes('successfully'))) || (typeof data.message === 'string' && data.message.toLowerCase().includes('successfully')))) {
      try {
        const { incrementOtpCount } = await import('./db');
        await incrementOtpCount(phone, restaurantId);
      } catch (logErr) {
        console.error('Failed to log OTP in db:', logErr);
      }
      return { success: true };
    }

    const errorMsg = data?.message
      ? (Array.isArray(data.message) ? data.message.join(', ') : String(data.message))
      : 'Fast2SMS API rejected request';

    if (process.env.NODE_ENV !== 'production') {
      console.warn(`[DEV FALLBACK] Fast2SMS error: ${errorMsg}. Dev OTP for ${phone} is: ${otp}`);
      const { incrementOtpCount } = await import('./db');
      await incrementOtpCount(phone, restaurantId);
      return { success: true };
    }

    return { success: false, error: errorMsg, data };
  } catch (error: any) {
    console.error('SMS send error:', error);
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`[DEV FALLBACK] SMS error: ${error.message}. Dev OTP for ${phone} is: ${otp}`);
      const { incrementOtpCount } = await import('./db');
      await incrementOtpCount(phone, restaurantId);
      return { success: true };
    }
    return { success: false, error: 'Failed to send SMS. Please try again shortly.' };
  }
}
