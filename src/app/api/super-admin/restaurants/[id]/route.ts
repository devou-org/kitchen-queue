import { NextRequest, NextResponse } from 'next/server';
import { getRestaurantWithModules, updateRestaurant, deleteRestaurant, setAllRestaurantModules } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

async function requireSuperAdmin(request: NextRequest) {
  const token = request.cookies.get('super_admin_token')?.value
    || request.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload?.isSuperAdmin) return null;
  return payload;
}

// GET /api/super-admin/restaurants/[id] — get restaurant + modules
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireSuperAdmin(request);
  if (!admin) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  try {
    const { id } = await params;
    const restaurant = await getRestaurantWithModules(id);
    if (!restaurant) return NextResponse.json({ success: false, error: 'Restaurant not found' }, { status: 404 });
    return NextResponse.json({ success: true, data: restaurant });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to fetch restaurant' }, { status: 500 });
  }
}

// PUT /api/super-admin/restaurants/[id] — update restaurant info + modules
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireSuperAdmin(request);
  if (!admin) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  try {
    const { id } = await params;
    const body = await request.json();
    const { name, slug, phone, address, logo_url, primary_color, secondary_color, menu_layout, menu_title, menu_description, modules, billing_tier, billing_model, billing_status, billing_end_date, billing_period, timezone, opening_time, closing_time, rollover_time, gst_type, gst_number, gst_rate } = body;

    if (slug && !/^[a-z0-9-]+$/.test(slug)) {
      return NextResponse.json({ success: false, error: 'Slug must be lowercase letters, numbers, and hyphens only' }, { status: 400 });
    }

    if (billing_tier && billing_model) {
      const { validateTierAndModel } = await import('@/lib/billing.constants');
      const validation = validateTierAndModel(billing_tier, billing_model);
      if (!validation.valid) {
        return NextResponse.json({ success: false, error: validation.error }, { status: 400 });
      }
    }

    // Update restaurant info
    const restaurant = await updateRestaurant(id, {
      name, slug, phone, address, logo_url, primary_color, secondary_color, menu_layout, menu_title, menu_description,
      billing_tier, billing_model, billing_status, billing_end_date, billing_period, timezone, opening_time, closing_time, rollover_time,
      gst_type, gst_number: gst_number || null, gst_rate: Number(gst_rate) || 0
    });
    if (!restaurant) return NextResponse.json({ success: false, error: 'Restaurant not found' }, { status: 404 });


    // Update modules if provided
    if (Array.isArray(modules)) {
      let modulesToSet = [];
      const ALL_MODULE_KEYS = ['DIGITAL_MENU', 'ONLINE_ORDERING', 'QUEUE_MANAGEMENT', 'INVENTORY', 'ANALYTICS', 'REPORTS'];

      if (modules.length === 0 || typeof modules[0] === 'string') {
        // Form submitted as string keys (enabled ones only)
        modulesToSet = ALL_MODULE_KEYS.map(key => ({
          module_name: key,
          is_enabled: modules.includes(key),
        }));
      } else {
        // Module Panel submitted as objects { module_name, is_enabled }
        modulesToSet = modules.map((m: any) => ({
          module_name: m.module_name,
          is_enabled: !!m.is_enabled
        })).filter(m => m.module_name);
      }

      await setAllRestaurantModules(id, modulesToSet);

      // Auto-update billing tier based on enabled modules
      const hasOnlineOrdering = modulesToSet.find((m: any) => m.module_name === 'ONLINE_ORDERING')?.is_enabled;
      const hasQueue = modulesToSet.find((m: any) => m.module_name === 'QUEUE_MANAGEMENT')?.is_enabled;
      
      let newTier = 'BASIC';
      if (hasOnlineOrdering) {
        newTier = 'COMPLETE';
      } else if (hasQueue) {
        newTier = 'PRO';
      }
      
      const currentRestaurant = await getRestaurantWithModules(id);
      let newModel = currentRestaurant?.billing_model || 'SUBSCRIPTION';
      
      if (newTier === 'BASIC' && newModel !== 'SUBSCRIPTION') {
        newModel = 'SUBSCRIPTION';
      } else if (newTier === 'PRO' && newModel === 'PER_ORDER') {
        newModel = 'SUBSCRIPTION';
      }

      await updateRestaurant(id, { billing_tier: newTier, billing_model: newModel });
    }

    const updated = await getRestaurantWithModules(id);
    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    console.error('Update restaurant error:', error);
    if (error.message?.includes('duplicate') || error.message?.includes('unique')) {
      return NextResponse.json({ success: false, error: 'A restaurant with this slug already exists' }, { status: 409 });
    }
    return NextResponse.json({ success: false, error: 'Failed to update restaurant' }, { status: 500 });
  }
}

// DELETE /api/super-admin/restaurants/[id] — delete restaurant
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireSuperAdmin(request);
  if (!admin) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  try {
    const { id } = await params;
    // Prevent deleting the default demo restaurant
    if (id === '00000000-0000-0000-0000-000000000000') {
      return NextResponse.json({ success: false, error: 'Cannot delete the default demo restaurant' }, { status: 403 });
    }
    await deleteRestaurant(id);
    return NextResponse.json({ success: true, message: 'Restaurant deleted' });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to delete restaurant' }, { status: 500 });
  }
}
