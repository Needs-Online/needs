import { z } from 'zod';
import { BookingStatus } from '@/common/enums';

export const createBookingSchema = z.object({
  serviceId: z.string().uuid('Invalid service ID'),
  addressLine: z.string().min(5, 'Address line must be at least 5 characters'),
  city: z.string().min(2).default('Dhaka'),
  latitude: z.number().min(-90).max(90, 'Invalid latitude'),
  longitude: z.number().min(-180).max(180, 'Invalid longitude'),
  scheduledAt: z.string().datetime().optional(),
});

export type CreateBookingDto = z.infer<typeof createBookingSchema>;

export const transitionBookingSchema = z.object({
  action: z.enum([
    'REQUEST',
    'START_TRIP',
    'ARRIVE',
    'START_WORK',
    'COMPLETE_WORK',
    'CANCEL',
  ]),
  otp: z.string().length(4, 'OTP must be 4 digits').optional(),
  cancellationReason: z.string().min(3).max(500).optional(),
  note: z.string().max(500).optional(),
});

export type TransitionBookingDto = z.infer<typeof transitionBookingSchema>;

export const listBookingsQuerySchema = z.object({
  status: z.nativeEnum(BookingStatus).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export type ListBookingsQueryDto = z.infer<typeof listBookingsQuerySchema>;
