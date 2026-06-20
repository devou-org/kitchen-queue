import { pool } from '@/lib/db';
import { BILLING_PRICING, BillingTier, BillingModel, validateTierAndModel } from '@/lib/billing.constants';
import { PoolClient } from 'pg';

export class BillingService {
  /**
   * Helper to execute queries inside a client or using the pool.
   */
  private static async query(client: PoolClient | null, text: string, params: any[]) {
    if (client) {
      return client.query(text, params);
    }
    return pool.query(text, params);
  }

  /**
   * Calculates order charge based on the restaurant's billing tier and the order value.
   */
  static calculateOrderCharge(tier: BillingTier, orderValue: number): number {
    const pricing = BILLING_PRICING[tier];
    if (!pricing || !pricing.perOrder) {
      return 0;
    }

    const { commissionPercent, flatLimit, flatCharge } = pricing.perOrder;
    if (orderValue < flatLimit) {
      // Calculate commission percentage, round to 2 decimal places
      return Math.round(orderValue * commissionPercent * 100) / 100;
    } else {
      return flatCharge;
    }
  }

  /**
   * Calculates the current month/year for Asia/Kolkata timezone.
   */
  static getCurrentLocalMonthYear(): { month: number; year: number } {
    const localTimezone = 'Asia/Kolkata';
    const now = new Date();
    const formatterMonth = new Intl.DateTimeFormat('en-US', { month: 'numeric', timeZone: localTimezone });
    const formatterYear = new Intl.DateTimeFormat('en-US', { year: 'numeric', timeZone: localTimezone });
    const month = parseInt(formatterMonth.format(now));
    const year = parseInt(formatterYear.format(now));
    return { month, year };
  }

  /**
   * Processes the billing charge for a completed order.
   * Must be executed within a database transaction (hence passing PoolClient).
   */
  static async processOrderBilling(client: PoolClient, restaurantId: string, orderId: string, orderValue: number): Promise<void> {
    // 1. Fetch restaurant billing settings with a row-level lock on the restaurant
    const resSettings = await client.query(`
      SELECT billing_tier, billing_model, billing_status 
      FROM restaurants 
      WHERE id = $1 
      FOR UPDATE
    `, [restaurantId]);

    if (resSettings.rows.length === 0) {
      throw new Error(`Restaurant with ID ${restaurantId} not found.`);
    }

    const { billing_tier, billing_model, billing_status } = resSettings.rows[0];

    // If status is inactive or model is not PER_ORDER, do not bill
    if (billing_status !== 'ACTIVE' || billing_model !== 'PER_ORDER') {
      return;
    }

    const tier = billing_tier as BillingTier;

    // Validate if the tier supports per order
    const validation = validateTierAndModel(tier, 'PER_ORDER');
    if (!validation.valid) {
      return; // Skip or throw error. We skip to avoid blocking orders due to admin setup issues.
    }

    // Fetch current cycle's Average Order Value (AOV) of PAID orders
    const aovRes = await client.query(`
      SELECT COALESCE(AVG(total_price), 0) as avg_value
      FROM orders
      WHERE restaurant_id = $1
        AND status = 'PAID'
        AND created_at >= (
          SELECT COALESCE(billing_start_date, created_at) FROM restaurants WHERE id = $1 LIMIT 1
        )
    `, [restaurantId]);

    let aov = parseFloat(aovRes.rows[0].avg_value || '0');
    if (aov === 0) {
      aov = orderValue; // Fallback to current order value if no other paid orders exist
    }

    const pricing = BILLING_PRICING[tier];
    if (!pricing || !pricing.perOrder) {
      return;
    }

    const { commissionPercent, flatLimit, flatCharge } = pricing.perOrder;
    let chargeAmount = 0;
    if (aov < flatLimit) {
      chargeAmount = Math.round(orderValue * commissionPercent * 100) / 100;
    } else {
      chargeAmount = flatCharge;
    }

    if (chargeAmount <= 0) {
      return;
    }

    // Check if duplicate transaction exists
    const txCheck = await client.query(`
      SELECT id FROM billing_transactions 
      WHERE reference_id = $1 AND transaction_type = 'PER_ORDER'
      LIMIT 1
    `, [orderId]);
    if (txCheck.rows.length > 0) {
      return;
    }

    const { month, year } = this.getCurrentLocalMonthYear();
    const description = `Per Order Charge for Order #${orderId} (${tier} tier)`;

    // 2. Insert billing transaction
    await client.query(`
      INSERT INTO billing_transactions (restaurant_id, transaction_type, amount, reference_id, description)
      VALUES ($1, 'PER_ORDER', $2, $3, $4)
    `, [restaurantId, chargeAmount, orderId, description]);

    // 3. Update monthly summary with a lock / atomic upsert
    await client.query(`
      INSERT INTO monthly_billing_summary (
        restaurant_id, month, year, order_charges, otp_charges, subscription_charges, adjustments, total_amount
      )
      VALUES ($1, $2, $3, $4, 0.00, 0.00, 0.00, $4)
      ON CONFLICT (restaurant_id, month, year)
      DO UPDATE SET
        order_charges = monthly_billing_summary.order_charges + EXCLUDED.order_charges,
        total_amount = monthly_billing_summary.total_amount + EXCLUDED.order_charges
    `, [restaurantId, month, year, chargeAmount]);
  }

