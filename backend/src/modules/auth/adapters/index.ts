import { OtpProvider } from './otp-provider.interface';
import { MockOtpAdapter } from './mock-otp.adapter';
import { SmsOtpAdapter } from './sms-otp.adapter';
import { env } from '@/config/env';

let cachedProvider: OtpProvider | null = null;

export function getOtpProvider(): OtpProvider {
  if (cachedProvider) {
    return cachedProvider;
  }

  if (env.NODE_ENV === 'production') {
    cachedProvider = new SmsOtpAdapter();
  } else {
    cachedProvider = new MockOtpAdapter();
  }

  return cachedProvider;
}

export * from './otp-provider.interface';
export * from './mock-otp.adapter';
export * from './sms-otp.adapter';
