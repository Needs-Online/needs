import crypto from 'crypto';
import { BookingStatus } from '@/common/enums';
import { BadRequestError } from '@/common/errors/app-error';

export const ALLOWED_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  [BookingStatus.DRAFT]: [BookingStatus.REQUESTED, BookingStatus.CANCELLED],
  [BookingStatus.REQUESTED]: [BookingStatus.MATCHING, BookingStatus.CANCELLED, BookingStatus.EXPIRED],
  [BookingStatus.MATCHING]: [BookingStatus.ASSIGNED, BookingStatus.REQUESTED, BookingStatus.CANCELLED, BookingStatus.EXPIRED],
  [BookingStatus.ASSIGNED]: [BookingStatus.PROVIDER_EN_ROUTE, BookingStatus.CANCELLED],
  [BookingStatus.PROVIDER_EN_ROUTE]: [BookingStatus.PROVIDER_ARRIVED, BookingStatus.CANCELLED],
  [BookingStatus.PROVIDER_ARRIVED]: [BookingStatus.IN_PROGRESS, BookingStatus.CANCELLED],
  [BookingStatus.IN_PROGRESS]: [BookingStatus.COMPLETED, BookingStatus.CANCELLED],
  [BookingStatus.COMPLETED]: [],
  [BookingStatus.CANCELLED]: [],
  [BookingStatus.EXPIRED]: [],
};

export class BookingStateMachine {
  static canTransition(from: BookingStatus, to: BookingStatus): boolean {
    const allowed = ALLOWED_TRANSITIONS[from];
    return allowed ? allowed.includes(to) : false;
  }

  static validateTransition(from: BookingStatus, to: BookingStatus): void {
    if (!this.canTransition(from, to)) {
      throw new BadRequestError(
        `Invalid booking state transition from '${from}' to '${to}'. Allowed: [${ALLOWED_TRANSITIONS[from]?.join(', ') || 'None'}]`
      );
    }
  }

  static generateSecureOtp(): string {
    return crypto.randomInt(1000, 10000).toString();
  }

  static generateBookingNumber(): string {
    const datePrefix = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = crypto.randomInt(1000, 9999);
    return `BK-${datePrefix}-${randomSuffix}`;
  }
}