  /**
   * Processes the billing charge for an OTP request.
   * Can be run inside an existing transaction or standalone.
   */
  static async processOTPBilling(client: PoolClient | null, restaurantId: string, otpLogId: string): Promise<void> {
    const executor = client || pool;

    // 1. Fetch restaurant billing tier
    const resSettings = await executor.query(`
      SELECT billing_tier, billing_status 
      FROM restaurants 
      WHERE id = $1
    `, [restaurantId]);

    if (resSettings.rows.length === 0) {
      return; // Or throw error
    }

    const { billing_tier, billing_status } = resSettings.rows[0];

    if (billing_status !== 'ACTIVE') {
      return;
    }

    const tier = billing_tier as BillingTier;
    const pricing = BILLING_PRICING[tier];

    // Check if OTP service is supported and get charge
    if (!pricing || pricing.otpCharge === null) {
      throw new Error(`Tier ${tier} does not support OTP Service.`);
    }

    const chargeAmount = pricing.otpCharge;

    // Check if duplicate transaction exists
    const txCheck = await executor.query(`
      SELECT id FROM billing_transactions 
      WHERE reference_id = $1 AND transaction_type = 'OTP'
      LIMIT 1
    `, [otpLogId]);
    if (txCheck.rows.length > 0) {
      return;
    }

    const { month, year } = this.getCurrentLocalMonthYear();
    const description = `OTP SMS charge for request #${otpLogId}`;


    // 2. Insert billing transaction
    await executor.query(`
      INSERT INTO billing_transactions (restaurant_id, transaction_type, amount, reference_id, description)
      VALUES ($1, 'OTP', $2, $3, $4)
    `, [restaurantId, chargeAmount, otpLogId, description]);

    // 3. Update monthly summary
    await executor.query(`
      INSERT INTO monthly_billing_summary (
        restaurant_id, month, year, order_charges, otp_charges, subscription_charges, adjustments, total_amount
      )
      VALUES ($1, $2, $3, 0.00, $4, 0.00, 0.00, $4)
      ON CONFLICT (restaurant_id, month, year)
      DO UPDATE SET
        otp_charges = monthly_billing_summary.otp_charges + EXCLUDED.otp_charges,
        total_amount = monthly_billing_summary.total_amount + EXCLUDED.otp_charges
    `, [restaurantId, month, year, chargeAmount]);
  }

  /**
   * Processes manual adjustments.
   */
  static async processAdjustment(restaurantId: string, amount: number, description: string): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const { month, year } = this.getCurrentLocalMonthYear();

      await client.query(`
        INSERT INTO billing_transactions (restaurant_id, transaction_type, amount, description)
        VALUES ($1, 'ADJUSTMENT', $2, $3)
      `, [restaurantId, amount, description]);

