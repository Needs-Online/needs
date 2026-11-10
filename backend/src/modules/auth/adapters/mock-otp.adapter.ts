import { OtpProvider } from './otp-provider.interface';
import { logger } from '@/common/utils/logger';

export class MockOtpAdapter implements OtpProvider {
  getName(): string {
    return 'mock-otp-provider';
  }

  async sendOtp(phone: string, otp: string): Promise<boolean> {
    logger.info(
      { phone, otp: process.env.NODE_ENV === 'test' ? otp : '***REDACTED***' },
      '🔑 [DEV OTP DISPATCHED VIA MOCK PROVIDER]'
    );
    return true;
  }
}
