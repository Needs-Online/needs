import { z } from 'zod';
import { normalizeBangladeshPhone } from '@/common/utils/phone.utils';

export const bdPhoneSchema = z.string().transform((val, ctx) => {
  try {
    return normalizeBangladeshPhone(val);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Invalid Bangladesh mobile number (+8801[3-9]XXXXXXXX)';
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message,
    });
    return z.NEVER;
  }
});

export const sendOtpSchema = z.object({
  phone: bdPhoneSchema,
});

export type SendOtpDto = z.infer<typeof sendOtpSchema>;

export const verifyOtpSchema = z.object({
  phone: bdPhoneSchema,
  otp: z
    .string()
    .length(6, 'OTP must be exactly 6 digits')
    .regex(/^\d{6}$/, 'OTP must contain only digits'),
  deviceInfo: z.string().optional(),
});

export type VerifyOtpDto = z.infer<typeof verifyOtpSchema>;

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
  deviceInfo: z.string().optional(),
});

export type RefreshTokenDto = z.infer<typeof refreshTokenSchema>;
