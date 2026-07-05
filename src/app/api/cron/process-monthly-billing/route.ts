import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { BillingService } from '@/modules/billing/billing.service';

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');

  // Vercel Cron jobs auth check
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const client = await pool.connect();
  const processed: Array<{ id: string; name: string; old_end: string; new_end: string }> = [];

  try {
    // 1. Fetch all active restaurants whose billing cycle has expired or is uninitialized
    // We check if billing_end_date is in the past (or today) and the restaurant is active
    const expiredRes = await client.query(`
      SELECT id, name, billing_tier, billing_model, billing_status, billing_start_date, billing_end_date, billing_period, timezone, rollover_time
      FROM restaurants
      WHERE billing_status = 'ACTIVE' 
        AND (billing_end_date IS NULL OR billing_end_date <= DATE((CURRENT_TIMESTAMP AT TIME ZONE timezone) - rollover_time::interval))
    `);

    for (const row of expiredRes.rows) {
      const restaurantId = row.id;
      const billingModel = row.billing_model || 'SUBSCRIPTION';
      const billingPeriod = row.billing_period || 'MONTHLY';
      
      // Calculate next cycle range
      const oldEnd = row.billing_end_date ? new Date(row.billing_end_date) : new Date();
      const newStart = new Date(oldEnd);
      
      const newEnd = new Date(newStart);
      if (billingPeriod === 'YEARLY') {
        newEnd.setFullYear(newEnd.getFullYear() + 1);
      } else {
        newEnd.setMonth(newEnd.getMonth() + 1);
      }

      await client.query('BEGIN');
      try {
        // If subscription model, charge the fee at the start of the new cycle
        if (billingModel === 'SUBSCRIPTION') {
          // We pass the billingPeriod to processSubscriptionBilling to calculate the correct charge
          await BillingService.processSubscriptionBilling(restaurantId, billingPeriod, newStart, newEnd);
        }

        // Update the restaurant's billing start/end dates
        await client.query(`
          UPDATE restaurants
          SET billing_start_date = $2,
              billing_end_date = $3
          WHERE id = $1
        `, [restaurantId, newStart.toISOString(), newEnd.toISOString()]);

        await client.query('COMMIT');
        processed.push({
          id: restaurantId,
          name: row.name,
          old_end: row.billing_end_date ? new Date(row.billing_end_date).toISOString().split('T')[0] : 'None',
          new_end: newEnd.toISOString().split('T')[0]
        });
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`Failed to process billing cycle renewal for restaurant ${row.name} (${restaurantId}):`, err);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Processed cycle renewal for ${processed.length} restaurants.`,
      processed,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('Monthly billing cron job error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  } finally {
    client.release();
  }
}
