export type EmailTemplateType =
  | 'EMAIL_VERIFICATION'
  | 'PASSWORD_RESET'
  | 'PASSWORD_CHANGED'
  | 'WELCOME_ONBOARDING'
  | 'GENERAL';

export interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  text?: string;
  templateType: EmailTemplateType;
  metadata?: Record<string, any>;
}

export interface EmailSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Pluggable Email Provider Interface for Dependency Injection
 */
export interface IEmailProvider {
  readonly name: string;
  sendEmail(payload: EmailPayload): Promise<EmailSendResult>;
}
