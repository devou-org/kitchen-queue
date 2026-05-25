import { NextRequest, NextResponse } from 'next/server';
import sql, { getRestaurantBySlug } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

// Ensure columns exist (one-time migration check)
async function ensureColumnExists() {
  try {
    await sql`ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS is_service_active BOOLEAN DEFAULT TRUE`;
    await sql`ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS service_message TEXT`;
  } catch (err) {
    console.error('Migration error:', err);
  }
}

async function requireAdmin(request: Request) {
  const cookieHeader = request.headers.get('cookie') || '';
  const adminToken = cookieHeader.split('; ').find(c => c.startsWith('admin_token='))?.split('=')[1];
  
  if (!adminToken) return null;
  const payload = await verifyToken(adminToken);
  if (!payload?.isAdmin) return null;
  return payload;
}

export async function GET(request: NextRequest) {
  try {
    const slug = request.headers.get('x-restaurant-slug') || 'demo';
    const restaurant = await getRestaurantBySlug(slug);
    
    if (!restaurant) {
       return NextResponse.json({ success: false, error: 'Restaurant not found' }, { status: 404 });
    }

    await ensureColumnExists();
    const rows = await sql`SELECT is_service_active, service_message FROM restaurants WHERE id = ${restaurant.id} LIMIT 1`;
    return NextResponse.json({ 
      success: true, 
      isServiceActive: rows[0]?.is_service_active ?? true,
      serviceMessage: rows[0]?.service_message || ''
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
      menu_description 
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
        updated_at = NOW()
      WHERE id = ${restaurant.id}
    `;

    return NextResponse.json({ success: true, message: 'Settings updated successfully' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
