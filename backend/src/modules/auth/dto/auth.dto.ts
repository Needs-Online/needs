import { z } from 'zod';

export const sendOtpSchema = z.object({
  phone: z
    .string()
    .min(10, 'Phone number must be at least 10 characters')
    .max(15, 'Phone number too long')
    .regex(
      /^\+?[1-9]\d{8,14}$/,
      'Invalid phone number format (must be valid international E.164 or national format)'
    ),
});

export type SendOtpDto = z.infer<typeof sendOtpSchema>;

export const verifyOtpSchema = z.object({
  phone: z
    .string()
    .min(10)
    .max(15)
    .regex(/^\+?[1-9]\d{8,14}$/, 'Invalid phone number format'),
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
