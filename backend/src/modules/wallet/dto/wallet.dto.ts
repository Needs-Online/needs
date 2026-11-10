import { z } from 'zod';
import { PaymentMethod, PayoutStatus } from '@/common/enums';

export const topupWalletSchema = z.object({
  amount: z.number().positive('Top-up amount must be greater than 0'),
  gateway: z.nativeEnum(PaymentMethod).default(PaymentMethod.BKASH),
});

export type TopupWalletDto = z.infer<typeof topupWalletSchema>;

export const requestPayoutSchema = z.object({
  amount: z
    .number()
    .positive('Payout amount must be greater than 0')
    .min(500, 'Minimum payout amount is 500 BDT'),
  method: z.nativeEnum(PaymentMethod),
  accountNumber: z.string().min(11, 'Account number must be valid mobile/bank account'),
});

export type RequestPayoutDto = z.infer<typeof requestPayoutSchema>;

export const listTransactionsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type ListTransactionsQueryDto = z.infer<typeof listTransactionsQuerySchema>;

export const listPayoutsQuerySchema = z.object({
  status: z.nativeEnum(PayoutStatus).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type ListPayoutsQueryDto = z.infer<typeof listPayoutsQuerySchema>;

export const processPayoutSchema = z.object({
  status: z.enum([PayoutStatus.COMPLETED, PayoutStatus.REJECTED]),
  rejectionReason: z.string().min(3).max(500).optional(),
});

export type ProcessPayoutDto = z.infer<typeof processPayoutSchema>;
