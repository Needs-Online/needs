import { z } from 'zod';
import { DiscountType } from '@/common/enums';

export const validateCouponSchema = z.object({
  code: z.string().min(2).max(50).toUpperCase(),
  orderAmount: z.number().positive('Order amount must be positive'),
});

export type ValidateCouponDto = z.infer<typeof validateCouponSchema>;

export const createCouponSchema = z.object({
  code: z.string().min(2).max(50).toUpperCase(),
  description: z.string().optional(),
  discountType: z.nativeEnum(DiscountType).default(DiscountType.PERCENTAGE),
  discountValue: z.number().positive(),
  maxDiscount: z.number().positive().optional(),
  minOrderAmount: z.number().min(0).default(0),
  usageLimit: z.number().int().positive().default(100),
  perUserLimit: z.number().int().positive().default(1),
  validFrom: z.string().datetime(),
  validUntil: z.string().datetime(),
});

export type CreateCouponDto = z.infer<typeof createCouponSchema>;
