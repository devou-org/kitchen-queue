import { pool } from '@/lib/db';

export interface GeminiConfig {
  id: string;
  model: string;
  rpm_limit: number;
  tpm_limit: number;
  rpd_limit: number;
  max_output_tokens: number;
  tokens_per_credit: number;
  is_enabled: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface GeminiDailyUsage {
  id: string;
  usage_date: string;
  request_count: number;
  input_tokens: number;
  is_enabled: boolean;
  disabled_reason: string | null;
  disabled_at: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface ReserveResult {
  allowed: boolean;
  code?: string;
  reason?: string;
  isAlreadyDisabled?: boolean;
  justDisabled?: boolean;
  config?: GeminiConfig;
  usageDate?: string;
}

export class AIRepository {
  /**
   * Fetches the active global Gemini configuration.
   */
  static async getGlobalConfig(): Promise<GeminiConfig> {
    const res = await pool.query(`
      SELECT id, model, rpm_limit, tpm_limit, rpd_limit, max_output_tokens, tokens_per_credit, is_enabled
      FROM gemini_config
      LIMIT 1
    `);

    if (res.rows.length === 0) {
      // Fallback default if missing
      return {
        id: '',
        model: 'gemini-3.5-flash-lite',
        rpm_limit: 15,
        tpm_limit: 200000,
        rpd_limit: 1500,
        max_output_tokens: 2000,
        tokens_per_credit: 2000,
        is_enabled: true
      };
    }

    const row = res.rows[0];
    return {
      id: row.id,
      model: row.model,
      rpm_limit: parseInt(row.rpm_limit, 10),
      tpm_limit: parseInt(row.tpm_limit, 10),
      rpd_limit: parseInt(row.rpd_limit, 10),
      max_output_tokens: parseInt(row.max_output_tokens, 10),
      tokens_per_credit: parseInt(row.tokens_per_credit || '2000', 10),
      is_enabled: row.is_enabled
    };
  }

  /**
   * Gets specific max output tokens for a request type or falls back to global default.
   */
  static async getMaxOutputTokens(requestType: string, defaultMaxTokens: number): Promise<number> {
    try {
      const res = await pool.query(
        `SELECT max_output_tokens FROM gemini_request_config WHERE request_type = $1 LIMIT 1`,
        [requestType]
      );
      if (res.rows.length > 0) {
        return parseInt(res.rows[0].max_output_tokens, 10);
      }
    } catch {
      // Ignore table lookup error and return default
    }
    return defaultMaxTokens;
  }

  /**
   * ATOMIC CHECK & RESERVATION:
   * Locks gemini_daily_usage row for today's date.
   * Checks RPD, TPM, and RPM limits.
   * If valid -> increments request_count and input_tokens.
   * If limit exceeded -> sets is_enabled = false and logs disabled_reason.
   */
  static async atomicCheckAndReserveQuota(inputTokens: number): Promise<ReserveResult> {
    const client = await pool.connect();
    const todayStr = new Date().toISOString().split('T')[0];

    try {
      await client.query('BEGIN');

      // 1. Lock & check global config
      const configRes = await client.query(`
        SELECT id, model, rpm_limit, tpm_limit, rpd_limit, max_output_tokens, tokens_per_credit, is_enabled
        FROM gemini_config
        LIMIT 1
        FOR UPDATE
      `);

      let config: GeminiConfig;
      if (configRes.rows.length === 0) {
        config = {
          id: '',
          model: 'gemini-flash-latest',
          rpm_limit: 10,
          tpm_limit: 200000,
          rpd_limit: 200,
          max_output_tokens: 1000,
          tokens_per_credit: 2000,
          is_enabled: true
        };
      } else {
        const row = configRes.rows[0];
        config = {
          id: row.id,
          model: row.model,
          rpm_limit: parseInt(row.rpm_limit, 10),
          tpm_limit: parseInt(row.tpm_limit, 10),
          rpd_limit: parseInt(row.rpd_limit, 10),
          max_output_tokens: parseInt(row.max_output_tokens, 10),
          tokens_per_credit: parseInt(row.tokens_per_credit || '2000', 10),
          is_enabled: row.is_enabled
        };
      }

      if (!config.is_enabled) {
        await client.query('COMMIT');
        return {
          allowed: false,
          code: 'GEMINI_DISABLED',
          reason: 'GLOBAL_CONFIG_DISABLED',
          isAlreadyDisabled: true
        };
      }

      // 2. Lock / Insert current day's usage record
      let dailyRes = await client.query(
        `SELECT * FROM gemini_daily_usage WHERE usage_date = $1 FOR UPDATE`,
        [todayStr]
      );

      if (dailyRes.rows.length === 0) {
        const newDaily = await client.query(
          `INSERT INTO gemini_daily_usage (usage_date, request_count, input_tokens, is_enabled)
           VALUES ($1, 0, 0, true)
           RETURNING *`,
          [todayStr]
        );
        dailyRes = newDaily;
      }

      const daily = dailyRes.rows[0];
      const requestCount = parseInt(daily.request_count, 10);
      const currentInputTokens = parseInt(daily.input_tokens, 10);

      // If daily record is already disabled
      if (!daily.is_enabled) {
        await client.query('COMMIT');
        return {
          allowed: false,
          code: 'GEMINI_DAILY_LIMIT_REACHED',
          reason: daily.disabled_reason || 'DISABLED',
          isAlreadyDisabled: true
        };
      }

      // 3. Pre-Request Limit Check
      // Check 1-minute rolling window for rate limiting
      const rpmRes = await client.query(
        `SELECT COUNT(*)::int as count FROM gemini_usage WHERE created_at >= NOW() - INTERVAL '1 minute'`
      );
      const currentRpm = rpmRes.rows[0]?.count || 0;

      if (currentRpm >= config.rpm_limit) {
        await client.query('COMMIT');
        return {
          allowed: false,
          code: 'GEMINI_RATE_LIMIT',
          reason: 'RPM_LIMIT',
          isAlreadyDisabled: false
        };
      }

      // Check daily caps (RPD and TPM)
      const newRequestCount = requestCount + 1;
      const newInputTokens = currentInputTokens + inputTokens;

      let failReason: string | null = null;
      if (newRequestCount > config.rpd_limit) {
        failReason = 'RPD_LIMIT';
      } else if (newInputTokens > config.tpm_limit) {
        failReason = 'TPM_LIMIT';
      }

      if (failReason) {
        // Disable Gemini globally for today
        await client.query(
          `UPDATE gemini_daily_usage
           SET is_enabled = false,
               disabled_reason = $1,
               disabled_at = CURRENT_TIMESTAMP,
               updated_at = CURRENT_TIMESTAMP
           WHERE usage_date = $2`,
          [failReason, todayStr]
        );

        await client.query('COMMIT');
        return {
          allowed: false,
          code: 'GEMINI_DAILY_LIMIT_REACHED',
          reason: failReason,
          justDisabled: true
        };
      }

      // 4. Update reservation
      await client.query(
        `UPDATE gemini_daily_usage
         SET request_count = request_count + 1,
             input_tokens = input_tokens + $1,
             updated_at = CURRENT_TIMESTAMP
         WHERE usage_date = $2`,
        [inputTokens, todayStr]
      );

      await client.query('COMMIT');
      return {
        allowed: true,
        config,
        usageDate: todayStr
      };
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error in atomicCheckAndReserveQuota:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Logs an individual request in gemini_usage and updates gemini_usage_monthly.
   */
  static async logRequestUsage(params: {
    restaurantId?: string | null;
    requestType: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    status: 'SUCCESS' | 'ERROR' | 'REJECTED';
    errorCode?: string | null;
    errorMessage?: string | null;
    responseTimeMs?: number | null;
  }): Promise<void> {
    const {
      restaurantId,
      requestType,
      model,
      inputTokens,
      outputTokens,
      totalTokens,
      status,
      errorCode,
      errorMessage,
      responseTimeMs
    } = params;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Insert per-request record
      await client.query(
        `INSERT INTO gemini_usage (
          restaurant_id, request_type, model, input_tokens, output_tokens, total_tokens,
          status, error_code, error_message, response_time_ms
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          restaurantId || null,
          requestType,
          model,
          inputTokens,
          outputTokens,
          totalTokens,
          status,
          errorCode || null,
          errorMessage || null,
          responseTimeMs || null
        ]
      );

      // 2. Update monthly stats & ai_credits for restaurant if restaurantId provided
      if (restaurantId) {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth() + 1;
        const periodStr = `${year}-${String(month).padStart(2, '0')}`;

        const isSuccess = status === 'SUCCESS' ? 1 : 0;
        const isError = status === 'ERROR' ? 1 : 0;

        await client.query(
          `INSERT INTO gemini_usage_monthly (
            restaurant_id, usage_year, usage_month, request_count, input_tokens, output_tokens, total_tokens, success_count, error_count
          ) VALUES ($1, $2, $3, 1, $4, $5, $6, $7, $8)
          ON CONFLICT (restaurant_id, usage_year, usage_month)
          DO UPDATE SET
            request_count = gemini_usage_monthly.request_count + 1,
            input_tokens = gemini_usage_monthly.input_tokens + EXCLUDED.input_tokens,
            output_tokens = gemini_usage_monthly.output_tokens + EXCLUDED.output_tokens,
            total_tokens = gemini_usage_monthly.total_tokens + EXCLUDED.total_tokens,
            success_count = gemini_usage_monthly.success_count + EXCLUDED.success_count,
            error_count = gemini_usage_monthly.error_count + EXCLUDED.error_count`,
          [restaurantId, year, month, inputTokens, outputTokens, totalTokens, isSuccess, isError]
        );

        // Fetch tokens per credit and restaurant allocated credits
        const configRes = await client.query(`SELECT tokens_per_credit FROM gemini_config LIMIT 1`);
        const tokensPerCredit = parseInt(configRes.rows[0]?.tokens_per_credit || '2000', 10);

        const restRes = await client.query(`SELECT monthly_ai_credits, custom_ai_credits FROM restaurants WHERE id = $1`, [restaurantId]);
        const rRow = restRes.rows[0];
        const allocatedCredits = rRow ? (rRow.custom_ai_credits ?? rRow.monthly_ai_credits ?? 10) : 10;

        // Upsert ai_credits for current monthly billing period
        await client.query(
          `INSERT INTO ai_credits (
            restaurant_id, billing_period, allocated_credits, used_tokens, used_credits
          ) VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (restaurant_id, billing_period)
          DO UPDATE SET
            allocated_credits = $3,
            used_tokens = ai_credits.used_tokens + $4,
            used_credits = ROUND((ai_credits.used_tokens + $4)::numeric / $6::numeric, 2),
            updated_at = CURRENT_TIMESTAMP`,
          [restaurantId, periodStr, allocatedCredits, totalTokens, Number((totalTokens / tokensPerCredit).toFixed(2)), tokensPerCredit]
        );
      }

      // 3. Keep gemini_daily_usage tokens in sync with actual total tokens logged today
      const todayStr = new Date().toISOString().split('T')[0];
      await client.query(
        `UPDATE gemini_daily_usage
         SET input_tokens = (
           SELECT COALESCE(SUM(total_tokens), 0)::bigint
           FROM gemini_usage
           WHERE created_at >= CURRENT_DATE
         ),
         updated_at = CURRENT_TIMESTAMP
         WHERE usage_date = $1`,
        [todayStr]
      );

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Error logging Gemini request usage:', err);
    } finally {
      client.release();
    }
  }

  /**
   * Retrieves Super Admin dashboard overview metrics for Gemini usage & quotas.
   */
  static async getSuperAdminOverview() {
    const todayStr = new Date().toISOString().split('T')[0];

    const config = await this.getGlobalConfig();

    const dailyRes = await pool.query(
      `SELECT * FROM gemini_daily_usage WHERE usage_date = $1 LIMIT 1`,
      [todayStr]
    );

    const dailyUsage = dailyRes.rows.length > 0 ? {
      usage_date: todayStr,
      request_count: parseInt(dailyRes.rows[0].request_count, 10),
      input_tokens: parseInt(dailyRes.rows[0].input_tokens, 10),
      is_enabled: dailyRes.rows[0].is_enabled,
      disabled_reason: dailyRes.rows[0].disabled_reason,
      disabled_at: dailyRes.rows[0].disabled_at
    } : {
      usage_date: todayStr,
      request_count: 0,
      input_tokens: 0,
      is_enabled: config.is_enabled,
      disabled_reason: null,
      disabled_at: null
    };

    // Per-restaurant breakdown (for current day / month)
    const restaurantUsageRes = await pool.query(`
      SELECT 
        u.restaurant_id,
        r.name as restaurant_name,
        r.slug as restaurant_slug,
        COUNT(*)::int as request_count,
        COALESCE(SUM(u.input_tokens), 0)::bigint as input_tokens,
        COALESCE(SUM(u.output_tokens), 0)::bigint as output_tokens,
        COALESCE(SUM(u.total_tokens), 0)::bigint as total_tokens,
        COUNT(*) FILTER (WHERE u.status = 'SUCCESS')::int as success_count,
        COUNT(*) FILTER (WHERE u.status = 'ERROR')::int as error_count
      FROM gemini_usage u
      LEFT JOIN restaurants r ON u.restaurant_id = r.id
      WHERE u.created_at >= CURRENT_DATE
      GROUP BY u.restaurant_id, r.name, r.slug
      ORDER BY request_count DESC
    `);

    // Recent request logs
    const recentLogsRes = await pool.query(`
      SELECT 
        u.id,
        u.restaurant_id,
        r.name as restaurant_name,
        u.request_type,
        u.model,
        u.input_tokens,
        u.output_tokens,
        u.total_tokens,
        u.status,
        u.error_code,
        u.error_message,
        u.response_time_ms,
        u.created_at
      FROM gemini_usage u
      LEFT JOIN restaurants r ON u.restaurant_id = r.id
      ORDER BY u.created_at DESC
      LIMIT 50
    `);

    return {
      config,
      dailyUsage,
      restaurantBreakdown: restaurantUsageRes.rows,
      recentLogs: recentLogsRes.rows
    };
  }

  /**
   * Gets AI credits stats for a specific restaurant for current month (or creates current month record if missing)
   */
  static async getRestaurantAICredits(restaurantId: string) {
    const now = new Date();
    const periodStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // Get config tokens per credit
    const config = await this.getGlobalConfig();
    const tokensPerCredit = config.tokens_per_credit || 2000;

    // Get restaurant allocation
    const restRes = await pool.query(
      `SELECT monthly_ai_credits, custom_ai_credits FROM restaurants WHERE id = $1`,
      [restaurantId]
    );
    const rRow = restRes.rows[0];
    const allocatedCredits = rRow ? (rRow.custom_ai_credits ?? rRow.monthly_ai_credits ?? 10) : 10;

    // Fetch or calculate usage for current month
    const creditRes = await pool.query(
      `SELECT allocated_credits, used_credits, used_tokens FROM ai_credits WHERE restaurant_id = $1 AND billing_period = $2`,
      [restaurantId, periodStr]
    );

    let usedTokens = 0;
    let usedCredits = 0;

    if (creditRes.rows.length > 0) {
      usedTokens = parseInt(creditRes.rows[0].used_tokens, 10);
      usedCredits = parseFloat(creditRes.rows[0].used_credits);
    } else {
      // Calculate from gemini_usage for current month
      const usageCalc = await pool.query(
        `SELECT COALESCE(SUM(total_tokens), 0)::bigint as total_tokens
         FROM gemini_usage
         WHERE restaurant_id = $1
           AND created_at >= date_trunc('month', CURRENT_DATE)`,
        [restaurantId]
      );
      usedTokens = parseInt(usageCalc.rows[0]?.total_tokens || '0', 10);
      usedCredits = Number((usedTokens / tokensPerCredit).toFixed(2));
    }

    return {
      billing_period: periodStr,
      allocated_credits: allocatedCredits,
      used_credits: usedCredits,
      used_tokens: usedTokens,
      tokens_per_credit: tokensPerCredit,
      remaining_credits: Math.max(0, Number((allocatedCredits - usedCredits).toFixed(2)))
    };
  }

  /**
   * Updates Super Admin global config settings.
   */
  static async updateGlobalConfig(params: {
    model?: string;
    rpm_limit?: number;
    tpm_limit?: number;
    rpd_limit?: number;
    max_output_tokens?: number;
    tokens_per_credit?: number;
    is_enabled?: boolean;
  }): Promise<GeminiConfig> {
    const todayStr = new Date().toISOString().split('T')[0];

    const current = await this.getGlobalConfig();
    const model = params.model ?? current.model;
    const rpm_limit = params.rpm_limit ?? current.rpm_limit;
    const tpm_limit = params.tpm_limit ?? current.tpm_limit;
    const rpd_limit = params.rpd_limit ?? current.rpd_limit;
    const max_output_tokens = params.max_output_tokens ?? current.max_output_tokens;
    const tokens_per_credit = params.tokens_per_credit ?? current.tokens_per_credit;
    const is_enabled = params.is_enabled ?? current.is_enabled;

    await pool.query(
      `UPDATE gemini_config
       SET model = $1,
           rpm_limit = $2,
           tpm_limit = $3,
           rpd_limit = $4,
           max_output_tokens = $5,
           tokens_per_credit = $6,
           is_enabled = $7,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $8`,
      [model, rpm_limit, tpm_limit, rpd_limit, max_output_tokens, tokens_per_credit, is_enabled, current.id]
    );

    // If re-enabling globally, reset daily record's is_enabled flag if needed
    if (is_enabled) {
      await pool.query(
        `UPDATE gemini_daily_usage
         SET is_enabled = true,
             disabled_reason = NULL,
             disabled_at = NULL,
             updated_at = CURRENT_TIMESTAMP
         WHERE usage_date = $1`,
        [todayStr]
      );
    }

    return this.getGlobalConfig();
  }
}
