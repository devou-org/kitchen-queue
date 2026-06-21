const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// 1. Define Pricing constants
const BILLING_PRICING = {
  BASIC: { subscriptionMonthly: 399 },
  PRO: { subscriptionMonthly: 999 },
  COMPLETE: { subscriptionMonthly: 1499 }
};

// 2. Load environment variables manually from .env.local if present
let databaseUrl = process.env.DATABASE_URL;
const envPath = path.join(process.cwd(), '.env.local');

if (!databaseUrl && fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split(/\r?\n/)) {
    const match = line.match(/^\s*DATABASE_URL\s*=\s*["']?(.*?)["']?\s*$/);
    if (match) {
      databaseUrl = match[1];
      break;
    }
  }
}

if (!databaseUrl) {
  console.error("❌ Error: DATABASE_URL is not set in environment or .env.local file.");
  process.exit(1);
}

const useSsl = databaseUrl.includes('sslmode=require') || databaseUrl.includes('neon.tech');
const pool = new Pool({
  connectionString: databaseUrl,
  ssl: useSsl ? { rejectUnauthorized: false } : false
});

async function run() {
  console.log("⚙️  Initializing standalone QDine billing engine cycle processor...");
  const client = await pool.connect();
  const processed = [];

  try {
    // Fetch all active restaurants whose billing period has ended or is uninitialized
    const expiredRes = await client.query(`
      SELECT id, name, billing_tier, billing_model, billing_status, billing_start_date, billing_end_date, billing_period
      FROM restaurants
      WHERE billing_status = 'ACTIVE' 
        AND (billing_end_date IS NULL OR billing_end_date <= CURRENT_DATE)
    `);

    console.log(`🔍 Found ${expiredRes.rows.length} restaurants needing cycle renewal.`);

    for (const row of expiredRes.rows) {
      const restaurantId = row.id;
      const billingModel = row.billing_model || 'SUBSCRIPTION';
      const billingTier = row.billing_tier || 'BASIC';
      const billingPeriod = row.billing_period || 'MONTHLY';
      
      const oldEnd = row.billing_end_date ? new Date(row.billing_end_date) : new Date();
      const newStart = new Date(oldEnd);
      
      const newEnd = new Date(newStart);
      if (billingPeriod === 'YEARLY') {
        newEnd.setFullYear(newEnd.getFullYear() + 1);
      } else {
        newEnd.setMonth(newEnd.getMonth() + 1);
      }

      console.log(`🔄 Processing [${row.name}] (${billingTier} - ${billingModel} - ${billingPeriod})...`);

      await client.query('BEGIN');
      try {
        if (billingModel === 'SUBSCRIPTION') {
          const pricing = BILLING_PRICING[billingTier] || BILLING_PRICING.BASIC;
          const multiplier = billingPeriod === 'YEARLY' ? 12 : 1;
          const amount = pricing.subscriptionMonthly * multiplier;

          // Local time calculations for month/year (Asia/Kolkata)
          const now = new Date();
          const localMonth = parseInt(new Intl.DateTimeFormat('en-US', { month: 'numeric', timeZone: 'Asia/Kolkata' }).format(now));
          const localYear = parseInt(new Intl.DateTimeFormat('en-US', { year: 'numeric', timeZone: 'Asia/Kolkata' }).format(now));
          
          const description = billingPeriod === 'YEARLY'
            ? `Yearly Subscription Charge (${billingTier} tier)`
            : `Monthly Subscription Charge (${billingTier} tier)`;

          // 1. Insert billing transaction for the subscription charge
          await client.query(`
            INSERT INTO billing_transactions (restaurant_id, transaction_type, amount, description)
            VALUES ($1, 'SUBSCRIPTION', $2, $3)
          `, [restaurantId, amount, description]);

          // 2. Upsert billing summary
          await client.query(`
            INSERT INTO monthly_billing_summary (
              restaurant_id, month, year, order_charges, otp_charges, subscription_charges, adjustments, total_amount
            )
            VALUES ($1, $2, $3, 0.00, 0.00, $4, 0.00, $4)
            ON CONFLICT (restaurant_id, month, year)
            DO UPDATE SET
              subscription_charges = monthly_billing_summary.subscription_charges + EXCLUDED.subscription_charges,
              total_amount = monthly_billing_summary.total_amount + EXCLUDED.subscription_charges
          `, [restaurantId, localMonth, localYear, amount]);

          console.log(`   💰 Charged subscription fee of ₹${amount} for cycle ${localMonth}/${localYear}`);
        }

        // 3. Shifting dates for the new billing cycle period
        await client.query(`
          UPDATE restaurants
          SET billing_start_date = $2,
              billing_end_date = $3
          WHERE id = $1
        `, [restaurantId, newStart.toISOString(), newEnd.toISOString()]);

        await client.query('COMMIT');
        
        processed.push({
          name: row.name,
          tier: billingTier,
          model: billingModel,
          period: billingPeriod,
          new_start: newStart.toISOString().split('T')[0],
          new_end: newEnd.toISOString().split('T')[0]
        });

      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`   ❌ Failed to renew billing cycle for ${row.name}:`, err.message);
      }
    }

    console.log("\n==================================================");
    console.log("✅ BILLING CYCLE ENGINE PROCESS COMPLETED!");
    console.log(`Successfully renewed cycles for: ${processed.length} restaurants.`);
    if (processed.length > 0) {
      console.table(processed);
    }
    console.log("==================================================");

  } catch (error) {
    console.error("❌ Billing Engine Critical Error:", error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
