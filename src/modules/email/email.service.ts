import { pool } from '@/lib/db';
import { IEmailProvider, EmailPayload, EmailSendResult, EmailTemplateType } from './email.types';
import { ConsoleEmailProvider } from './providers/console.provider';
import { ResendEmailProvider } from './providers/resend.provider';

/**
 * Factory helper to resolve the default provider from environment variables
 */
export function getDefaultEmailProvider(): IEmailProvider {
  const providerType = (process.env.EMAIL_PROVIDER || '').toLowerCase();

  // Prefer Resend if explicitly requested or if RESEND_API_KEY is configured
  if (providerType === 'resend' || (!providerType && process.env.RESEND_API_KEY)) {
    return new ResendEmailProvider();
  }

  return new ConsoleEmailProvider();
}

/**
 * Email Service with Dependency Injection and separate table logging (email_logs)
 */
export class EmailService {
  private provider: IEmailProvider;

  /**
   * Dependency Injection: pass any IEmailProvider implementation.
   * Defaults to environment-configured provider (Console in dev, Resend/SMTP if set).
   */
  constructor(provider?: IEmailProvider) {
    this.provider = provider || getDefaultEmailProvider();
  }

  /**
   * Allows hot-swapping or re-injecting the email provider at runtime
   */
  setProvider(provider: IEmailProvider): void {
    this.provider = provider;
  }

  getProviderName(): string {
    return this.provider.name;
  }

  /**
   * Core dispatcher: sends email via active provider and records an entry into email_logs
   */
  async sendEmail(payload: EmailPayload): Promise<EmailSendResult> {
    let result: EmailSendResult;
    try {
      result = await this.provider.sendEmail(payload);
    } catch (err: any) {
      result = {
        success: false,
        error: err.message || 'Unexpected email provider exception',
      };
    }

    // Always log to email_logs table for audit & compliance
    await this.logEmailDispatch({
      recipient_email: payload.to,
      subject: payload.subject,
      template_type: payload.templateType,
      status: result.success ? 'SENT' : 'FAILED',
      provider: this.provider.name,
      provider_message_id: result.messageId || null,
      error_message: result.error || null,
      metadata: payload.metadata || {},
    });

    return result;
  }

  /**
   * Persists outbound email record into email_logs table
   */
  private async logEmailDispatch(logData: {
    recipient_email: string;
    subject: string;
    template_type: EmailTemplateType;
    status: 'SENT' | 'FAILED' | 'SIMULATED';
    provider: string;
    provider_message_id: string | null;
    error_message: string | null;
    metadata: Record<string, any>;
  }): Promise<void> {
    try {
      await pool.query(
        `INSERT INTO email_logs (
          recipient_email, subject, template_type, status, provider,
          provider_message_id, error_message, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          logData.recipient_email,
          logData.subject,
          logData.template_type,
          logData.status,
          logData.provider,
          logData.provider_message_id,
          logData.error_message,
          JSON.stringify(logData.metadata),
        ]
      );
    } catch (err) {
      // Do not crash primary application flow if logging fails
      console.error('[EmailService] Failed to record email log in database:', err);
    }
  }

  // ============================================
  // PRE-CONFIGURED TEMPLATES
  // ============================================

  /**
   * Sends 6-digit email verification OTP during onboarding
   */
  async sendEmailVerificationOtp(email: string, otp: string, restaurantName?: string): Promise<EmailSendResult> {
    const subject = `Verify your email for ${restaurantName || 'Qdine POS'}`;
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 12px; background: #ffffff;">
        <h2 style="color: #111827; margin-bottom: 8px;">Verify Your Email Address</h2>
        <p style="color: #4b5563; font-size: 15px; line-height: 24px;">
          Welcome to <strong>${restaurantName || 'Qdine'}</strong>. Please enter the verification code below to complete your restaurant onboarding:
        </p>
        <div style="margin: 28px 0; text-align: center;">
          <span style="display: inline-block; font-size: 32px; font-weight: 700; letter-spacing: 6px; padding: 12px 28px; background: #f3f4f6; color: #111827; border-radius: 8px; border: 1px dashed #d1d5db;">
            ${otp}
          </span>
        </div>
        <p style="color: #6b7280; font-size: 13px; line-height: 20px;">
          This code is valid for <strong>10 minutes</strong>. If you did not initiate this request, you can safely ignore this email.
        </p>
      </div>
    `;

    return this.sendEmail({
      to: email,
      subject,
      html,
      text: `Your email verification code for ${restaurantName || 'Qdine'} is: ${otp}. Valid for 10 minutes.`,
      templateType: 'EMAIL_VERIFICATION',
      metadata: { otpSent: true, restaurantName },
    });
  }

  /**
   * Sends 6-digit password reset OTP or link to restaurant admin
   */
  async sendPasswordResetOtp(email: string, otp: string, resetUrl?: string, restaurantName?: string): Promise<EmailSendResult> {
    const subject = `Reset your password - ${restaurantName || 'Qdine Admin'}`;
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 12px; background: #ffffff;">
        <h2 style="color: #111827; margin-bottom: 8px;">Password Reset Request</h2>
        <p style="color: #4b5563; font-size: 15px; line-height: 24px;">
          We received a request to reset the password for your restaurant admin account. Use the one-time code below to choose a new password:
        </p>
        <div style="margin: 28px 0; text-align: center;">
          <span style="display: inline-block; font-size: 32px; font-weight: 700; letter-spacing: 6px; padding: 12px 28px; background: #fef2f2; color: #b91c1c; border-radius: 8px; border: 1px dashed #fca5a5;">
            ${otp}
          </span>
        </div>
        ${
          resetUrl
            ? `<div style="text-align: center; margin-bottom: 24px;">
                <a href="${resetUrl}" style="background: #111827; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-size: 14px; font-weight: 500;">Direct Reset Link</a>
               </div>`
            : ''
        }
        <p style="color: #6b7280; font-size: 13px; line-height: 20px;">
          This code will expire in <strong>15 minutes</strong>. If you did not ask to reset your password, please ignore this email or contact support if you suspect unauthorized access.
        </p>
      </div>
    `;

    return this.sendEmail({
      to: email,
      subject,
      html,
      text: `Your password reset code for ${restaurantName || 'Qdine'} is: ${otp}. Valid for 15 minutes.`,
      templateType: 'PASSWORD_RESET',
      metadata: { otpSent: true, restaurantName },
    });
  }

  /**
   * Sends confirmation when password has been successfully updated
   */
  async sendPasswordChangedNotification(email: string, restaurantName?: string): Promise<EmailSendResult> {
    const subject = `Your password was successfully changed - ${restaurantName || 'Qdine'}`;
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 12px; background: #ffffff;">
        <h2 style="color: #111827; margin-bottom: 8px;">Password Updated Successfully</h2>
        <p style="color: #4b5563; font-size: 15px; line-height: 24px;">
          The password for your restaurant admin account (<strong>${email}</strong>) has been successfully changed.
        </p>
        <p style="color: #4b5563; font-size: 14px; line-height: 22px;">
          If you performed this action, no further steps are needed. If you did not make this change, please contact support immediately.
        </p>
      </div>
    `;

    return this.sendEmail({
      to: email,
      subject,
      html,
      text: `The password for your admin account ${email} was changed successfully. If this wasn't you, contact support immediately.`,
      templateType: 'PASSWORD_CHANGED',
      metadata: { restaurantName },
    });
  }
}

// Global default singleton instance
export const emailService = new EmailService();
