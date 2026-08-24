import { NextRequest, NextResponse } from 'next/server';
import sql, { getRestaurantBySlug } from '@/lib/db';
import { verifyToken, requireAdmin } from '@/lib/auth';

// Ensure columns exist (one-time migration check)
async function ensureColumnExists() {
  try {
    await sql`ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS is_service_active BOOLEAN DEFAULT TRUE`;
    await sql`ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS service_message TEXT`;
  } catch (err) {
    console.error('Migration error:', err);
  }
}

export async function GET(request: NextRequest) {
  try {
    const slug = request.headers.get('x-restaurant-slug') || 'demo';
    const restaurant = await getRestaurantBySlug(slug);
    
    if (!restaurant) {
       return NextResponse.json({ success: false, error: 'Restaurant not found' }, { status: 404 });
    }

    await ensureColumnExists();
    const rows = await sql`
      SELECT 
        is_service_active, 
        service_message,
        opening_time,
        closing_time,
        (CURRENT_TIMESTAMP AT TIME ZONE COALESCE(timezone, 'Asia/Kolkata'))::time as current_time_in_tz
      FROM restaurants 
      WHERE id = ${restaurant.id} 
      LIMIT 1
    `;
    
    let isOperatingHours = true;
    const row = rows[0];
    if (row?.opening_time && row?.closing_time && row?.current_time_in_tz) {
      const openingTime = row.opening_time;
      const closingTime = row.closing_time;
      const currentTime = row.current_time_in_tz;

      if (openingTime < closingTime) {
        // Normal day: e.g. 09:00 to 22:00
        isOperatingHours = currentTime >= openingTime && currentTime < closingTime;
      } else if (openingTime > closingTime) {
        // Crosses midnight: e.g. 11:00 to 03:00
        isOperatingHours = currentTime >= openingTime || currentTime < closingTime;
      }
    }

    let isServiceActive = row?.is_service_active ?? true;

    // Automatically turn off the service if outside operating hours
    if (!isOperatingHours && isServiceActive) {
      await sql`UPDATE restaurants SET is_service_active = false WHERE id = ${restaurant.id}`;
      isServiceActive = false;
    }

    return NextResponse.json({ 
      success: true, 
      isServiceActive,
      serviceMessage: row?.service_message || '',
      isOperatingHours,
      openingTime: row?.opening_time,
      closingTime: row?.closing_time
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const slug = request.headers.get('x-restaurant-slug') || 'demo';
    const restaurant = await getRestaurantBySlug(slug);
    
    if (!restaurant) {
       return NextResponse.json({ success: false, error: 'Restaurant not found' }, { status: 404 });
    }

    const admin = await requireAdmin(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { active, message } = await request.json();
    if (typeof active !== 'boolean') {
      return NextResponse.json({ success: false, error: 'Invalid payload' }, { status: 400 });
    }

    await ensureColumnExists();

    const rows = await sql`
      SELECT 
        opening_time,
        closing_time,
        (CURRENT_TIMESTAMP AT TIME ZONE COALESCE(timezone, 'Asia/Kolkata'))::time as current_time_in_tz
      FROM restaurants 
      WHERE id = ${restaurant.id} 
      LIMIT 1
    `;
    
    let isOperatingHours = true;
    const row = rows[0];
    if (row?.opening_time && row?.closing_time && row?.current_time_in_tz) {
      const openingTime = row.opening_time;
      const closingTime = row.closing_time;
      const currentTime = row.current_time_in_tz;

      if (openingTime < closingTime) {
        isOperatingHours = currentTime >= openingTime && currentTime < closingTime;
      } else if (openingTime > closingTime) {
        isOperatingHours = currentTime >= openingTime || currentTime < closingTime;
      }
    }

    if (!isOperatingHours && active) {
      return NextResponse.json({ success: false, error: 'Cannot turn service online outside of operating hours' }, { status: 403 });
    }
    await sql`UPDATE restaurants SET is_service_active = ${active}, service_message = ${message || null} WHERE id = ${restaurant.id}`;
    
    return NextResponse.json({ 
      success: true, 
      isServiceActive: active,
      serviceMessage: message || '',
      message: `Service is ${active ? 'Online' : 'Offline'}`
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const slug = request.headers.get('x-restaurant-slug') || 'demo';
    const restaurant = await getRestaurantBySlug(slug);
    
    if (!restaurant) {
       return NextResponse.json({ success: false, error: 'Restaurant not found' }, { status: 404 });
    }

    const admin = await requireAdmin(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    
    // Allow updating these fields
    const { 
      name, 
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
      rollover_time,
      country,
      country_code,
      state,
      state_code,
      district,
      city,
      latitude,
      longitude
    } = body;

    if (!name) {
      return NextResponse.json({ success: false, error: 'Name is required' }, { status: 400 });
    }

    await sql`
      UPDATE restaurants 
      SET 
        name = ${name},
        phone = ${phone || null},
        address = ${address || null},
        logo_url = ${logo_url || null},
        primary_color = ${primary_color},
        secondary_color = ${secondary_color},
        menu_layout = ${menu_layout},
        menu_title = ${menu_title || null},
        menu_description = ${menu_description || null},
        timezone = ${timezone || null},
        opening_time = ${opening_time || null},
        closing_time = ${closing_time || null},
        rollover_time = ${rollover_time || null},
        country = COALESCE(${country || null}, country),
        country_code = COALESCE(${country_code || null}, country_code),
        state = COALESCE(${state || null}, state),
        state_code = COALESCE(${state_code || null}, state_code),
        district = COALESCE(${district || null}, district),
        city = COALESCE(${city || null}, city),
        latitude = CASE WHEN ${latitude !== undefined && latitude !== null} THEN ${Number(latitude)} ELSE latitude END,
        longitude = CASE WHEN ${longitude !== undefined && longitude !== null} THEN ${Number(longitude)} ELSE longitude END,
        updated_at = NOW()
      WHERE id = ${restaurant.id}
    `;

    return NextResponse.json({ success: true, message: 'Settings updated successfully' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
