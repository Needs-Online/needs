import { describe, it, expect } from 'vitest';
import { BookingStateMachine } from '@/modules/bookings/booking-state-machine';
import { BookingStatus } from '@/common/enums';
import { BadRequestError } from '@/common/errors/app-error';

describe('BookingStateMachine (Unit)', () => {
  it('should allow valid transitions according to booking lifecycle', () => {
    // DRAFT -> REQUESTED
    expect(
      BookingStateMachine.canTransition(BookingStatus.DRAFT, BookingStatus.REQUESTED)
    ).toBe(true);

    // REQUESTED -> MATCHING
    expect(
      BookingStateMachine.canTransition(BookingStatus.REQUESTED, BookingStatus.MATCHING)
    ).toBe(true);

    // MATCHING -> ASSIGNED
    expect(
      BookingStateMachine.canTransition(BookingStatus.MATCHING, BookingStatus.ASSIGNED)
    ).toBe(true);

    // ASSIGNED -> PROVIDER_EN_ROUTE
    expect(
      BookingStateMachine.canTransition(
        BookingStatus.ASSIGNED,
        BookingStatus.PROVIDER_EN_ROUTE
      )
    ).toBe(true);

    // PROVIDER_EN_ROUTE -> PROVIDER_ARRIVED
    expect(
      BookingStateMachine.canTransition(
        BookingStatus.PROVIDER_EN_ROUTE,
        BookingStatus.PROVIDER_ARRIVED
      )
    ).toBe(true);

    // PROVIDER_ARRIVED -> IN_PROGRESS
    expect(
      BookingStateMachine.canTransition(
        BookingStatus.PROVIDER_ARRIVED,
        BookingStatus.IN_PROGRESS
      )
    ).toBe(true);

    // IN_PROGRESS -> COMPLETED
    expect(
      BookingStateMachine.canTransition(
        BookingStatus.IN_PROGRESS,
        BookingStatus.COMPLETED
      )
    ).toBe(true);
  });

  it('should reject invalid transitions and terminal transitions', () => {
    // Cannot skip states (e.g. DRAFT -> COMPLETED)
    expect(
      BookingStateMachine.canTransition(BookingStatus.DRAFT, BookingStatus.COMPLETED)
    ).toBe(false);

    // Terminal states cannot transition out
    expect(
      BookingStateMachine.canTransition(
        BookingStatus.COMPLETED,
        BookingStatus.IN_PROGRESS
      )
    ).toBe(false);
    expect(
      BookingStateMachine.canTransition(
        BookingStatus.CANCELLED,
        BookingStatus.REQUESTED
      )
    ).toBe(false);
    expect(
      BookingStateMachine.canTransition(
        BookingStatus.EXPIRED,
        BookingStatus.MATCHING
      )
    ).toBe(false);

    expect(() =>
      BookingStateMachine.validateTransition(
        BookingStatus.COMPLETED,
        BookingStatus.IN_PROGRESS
      )
    ).toThrow(BadRequestError);
  });

  it('should generate secure 4-digit numeric OTP', () => {
    const otp = BookingStateMachine.generateSecureOtp();
    expect(otp).toMatch(/^\d{4}$/);
    const otpNum = parseInt(otp, 10);
    expect(otpNum).toBeGreaterThanOrEqual(1000);
    expect(otpNum).toBeLessThan(10000);
  });

  it('should generate formatted unique booking number', () => {
    const num = BookingStateMachine.generateBookingNumber();
    expect(num).toMatch(/^BK-\d{8}-\d{4}$/);
  });
});
