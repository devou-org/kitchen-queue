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
        rollover_time,
        (CURRENT_TIMESTAMP AT TIME ZONE COALESCE(timezone, 'Asia/Kolkata'))::time as current_time_in_tz
      FROM restaurants 
      WHERE id = ${restaurant.id} 
      LIMIT 1
    `;
    
    let isOperatingHours = true;
    const row = rows[0];
    if (row?.opening_time && row?.rollover_time && row?.current_time_in_tz) {
      const openingTime = row.opening_time;
      const rolloverTime = row.rollover_time;
      const currentTime = row.current_time_in_tz;

      if (openingTime < rolloverTime) {
        // Normal day: e.g. 09:00 to 22:00
        isOperatingHours = currentTime >= openingTime && currentTime < rolloverTime;
      } else if (openingTime > rolloverTime) {
        // Crosses midnight: e.g. 11:00 to 03:00
        isOperatingHours = currentTime >= openingTime || currentTime < rolloverTime;
      }
    }

    return NextResponse.json({ 
      success: true, 
      isServiceActive: row?.is_service_active ?? true,
      serviceMessage: row?.service_message || '',
      isOperatingHours,
      openingTime: row?.opening_time,
      rolloverTime: row?.rollover_time
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
        rollover_time,
        (CURRENT_TIMESTAMP AT TIME ZONE COALESCE(timezone, 'Asia/Kolkata'))::time as current_time_in_tz
      FROM restaurants 
      WHERE id = ${restaurant.id} 
      LIMIT 1
    `;
    
    let isOperatingHours = true;
    const row = rows[0];
    if (row?.opening_time && row?.rollover_time && row?.current_time_in_tz) {
      const openingTime = row.opening_time;
      const rolloverTime = row.rollover_time;
      const currentTime = row.current_time_in_tz;

      if (openingTime < rolloverTime) {
        isOperatingHours = currentTime >= openingTime && currentTime < rolloverTime;
      } else if (openingTime > rolloverTime) {
        isOperatingHours = currentTime >= openingTime || currentTime < rolloverTime;
      }
    }

    if (!isOperatingHours) {
      return NextResponse.json({ success: false, error: 'Cannot toggle service outside of operating hours' }, { status: 403 });
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
      rollover_time
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
        updated_at = NOW()
      WHERE id = ${restaurant.id}
    `;

    return NextResponse.json({ success: true, message: 'Settings updated successfully' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
