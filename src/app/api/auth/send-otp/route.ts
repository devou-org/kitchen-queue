import { NextRequest, NextResponse } from 'next/server';
import { generateOTP, generateOTPToken, sendOTPviaSMS } from '@/lib/auth';
import { validatePhone } from '@/lib/validators';
import { getRestaurantBySlug } from '@/lib/db';
import sql from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phone } = body;
    const slug = request.headers.get('x-restaurant-slug');

    if (!phone) {
      return NextResponse.json({ success: false, error: 'Phone number is required' }, { status: 400 });
    }

    const validation = validatePhone(phone);
    if (!validation.valid) {
      return NextResponse.json({ success: false, error: validation.message }, { status: 400 });
    }

    let restaurantId: string | undefined = undefined;
    if (slug) {
      const restaurant = await getRestaurantBySlug(slug);
      if (restaurant) {
        restaurantId = restaurant.id;
      }
    }

    // --- Rate Limit check start ---
    // Ensure table exists
    await sql`
      CREATE TABLE IF NOT EXISTS otp_requests (
        id SERIAL PRIMARY KEY,
        phone VARCHAR(20) NOT NULL,
        requested_at TIMESTAMP DEFAULT NOW()
      )
    `;

    // Clean up old requests to keep table small
    await sql`DELETE FROM otp_requests WHERE requested_at < NOW() - INTERVAL '10 minutes'`;

    const recentRequests = await sql`
      SELECT COUNT(*) as count 
      FROM otp_requests 
      WHERE phone = ${phone} AND requested_at > NOW() - INTERVAL '10 minutes'
    `;

    if (recentRequests[0] && parseInt(recentRequests[0].count) >= 3) {
      return NextResponse.json({ success: false, error: 'Too many OTP requests. Please wait 10 minutes.' }, { status: 429 });
    }
    // --- Rate Limit check end ---

    const otp = generateOTP();
    const otp_token = await generateOTPToken(phone, otp, '1m');

    const smsSent = await sendOTPviaSMS(phone, otp, restaurantId);
    if (!smsSent) {
      return NextResponse.json({ success: false, error: 'Failed to send OTP. Please try again.' }, { status: 502 });
    }

    // Log the successful OTP request for rate limiting
    await sql`INSERT INTO otp_requests (phone) VALUES (${phone})`;



    return NextResponse.json({
      success: true,
      message: 'OTP sent to your phone',
      otp_token,
      expires_in: 60,
    });
  } catch (error) {
    console.error('Send OTP error:', error);
    return NextResponse.json({ success: false, error: 'Failed to send OTP' }, { status: 500 });
  }
}
