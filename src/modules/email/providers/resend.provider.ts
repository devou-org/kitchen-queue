import { IEmailProvider, EmailPayload, EmailSendResult } from '../email.types';

/**
 * Resend Email Provider using native fetch (zero external npm dependencies required).
 * Requires RESEND_API_KEY and optionally EMAIL_FROM in environment.
 */
export class ResendEmailProvider implements IEmailProvider {
  readonly name = 'resend';
  private apiKey: string;
  private defaultFrom: string;

  constructor(apiKey?: string, defaultFrom?: string) {
    this.apiKey = apiKey || process.env.RESEND_API_KEY || '';
    this.defaultFrom = defaultFrom || process.env.EMAIL_FROM || 'Qdine <onboarding@getqdine.com>';
  }

  async sendEmail(payload: EmailPayload): Promise<EmailSendResult> {
    if (!this.apiKey) {
      return {
        success: false,
        error: 'RESEND_API_KEY is not configured in environment',
      };
    }

    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: this.defaultFrom,
          to: [payload.to],
          subject: payload.subject,
          html: payload.html,
          text: payload.text,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.message || `Resend API returned status ${response.status}`,
        };
      }

      return {
        success: true,
        messageId: data.id,
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'Network error communicating with Resend API',
      };
    }
  }
}
