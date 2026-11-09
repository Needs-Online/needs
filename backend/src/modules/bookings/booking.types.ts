import { BookingStatus } from '@/common/enums';

export interface BookingTransitionParams {
  bookingId: string;
  toStatus: BookingStatus;
  actorId: string;
  actorRole: string;
  note?: string;
  metadata?: Record<string, unknown>;
  otp?: string;
  cancellationReason?: string;
}

export interface BookingFilterParams {
  customerId?: string;
  providerId?: string;
  status?: BookingStatus;
  page?: number;
  limit?: number;
}
