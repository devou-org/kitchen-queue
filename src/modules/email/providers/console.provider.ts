import { IEmailProvider, EmailPayload, EmailSendResult } from '../email.types';

/**
 * Console Email Provider for local development, staging and fallback.
 * Formats emails directly into stdout while logging to database.
 */
export class ConsoleEmailProvider implements IEmailProvider {
  readonly name = 'console';

  async sendEmail(payload: EmailPayload): Promise<EmailSendResult> {
    const divider = '─'.repeat(60);
    console.log(`\n📧 [EMAIL PROVIDER: CONSOLE] Outbound Email Dispatch`);
    console.log(divider);
    console.log(`To:           ${payload.to}`);
    console.log(`Subject:      ${payload.subject}`);
    console.log(`Template:     ${payload.templateType}`);
    if (payload.text) {
      console.log(`Text Body:\n${payload.text}`);
    } else {
      console.log(`HTML Preview:\n${payload.html.replace(/<[^>]*>/g, '').slice(0, 300)}...`);
    }
    console.log(divider + '\n');

    return {
      success: true,
      messageId: `console-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    };
  }
}
