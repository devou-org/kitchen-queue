import { NextRequest, NextResponse } from 'next/server';
import { ensureInventorySchema } from '@/lib/inventory';
import { pool } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    await ensureInventorySchema();

    // Verify tables exist
    const checkRes = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN (
          'inventory_categories', 'inventory_units', 'suppliers',
          'inventory_items', 'inventory_batches', 'stock_movements',
          'purchase_orders', 'purchase_order_items', 'wastages',
          'stock_adjustments', 'recipes', 'recipe_items'
        )
      ORDER BY table_name;
    `);

    return NextResponse.json({
      success: true,
      message: 'Inventory schema migration completed successfully',
      tables_created: checkRes.rows.map((r: any) => r.table_name),
    });
  } catch (error: any) {
    console.error('Inventory migration API failed:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}