      await client.query(`
        INSERT INTO monthly_billing_summary (
          restaurant_id, month, year, order_charges, otp_charges, subscription_charges, adjustments, total_amount
        )
        VALUES ($1, $2, $3, 0.00, 0.00, 0.00, $4, $4)
        ON CONFLICT (restaurant_id, month, year)
        DO UPDATE SET
          adjustments = monthly_billing_summary.adjustments + EXCLUDED.adjustments,
          total_amount = monthly_billing_summary.total_amount + EXCLUDED.adjustments
      `, [restaurantId, month, year, amount]);

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Processes a subscription payment/charge (e.g. at the start of a cycle).
   */
  static async processSubscriptionBilling(restaurantId: string): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const resSettings = await client.query(`
        SELECT billing_tier, billing_model, billing_status 
        FROM restaurants 
        WHERE id = $1
      `, [restaurantId]);

      if (resSettings.rows.length === 0) {
        throw new Error('Restaurant not found');
      }

      const { billing_tier, billing_model, billing_status } = resSettings.rows[0];

      if (billing_status !== 'ACTIVE' || billing_model !== 'SUBSCRIPTION') {
        throw new Error('Subscription billing only applies to active restaurants with subscription model.');
      }

      const pricing = BILLING_PRICING[billing_tier as BillingTier];
      const amount = pricing.subscriptionMonthly;

      const { month, year } = this.getCurrentLocalMonthYear();
      const description = `Monthly Subscription Charge (${billing_tier} tier)`;

      await client.query(`
        INSERT INTO billing_transactions (restaurant_id, transaction_type, amount, description)
        VALUES ($1, 'SUBSCRIPTION', $2, $3)
      `, [restaurantId, amount, description]);

      await client.query(`
        INSERT INTO monthly_billing_summary (
          restaurant_id, month, year, order_charges, otp_charges, subscription_charges, adjustments, total_amount
        )
        VALUES ($1, $2, $3, 0.00, 0.00, $4, 0.00, $4)
        ON CONFLICT (restaurant_id, month, year)
        DO UPDATE SET
          subscription_charges = monthly_billing_summary.subscription_charges + EXCLUDED.subscription_charges,
          total_amount = monthly_billing_summary.total_amount + EXCLUDED.subscription_charges
      `, [restaurantId, month, year, amount]);

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Processes a one-time charge.
   */
  static async processOneTimeBilling(restaurantId: string): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const resSettings = await client.query(`
        SELECT billing_tier, billing_model, billing_status 
        FROM restaurants 
        WHERE id = $1
      `, [restaurantId]);

      if (resSettings.rows.length === 0) {
        throw new Error('Restaurant not found');
      }

      const { billing_tier, billing_model, billing_status } = resSettings.rows[0];

      if (billing_status !== 'ACTIVE' || billing_model !== 'ONE_TIME') {
        throw new Error('One-time billing only applies to active restaurants with one-time model.');
      }

      const pricing = BILLING_PRICING[billing_tier as BillingTier];
      if (pricing.oneTime === null) {
        throw new Error(`Tier ${billing_tier} does not support One Time billing.`);
      }
      
      const amount = pricing.oneTime;

      const { month, year } = this.getCurrentLocalMonthYear();
      const description = `One Time Setup Fee (${billing_tier} tier)`;

      await client.query(`
        INSERT INTO billing_transactions (restaurant_id, transaction_type, amount, description)
        VALUES ($1, 'ONE_TIME', $2, $3)
      `, [restaurantId, amount, description]);

      await client.query(`
        INSERT INTO monthly_billing_summary (
          restaurant_id, month, year, order_charges, otp_charges, subscription_charges, adjustments, total_amount
        )
        VALUES ($1, $2, $3, 0.00, 0.00, $4, 0.00, $4)
        ON CONFLICT (restaurant_id, month, year)
        DO UPDATE SET
          subscription_charges = monthly_billing_summary.subscription_charges + EXCLUDED.subscription_charges,
          total_amount = monthly_billing_summary.total_amount + EXCLUDED.subscription_charges
      `, [restaurantId, month, year, amount]);

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}
