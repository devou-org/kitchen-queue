import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

async function requireSuperAdmin(request: NextRequest) {
  const token = request.cookies.get('super_admin_token')?.value
    || request.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload?.isSuperAdmin) return null;
  return payload;
}

// GET /api/super-admin/pricing - Fetch all SaaS plans and their pricing
export async function GET(request: NextRequest) {
  const admin = await requireSuperAdmin(request);
  if (!admin) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const plansQuery = `
      SELECT 
        p.id,
        p.product_id,
        prod.name AS product_name,
        p.tier,
        p.name,
        p.description,
        p.monthly_ai_credits,
        p.is_default_trial_tier,
        p.is_active,
        COALESCE(MAX(CASE WHEN pr.billing_cycle = 'MONTHLY' THEN pr.price END), 0)::numeric AS monthly_price,
        COALESCE(MAX(CASE WHEN pr.billing_cycle = 'ANNUALLY' THEN pr.price END), 0)::numeric AS annual_price,
        COALESCE(MAX(pr.currency), 'INR') as currency
      FROM saas_plans p
      LEFT JOIN saas_products prod ON p.product_id = prod.id
      LEFT JOIN saas_plan_pricing pr ON p.id = pr.plan_id
      GROUP BY p.id, p.product_id, prod.name, p.tier, p.name, p.description, p.monthly_ai_credits, p.is_default_trial_tier, p.is_active
      ORDER BY 
        CASE 
          WHEN p.id = 'POS_ESSENTIAL' THEN 1
          WHEN p.id = 'POS_PREMIUM' THEN 2
          WHEN p.id = 'DIGITAL_MENU_STANDALONE' THEN 3
          WHEN p.id = 'QUEUE_MGMT_STANDALONE' THEN 4
          ELSE 5
        END ASC;
    `;

    const featuresQuery = `
      SELECT plan_id, feature_code, feature_name, feature_description, is_included
      FROM saas_plan_features
      ORDER BY id ASC;
    `;

    const [plansRes, featRes] = await Promise.all([
      pool.query(plansQuery),
      pool.query(featuresQuery)
    ]);

    const featuresByPlan: Record<string, any[]> = {};
    for (const f of featRes.rows) {
      if (!featuresByPlan[f.plan_id]) featuresByPlan[f.plan_id] = [];
      featuresByPlan[f.plan_id].push(f);
    }

    const plans = plansRes.rows.map(row => ({
      ...row,
      monthly_price: Number(row.monthly_price),
      annual_price: Number(row.annual_price),
      features: featuresByPlan[row.id] || []
    }));

    return NextResponse.json({
      success: true,
      data: plans
    });
  } catch (error: any) {
    console.error('Error fetching pricing:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch pricing' },
      { status: 500 }
    );
  }
}

// PUT /api/super-admin/pricing - Update pricing for one or multiple plans
export async function PUT(request: NextRequest) {
  const admin = await requireSuperAdmin(request);
  if (!admin) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const plansToUpdate: any[] = Array.isArray(body.plans) ? body.plans : (body.id ? [body] : []);

    if (plansToUpdate.length === 0) {
      return NextResponse.json({ success: false, error: 'No plan pricing data provided' }, { status: 400 });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      for (const item of plansToUpdate) {
        const { id, name, description, monthly_price, annual_price, monthly_ai_credits, is_active } = item;

        if (!id) {
          throw new Error('Plan id is required for every item');
        }

        // 1. Update saas_plans core metadata
        await client.query(
          `UPDATE saas_plans 
           SET 
             name = COALESCE($1, name),
             description = COALESCE($2, description),
             monthly_ai_credits = CASE WHEN $3::int IS NOT NULL THEN $3::int ELSE monthly_ai_credits END,
             is_active = CASE WHEN $4::boolean IS NOT NULL THEN $4::boolean ELSE is_active END,
             updated_at = NOW()
           WHERE id = $5`,
          [
            name ?? null,
            description ?? null,
            monthly_ai_credits !== undefined && monthly_ai_credits !== null ? Number(monthly_ai_credits) : null,
            typeof is_active === 'boolean' ? is_active : null,
            id
          ]
        );

        // 2. Update or insert MONTHLY pricing
        if (monthly_price !== undefined && monthly_price !== null && monthly_price !== '') {
          const numMonthly = Number(monthly_price);
          if (isNaN(numMonthly) || numMonthly < 0) {
            throw new Error(`Invalid monthly price for plan ${id}`);
          }
          await client.query(
            `INSERT INTO saas_plan_pricing (plan_id, billing_cycle, price, currency, is_active, updated_at)
             VALUES ($1, 'MONTHLY', $2, 'INR', true, NOW())
             ON CONFLICT (plan_id, billing_cycle) 
             DO UPDATE SET price = EXCLUDED.price, is_active = true, updated_at = NOW()`,
            [id, numMonthly]
          );
        }

        // 3. Update or insert ANNUALLY pricing
        if (annual_price !== undefined && annual_price !== null && annual_price !== '') {
          const numAnnual = Number(annual_price);
          if (isNaN(numAnnual) || numAnnual < 0) {
            throw new Error(`Invalid annual price for plan ${id}`);
          }
          await client.query(
            `INSERT INTO saas_plan_pricing (plan_id, billing_cycle, price, currency, is_active, updated_at)
             VALUES ($1, 'ANNUALLY', $2, 'INR', true, NOW())
             ON CONFLICT (plan_id, billing_cycle) 
             DO UPDATE SET price = EXCLUDED.price, is_active = true, updated_at = NOW()`,
            [id, numAnnual]
          );
        }
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    return NextResponse.json({
      success: true,
      message: 'Plan pricing updated successfully'
    });
  } catch (error: any) {
    console.error('Error updating pricing:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update pricing' },
      { status: 500 }
    );
  }
}
