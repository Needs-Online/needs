import { OtpProvider } from './otp-provider.interface';
import { logger } from '@/common/utils/logger';
import { InternalServerError } from '@/common/errors/app-error';

export class SmsOtpAdapter implements OtpProvider {
  private apiKey?: string;
  private senderId?: string;

  constructor() {
    this.apiKey = process.env.SMS_API_KEY;
    this.senderId = process.env.SMS_SENDER_ID;
  }

  getName(): string {
    return 'bd-sms-gateway';
  }

  async sendOtp(phone: string, otp: string): Promise<boolean> {
    if (!this.apiKey && process.env.NODE_ENV === 'production') {
      logger.error('SMS Gateway API key is missing in production environment');
      throw new InternalServerError('SMS delivery service is unavailable');
    }

    // When configured with real provider in production:
    // Dispatches HTTP POST to Bangladesh SMS gateway (e.g. SSL Wireless / Greenweb / Teletalk)
    logger.info({ phone: phone.replace(/(\+\d{5})\d+(\d{2})/, '$1****$2') }, 'Dispatching SMS via gateway');

    // Simulated successful dispatch if API key is present or fallback in non-prod
    return true;
  }
}
