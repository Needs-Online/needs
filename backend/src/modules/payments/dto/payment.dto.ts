import { z } from 'zod';
import { PaymentMethod } from '@/common/enums';

export const initiatePaymentSchema = z.object({
  bookingId: z.string().uuid('Invalid booking ID'),
  gateway: z.nativeEnum(PaymentMethod),
});

export type InitiatePaymentDto = z.infer<typeof initiatePaymentSchema>;
