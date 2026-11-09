import { z } from 'zod';
import { PaymentMethod } from '@/common/enums';

export const topupWalletSchema = z.object({
  amount: z.number().positive('Top-up amount must be greater than 0'),
  gateway: z.nativeEnum(PaymentMethod).default(PaymentMethod.BKASH),
});

export type TopupWalletDto = z.infer<typeof topupWalletSchema>;

export const requestPayoutSchema = z.object({
  amount: z.number().positive('Payout amount must be greater than 0').min(500, 'Minimum payout amount is 500 BDT'),
  method: z.nativeEnum(PaymentMethod),
  accountNumber: z.string().min(11, 'Account number must be valid mobile/bank account'),
});

export type RequestPayoutDto = z.infer<typeof requestPayoutSchema>;

export const listTransactionsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type ListTransactionsQueryDto = z.infer<typeof listTransactionsQuerySchema>;
