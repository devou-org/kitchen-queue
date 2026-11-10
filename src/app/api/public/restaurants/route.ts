import { NextRequest, NextResponse } from 'next/server';
import { createRestaurant, seedDefaultRoles, pool } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { SubscriptionService, SaaSProductId, SaaSPlanTier, BillingCycle } from '@/modules/billing/subscription.service';
import { AuthTokenService } from '@/modules/auth/auth-token.service';
import { emailService } from '@/modules/email/email.service';
import { QueueService } from '@/modules/queue/queue.service';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
};

// Handle OPTIONS for CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}

// Helper to generate a clean URL slug from name
function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')        // Replace spaces with -
    .replace(/[^\w\-]+/g, '')    // Remove all non-word chars
    .replace(/\-\-+/g, '-')      // Replace multiple - with single -
    .replace(/^-+/, '')          // Trim - from start of text
    .replace(/-+$/, '');         // Trim - from end of text
}

// POST /api/public/restaurants - Public Onboarding API (No auth/token required)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name,
      slug: customSlug,
      admin_email,
      admin_password,
      admin_name,
      phone,
      address,
      logo_url,
      primary_color,
      secondary_color,
      menu_layout,
      menu_title,
      menu_description,
      timezone,
      opening_time,
      closing_time,
      gst_type,
      gst_number,
      gst_rate,
      product: requestedProduct,
      plan: requestedPlan,
      billing_cycle: requestedBillingCycle,
      email_verification_otp,
      modules
    } = body;

    // 1. Validation: Restaurant Name
    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json(
        { success: false, error: 'Restaurant name is required' },
        { status: 400, headers: corsHeaders }
      );
    }
    const restaurantName = name.trim();

    // 2. Validation: Product Selection
    const normalizedProduct: SaaSProductId = (
      requestedProduct
        ? String(requestedProduct).toUpperCase().trim()
        : 'POS'
    ) as SaaSProductId;

    const validProducts: SaaSProductId[] = ['POS', 'DIGITAL_MENU', 'QUEUE_MANAGEMENT'];
    if (!validProducts.includes(normalizedProduct)) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid product '${requestedProduct}'. Must be one of: POS, DIGITAL_MENU, QUEUE_MANAGEMENT.`,
        },
        { status: 400, headers: corsHeaders }
      );
    }

    // 3. Validation: Billing Cycle
    const normalizedBillingCycle: BillingCycle = (
      requestedBillingCycle
        ? String(requestedBillingCycle).toUpperCase().trim()
        : 'ANNUALLY'
    ) as BillingCycle;

    if (!['ANNUALLY', 'MONTHLY'].includes(normalizedBillingCycle)) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid billing_cycle '${requestedBillingCycle}'. Must be either 'ANNUALLY' or 'MONTHLY'.`,
        },
        { status: 400, headers: corsHeaders }
      );
    }

    // 4. Validation: Plan Tier (for POS)
    let planTier: SaaSPlanTier = 'PREMIUM';
    if (normalizedProduct === 'POS') {
      if (requestedPlan) {
        const upperPlan = String(requestedPlan).toUpperCase().trim();
        if (upperPlan === 'ESSENTIAL' || upperPlan === 'PREMIUM') {
          planTier = upperPlan as SaaSPlanTier;
        } else {
          return NextResponse.json(
            {
              success: false,
              error: `Invalid plan '${requestedPlan}' for POS. Must be 'ESSENTIAL' or 'PREMIUM'.`,
            },
            { status: 400, headers: corsHeaders }
          );
        }
      }
    } else {
      planTier = 'STANDALONE';
    }

    // 5. Validation: Admin Credentials
    if (!admin_email || typeof admin_email !== 'string' || !admin_email.trim()) {
      return NextResponse.json(
        { success: false, error: 'Admin email (admin_email) is required for store ownership' },
        { status: 400, headers: corsHeaders }
      );
    }
    const emailTrimmed = admin_email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailTrimmed)) {
      return NextResponse.json(
        { success: false, error: 'Invalid email address format' },
        { status: 400, headers: corsHeaders }
      );
    }

    if (!admin_password || typeof admin_password !== 'string' || admin_password.length < 6) {
      return NextResponse.json(
        { success: false, error: 'Admin password (admin_password) must be at least 6 characters long' },
        { status: 400, headers: corsHeaders }
      );
    }

    // 6. Validation: Unique Admin Email
    const existingAdmin = await pool.query(
      `SELECT id FROM admins WHERE LOWER(email) = $1 LIMIT 1`,
      [emailTrimmed]
    );
    if (existingAdmin.rows.length > 0) {
      return NextResponse.json(
        { success: false, error: 'An account with this admin email already exists. Please use a different email or log in.' },
        { status: 409, headers: corsHeaders }
      );
    }

    // 7. Email Verification Validation (Mandatory for store onboarding)
    if (!email_verification_otp || !String(email_verification_otp).trim()) {
      return NextResponse.json(
        {
          success: false,
          error: 'Email verification code (email_verification_otp) is required. Please request a verification code via /api/auth/send-verification-otp and verify your email to complete onboarding.',
          code: 'EMAIL_VERIFICATION_REQUIRED',
        },
        { status: 400, headers: corsHeaders }
      );
    }

    const isValidOtp = await AuthTokenService.verifyAndConsumeOtp(
      emailTrimmed,
      String(email_verification_otp).trim(),
      'EMAIL_VERIFICATION'
    );
    if (!isValidOtp) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid or expired email verification code. Please request a new code.',
          code: 'INVALID_VERIFICATION_CODE',
        },
        { status: 400, headers: corsHeaders }
      );
    }
    const isEmailVerified = true;

    // 8. Determine & Validate Slug
    let targetSlug = customSlug ? customSlug.trim().toLowerCase() : slugify(restaurantName);
    if (!targetSlug) {
      targetSlug = 'restaurant-' + Math.random().toString(36).substring(2, 7);
    }

    if (!/^[a-z0-9-]+$/.test(targetSlug)) {
      return NextResponse.json(
        { success: false, error: 'Slug must contain only lowercase alphanumeric characters and hyphens' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Check if slug is already taken
    const existingSlug = await pool.query(
      `SELECT id FROM restaurants WHERE slug = $1 LIMIT 1`,
      [targetSlug]
    );
    if (existingSlug.rows.length > 0) {
      if (customSlug) {
        return NextResponse.json(
          { success: false, error: `The store slug '${targetSlug}' is already taken. Please choose another.` },
          { status: 409, headers: corsHeaders }
        );
      }
      targetSlug = `${targetSlug}-${Math.random().toString(36).substring(2, 6)}`;
    }

    // 9. Determine Initial Modules Based on Chosen Product & Plan
    let initialModules: string[] | undefined = undefined;
    if (Array.isArray(modules) && modules.length > 0) {
      initialModules = modules;
    } else if (normalizedProduct === 'DIGITAL_MENU') {
      initialModules = ['DIGITAL_MENU'];
    } else if (normalizedProduct === 'QUEUE_MANAGEMENT') {
      initialModules = ['QUEUE_MANAGEMENT', 'DIGITAL_MENU'];
    } else if (planTier === 'ESSENTIAL') {
      // Essential Plan only gets core POS & Table Management, Digital Menu, Sales & Statements
      // Neglects Inventory, Loyalty, Finance, and Queue
      initialModules = [
        'DIGITAL_MENU',
        'ONLINE_ORDERING',
        'TABLE_MANAGEMENT',
        'ANALYTICS',
        'REPORTS',
      ];
    } else {
      // Default for POS Premium trial: all premium modules
      initialModules = [
        'DIGITAL_MENU',
        'ONLINE_ORDERING',
        'TABLE_MANAGEMENT',
        'QUEUE_MANAGEMENT',
        'INVENTORY',
        'LOYALTY_PROGRAM',
        'FINANCE_MANAGEMENT',
        'ANALYTICS',
        'REPORTS',
      ];
    }

    // 10. Create Restaurant Record
    const restaurant = await createRestaurant({
      name: restaurantName,
      slug: targetSlug,
      phone: phone ? String(phone).trim() : undefined,
      address: address ? String(address).trim() : undefined,
      logo_url: logo_url ? String(logo_url).trim() : undefined,
      primary_color: primary_color || '#971345',
      secondary_color: (secondary_color && secondary_color.toUpperCase() !== '#EC7951') ? secondary_color : '#ffffff',
      menu_layout: menu_layout || 'LIST',
      menu_title: menu_title || "Today's Specials",
      menu_description: menu_description || 'Hand-curated delicacies prepared fresh daily.',
      timezone: timezone || 'Asia/Kolkata',
      opening_time: opening_time || '09:00:00',
      closing_time: closing_time || '22:00:00',
      gst_type: gst_type || 'NONE',
      gst_number: gst_number ? String(gst_number).trim() : undefined,
      gst_rate: gst_rate !== undefined ? parseFloat(gst_rate) : 5.0,
      modules: initialModules
    });

    // 11. Data-Driven Provisioning: Subscription, Trial & Modules
    const subscriptionInfo = await SubscriptionService.provisionOnboardingSubscription(restaurant.id, {
      product: normalizedProduct,
      planTier,
      billingCycle: normalizedBillingCycle,
    });

    // 11. Create Admin User (Store Owner)
    const passwordHash = await hashPassword(admin_password);
    const ownerName = admin_name ? String(admin_name).trim() : `${restaurantName} Owner`;

    try {
      await pool.query(
        `INSERT INTO admins (email, password, name, restaurant_id, is_super_admin, is_email_verified, email_verified_at)
         VALUES ($1, $2, $3, $4, false, $5, $6)`,
        [emailTrimmed, passwordHash, ownerName, restaurant.id, isEmailVerified, isEmailVerified ? new Date().toISOString() : null]
      );
    } catch (adminErr: any) {
      try {
        await pool.query(
          `INSERT INTO admins (email, password, name, restaurant_id, is_super_admin)
           VALUES ($1, $2, $3, $4, false)`,
          [emailTrimmed, passwordHash, ownerName, restaurant.id]
        );
      } catch {
        await pool.query(
          `INSERT INTO admins (email, password, restaurant_id, is_super_admin)
           VALUES ($1, $2, $3, false)`,
          [emailTrimmed, passwordHash, restaurant.id]
        );
      }
      if (isEmailVerified) {
        await AuthTokenService.markAdminEmailVerified(emailTrimmed).catch(() => {});
      }
    }

    // 12. If email is not pre-verified, dispatch verification email automatically
    if (!isEmailVerified) {
      AuthTokenService.createVerificationOtp(emailTrimmed, 'EMAIL_VERIFICATION', 10)
        .then((otp) => emailService.sendEmailVerificationOtp(emailTrimmed, otp, restaurantName))
        .catch((err) => console.error('[Onboarding] Verification email dispatch error:', err));
    }

    // 13. Seed Default Staff Roles (Waiter, Kitchen Staff, Cashier, Manager)
    await seedDefaultRoles(restaurant.id);

    // 14. Seed Default Queue Statuses (Pending, Seated, Cancelled)
    await QueueService.seedDefaultQueueStatuses(restaurant.id);

    // 15. Return Comprehensive Success Response
    return NextResponse.json(
      {
        success: true,
        message: normalizedProduct === 'POS'
          ? 'Restaurant onboarded successfully with a 14-day full-featured Premium free trial'
          : `Restaurant onboarded successfully with standalone ${normalizedProduct === 'DIGITAL_MENU' ? 'Digital Menu' : 'Q Management'}`,
        data: {
          restaurant: {
            id: restaurant.id,
            name: restaurant.name,
            slug: restaurant.slug,
            phone: restaurant.phone,
            address: restaurant.address,
            primary_color: restaurant.primary_color,
            menu_layout: restaurant.menu_layout,
            created_at: restaurant.created_at
          },
          admin: {
            email: emailTrimmed,
            name: ownerName,
            is_email_verified: isEmailVerified
          },
          subscription: subscriptionInfo,
          urls: {
            admin_portal: `/${restaurant.slug}/admin/login`,
            digital_menu: `/${restaurant.slug}/menu`,
            ...(normalizedProduct === 'POS' ? { pos_terminal: `/${restaurant.slug}/admin/pos` } : {}),
            ...(normalizedProduct === 'POS' || normalizedProduct === 'QUEUE_MANAGEMENT' ? { queue_screen: `/${restaurant.slug}/queue` } : {})
          }
        }
      },
      { status: 201, headers: corsHeaders }
    );
  } catch (error: any) {
    console.error('Public restaurant onboarding error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to onboard restaurant' },
      { status: 500, headers: corsHeaders }
    );
  }
}

