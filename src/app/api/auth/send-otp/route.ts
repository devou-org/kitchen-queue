import { NextRequest, NextResponse } from 'next/server';
import { generateOTP, generateOTPToken, sendOTPviaSMS } from '@/lib/auth';
import { validatePhone } from '@/lib/validators';
import { getRestaurantBySlug } from '@/lib/db';

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

    const otp = generateOTP();
    const otp_token = await generateOTPToken(phone, otp, '1m');

    const smsSent = await sendOTPviaSMS(phone, otp, restaurantId);
    if (!smsSent) {
      return NextResponse.json({ success: false, error: 'Failed to send OTP. Please try again.' }, { status: 502 });
    }



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
