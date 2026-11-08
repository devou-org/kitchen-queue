import { pool } from '@/lib/db';
import crypto from 'crypto';

export type TokenType = 'EMAIL_VERIFICATION' | 'PASSWORD_RESET';

export class AuthTokenService {
  /**
   * Generates a secure numeric 6-digit OTP code and persists it in auth_verification_tokens
   */
  static async createVerificationOtp(
    email: string,
    tokenType: TokenType,
    ttlMinutes = 10
  ): Promise<string> {
    const cleanEmail = email.trim().toLowerCase();
    // Generate secure 6-digit numeric OTP
    const otp = Math.floor(100000 + crypto.randomInt(900000)).toString();

    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

    // Invalidate any previous unused tokens of this type for this email
    try {
      await pool.query(
        `UPDATE auth_verification_tokens
         SET is_used = true, used_at = NOW()
         WHERE LOWER(email) = $1 AND token_type = $2 AND is_used = false`,
        [cleanEmail, tokenType]
      );

      // Insert new token
      await pool.query(
        `INSERT INTO auth_verification_tokens (email, token, token_type, expires_at)
         VALUES ($1, $2, $3, $4)`,
        [cleanEmail, otp, tokenType, expiresAt.toISOString()]
      );
    } catch (err: any) {
      // Fallback: If table does not exist, run auto-migration
      if (err.message?.includes('auth_verification_tokens') || err.message?.includes('does not exist')) {
        await this.ensureAuthTables();
        await pool.query(
          `INSERT INTO auth_verification_tokens (email, token, token_type, expires_at)
           VALUES ($1, $2, $3, $4)`,
          [cleanEmail, otp, tokenType, expiresAt.toISOString()]
        );
      } else {
        throw err;
      }
    }

    return otp;
  }

  /**
   * Verifies and immediately consumes an OTP (prevents replay attacks)
   */
  static async verifyAndConsumeOtp(
    email: string,
    otp: string,
    tokenType: TokenType
  ): Promise<boolean> {
    const cleanEmail = email.trim().toLowerCase();
    const cleanOtp = otp.trim();

    try {
      const res = await pool.query(
        `SELECT id, expires_at
         FROM auth_verification_tokens
         WHERE LOWER(email) = $1 AND token = $2 AND token_type = $3 AND is_used = false
         ORDER BY created_at DESC
         LIMIT 1`,
        [cleanEmail, cleanOtp, tokenType]
      );

      if (res.rows.length === 0) {
        return false;
      }

      const tokenRecord = res.rows[0];
      const now = new Date();
      if (new Date(tokenRecord.expires_at) < now) {
        // Expired
        return false;
      }

      // Mark consumed
      await pool.query(
        `UPDATE auth_verification_tokens
         SET is_used = true, used_at = NOW()
         WHERE id = $1`,
        [tokenRecord.id]
      );

      return true;
    } catch (err) {
      console.error('[AuthTokenService] OTP verification failed:', err);
      return false;
    }
  }

  /**
   * Marks an admin's email as verified in the admins table
   */
  static async markAdminEmailVerified(email: string): Promise<boolean> {
    const cleanEmail = email.trim().toLowerCase();
    try {
      const res = await pool.query(
        `UPDATE admins
         SET is_email_verified = true, email_verified_at = NOW()
         WHERE LOWER(email) = $1
         RETURNING id`,
        [cleanEmail]
      );
      return res.rows.length > 0;
    } catch (err: any) {
      if (err.message?.includes('is_email_verified')) {
        // Run auto-migration on admins table
        await pool.query(`
          ALTER TABLE admins
          ADD COLUMN IF NOT EXISTS is_email_verified BOOLEAN DEFAULT false,
          ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ DEFAULT NULL;
        `);
        const res = await pool.query(
          `UPDATE admins
           SET is_email_verified = true, email_verified_at = NOW()
           WHERE LOWER(email) = $1
           RETURNING id`,
          [cleanEmail]
        );
        return res.rows.length > 0;
      }
      throw err;
    }
  }

  /**
   * Updates an admin's password
   */
  static async updateAdminPassword(email: string, passwordHash: string): Promise<boolean> {
    const cleanEmail = email.trim().toLowerCase();
    const res = await pool.query(
      `UPDATE admins
       SET password = $1
       WHERE LOWER(email) = $2
       RETURNING id, name, restaurant_id`,
      [passwordHash, cleanEmail]
    );
    return res.rows.length > 0;
  }

  /**
   * Ensures auth & email logging tables exist
   */
  static async ensureAuthTables(): Promise<void> {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS email_logs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          recipient_email VARCHAR(255) NOT NULL,
          subject VARCHAR(255) NOT NULL,
          template_type VARCHAR(100) NOT NULL,
          status VARCHAR(50) NOT NULL,
          provider VARCHAR(50) NOT NULL,
          provider_message_id VARCHAR(255),
          error_message TEXT,
          metadata JSONB DEFAULT '{}'::jsonb,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS auth_verification_tokens (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          email VARCHAR(255) NOT NULL,
          token VARCHAR(255) NOT NULL,
          token_type VARCHAR(50) NOT NULL,
          expires_at TIMESTAMPTZ NOT NULL,
          is_used BOOLEAN DEFAULT false,
          used_at TIMESTAMPTZ DEFAULT NULL,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );

      ALTER TABLE admins
      ADD COLUMN IF NOT EXISTS is_email_verified BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ DEFAULT NULL;
    `);
  }
}
