import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BookingsService } from '@/modules/bookings/bookings.service';
import { BookingsRepository } from '@/modules/bookings/bookings.repository';
import { CatalogRepository } from '@/modules/catalog/catalog.repository';
import { DispatchService } from '@/modules/dispatch/dispatch.service';
import { BookingStatus, Role, PricingType } from '@/common/enums';
import { BadRequestError, ForbiddenError } from '@/common/errors/app-error';
import { Decimal } from '@prisma/client/runtime/library';

vi.mock('@/infra/redis/redis.client', () => ({
  publishEvent: vi.fn(),
  REDIS_KEYS: {
    channel: (name: string) => `channel:${name}`,
  },
}));

vi.mock('@/infra/queue/queue.manager', () => ({
  getQueue: vi.fn().mockReturnValue({
    add: vi.fn(),
  }),
  QUEUE_NAMES: {
    BOOKING_EXPIRY: 'booking-expiry',
  },
}));

describe('Booking Lifecycle State Machine & OTPs (Unit)', () => {
  let bookingsService: BookingsService;
  let mockBookingsRepo: Partial<BookingsRepository>;
  let mockCatalogRepo: Partial<CatalogRepository>;
  let mockDispatchService: Partial<DispatchService>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockBookingsRepo = {
      createBooking: vi.fn(),
      findById: vi.fn(),
      transitionBookingStatus: vi.fn(),
      findBookingEvents: vi.fn(),
    };
    mockCatalogRepo = {
      findServiceById: vi.fn(),
    };
    mockDispatchService = {
      dispatchBooking: vi.fn().mockResolvedValue(null),
    };

    bookingsService = new BookingsService(
      mockBookingsRepo as BookingsRepository,
      mockCatalogRepo as CatalogRepository,
      mockDispatchService as DispatchService
    );
  });

  describe('Full Transition Lifecycle & Authorization', () => {
    it('should transition REQUESTED -> MATCHING (triggered by customer) and start dispatch', async () => {
      mockBookingsRepo.findById = vi.fn().mockResolvedValue({
        id: 'bk-1',
        customerId: 'cust-1',
        status: BookingStatus.REQUESTED,
      });

      mockBookingsRepo.transitionBookingStatus = vi.fn().mockResolvedValue({
        id: 'bk-1',
        status: BookingStatus.MATCHING,
      });

      const result = await bookingsService.transitionBooking(
        'bk-1',
        'cust-1',
        Role.CUSTOMER,
        { action: 'REQUEST' }
      );

      expect(result.status).toBe(BookingStatus.MATCHING);
      expect(mockBookingsRepo.transitionBookingStatus).toHaveBeenCalled();
      expect(mockDispatchService.dispatchBooking).toHaveBeenCalledWith('bk-1');
    });

    it('should reject non-customer attempting to initiate matching', async () => {
      mockBookingsRepo.findById = vi.fn().mockResolvedValue({
        id: 'bk-1',
        customerId: 'cust-1',
        status: BookingStatus.REQUESTED,
      });

      await expect(
        bookingsService.transitionBooking(
          'bk-1',
          'other-user',
          Role.CUSTOMER,
          { action: 'REQUEST' }
        )
      ).rejects.toThrow(ForbiddenError);
    });

    it('should transition ASSIGNED -> PROVIDER_EN_ROUTE (by assigned provider)', async () => {
      mockBookingsRepo.findById = vi.fn().mockResolvedValue({
        id: 'bk-1',
        customerId: 'cust-1',
        providerId: 'prov-1',
        status: BookingStatus.ASSIGNED,
      });

      mockBookingsRepo.transitionBookingStatus = vi.fn().mockResolvedValue({
        id: 'bk-1',
        status: BookingStatus.PROVIDER_EN_ROUTE,
      });

      const result = await bookingsService.transitionBooking(
        'bk-1',
        'usr-prov-1',
        Role.PROVIDER,
        { action: 'START_TRIP' },
        'prov-1'
      );

      expect(result.status).toBe(BookingStatus.PROVIDER_EN_ROUTE);
    });

    it('should transition PROVIDER_EN_ROUTE -> PROVIDER_ARRIVED (by assigned provider)', async () => {
      mockBookingsRepo.findById = vi.fn().mockResolvedValue({
        id: 'bk-1',
        customerId: 'cust-1',
        providerId: 'prov-1',
        status: BookingStatus.PROVIDER_EN_ROUTE,
      });

      mockBookingsRepo.transitionBookingStatus = vi.fn().mockResolvedValue({
        id: 'bk-1',
        status: BookingStatus.PROVIDER_ARRIVED,
      });

      const result = await bookingsService.transitionBooking(
        'bk-1',
        'usr-prov-1',
        Role.PROVIDER,
        { action: 'ARRIVE' },
        'prov-1'
      );

      expect(result.status).toBe(BookingStatus.PROVIDER_ARRIVED);
    });
  });

  describe('OTP Invariants (Start OTP & End OTP)', () => {
    it('should transition PROVIDER_ARRIVED -> IN_PROGRESS only with correct customer Start OTP', async () => {
      mockBookingsRepo.findById = vi.fn().mockResolvedValue({
        id: 'bk-1',
        customerId: 'cust-1',
        providerId: 'prov-1',
        status: BookingStatus.PROVIDER_ARRIVED,
        startOtp: '7823',
        endOtp: '4190',
      });

      mockBookingsRepo.transitionBookingStatus = vi.fn().mockResolvedValue({
        id: 'bk-1',
        status: BookingStatus.IN_PROGRESS,
      });

      const result = await bookingsService.transitionBooking(
        'bk-1',
        'usr-prov-1',
        Role.PROVIDER,
        { action: 'START_WORK', otp: '7823' },
        'prov-1'
      );

      expect(result.status).toBe(BookingStatus.IN_PROGRESS);
    });

    it('should REJECT START_WORK with incorrect Start OTP', async () => {
      mockBookingsRepo.findById = vi.fn().mockResolvedValue({
        id: 'bk-1',
        customerId: 'cust-1',
        providerId: 'prov-1',
        status: BookingStatus.PROVIDER_ARRIVED,
        startOtp: '7823',
      });

      await expect(
        bookingsService.transitionBooking(
          'bk-1',
          'usr-prov-1',
          Role.PROVIDER,
          { action: 'START_WORK', otp: '0000' },
          'prov-1'
        )
      ).rejects.toThrow(BadRequestError);
    });

    it('should transition IN_PROGRESS -> COMPLETED with correct End OTP', async () => {
      mockBookingsRepo.findById = vi.fn().mockResolvedValue({
        id: 'bk-1',
        customerId: 'cust-1',
        providerId: 'prov-1',
        status: BookingStatus.IN_PROGRESS,
        endOtp: '4190',
      });

      mockBookingsRepo.transitionBookingStatus = vi.fn().mockResolvedValue({
        id: 'bk-1',
        status: BookingStatus.COMPLETED,
      });

      const result = await bookingsService.transitionBooking(
        'bk-1',
        'usr-prov-1',
        Role.PROVIDER,
        { action: 'COMPLETE_WORK', otp: '4190' },
        'prov-1'
      );

      expect(result.status).toBe(BookingStatus.COMPLETED);
    });

    it('should MASK Start OTP and End OTP from provider query', async () => {
      mockBookingsRepo.findById = vi.fn().mockResolvedValue({
        id: 'bk-1',
        customerId: 'cust-1',
        providerId: 'prov-1',
        status: BookingStatus.ASSIGNED,
        startOtp: '7823',
        endOtp: '4190',
      });

      const providerView = await bookingsService.getBookingDetails(
        'bk-1',
        'usr-prov-1',
        Role.PROVIDER,
        'prov-1'
      );

      expect(providerView.startOtp).toBeUndefined();
      expect(providerView.endOtp).toBeUndefined();
    });

    it('should REVEAL Start OTP to customer', async () => {
      mockBookingsRepo.findById = vi.fn().mockResolvedValue({
        id: 'bk-1',
        customerId: 'cust-1',
        providerId: 'prov-1',
        status: BookingStatus.ASSIGNED,
        startOtp: '7823',
        endOtp: '4190',
      });

      const customerView = await bookingsService.getBookingDetails(
        'bk-1',
        'cust-1',
        Role.CUSTOMER
      );

      expect(customerView.startOtp).toBe('7823');
    });
  });

  describe('Illegal Transitions & Terminal States', () => {
    it('should reject illegal jump from REQUESTED directly to COMPLETED', async () => {
      mockBookingsRepo.findById = vi.fn().mockResolvedValue({
        id: 'bk-1',
        customerId: 'cust-1',
        status: BookingStatus.REQUESTED,
      });

      await expect(
        bookingsService.transitionBooking(
          'bk-1',
          'cust-1',
          Role.CUSTOMER,
          { action: 'COMPLETE_WORK', otp: '1234' } as any
        )
      ).rejects.toThrow();
    });

    it('should reject transitions out of COMPLETED terminal state', async () => {
      mockBookingsRepo.findById = vi.fn().mockResolvedValue({
        id: 'bk-1',
        customerId: 'cust-1',
        status: BookingStatus.COMPLETED,
      });

      await expect(
        bookingsService.transitionBooking(
          'bk-1',
          'cust-1',
          Role.CUSTOMER,
          { action: 'CANCEL', cancellationReason: 'Changed mind' }
        )
      ).rejects.toThrow(BadRequestError);
    });
  });
});
