import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BookingsService } from '@/modules/bookings/bookings.service';
import { BookingsRepository } from '@/modules/bookings/bookings.repository';
import { CatalogRepository } from '@/modules/catalog/catalog.repository';
import { BookingStatus, Role, PricingType } from '@/common/enums';
import { BadRequestError, ForbiddenError, NotFoundError } from '@/common/errors/app-error';
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

describe('BookingsService (Unit)', () => {
  let bookingsService: BookingsService;
  let mockBookingsRepo: Partial<BookingsRepository>;
  let mockCatalogRepo: Partial<CatalogRepository>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockBookingsRepo = {
      createBooking: vi.fn(),
      findById: vi.fn(),
      findBookings: vi.fn(),
      transitionBookingStatus: vi.fn(),
      findBookingEvents: vi.fn(),
    };
    mockCatalogRepo = {
      findServiceById: vi.fn(),
    };

    bookingsService = new BookingsService(
      mockBookingsRepo as BookingsRepository,
      mockCatalogRepo as CatalogRepository
    );
  });

  it('should create booking for valid active service and customer', async () => {
    mockCatalogRepo.findServiceById = vi.fn().mockResolvedValue({
      id: 'srv-1',
      name: 'House Cleaning',
      basePrice: new Decimal('1200.00'),
      isActive: true,
      pricingType: PricingType.FIXED,
    });

    mockBookingsRepo.createBooking = vi.fn().mockImplementation(async (data) => ({
      id: 'bk-123',
      ...data,
      status: BookingStatus.REQUESTED,
      createdAt: new Date(),
    }));

    const result = await bookingsService.createBooking('cust-1', {
      serviceId: 'srv-1',
      addressLine: 'House 12, Road 4, Dhanmondi',
      city: 'Dhaka',
      latitude: 23.7465,
      longitude: 90.376,
    });

    expect(result.id).toBe('bk-123');
    expect(result.status).toBe(BookingStatus.REQUESTED);
    expect(result.subtotal).toEqual(new Decimal('1200.00'));
    expect(result.startOtp).toMatch(/^\d{4}$/);
    expect(mockBookingsRepo.createBooking).toHaveBeenCalled();
  });

  it('should throw BadRequestError if service is inactive or not found', async () => {
    mockCatalogRepo.findServiceById = vi.fn().mockResolvedValue(null);

    await expect(
      bookingsService.createBooking('cust-1', {
        serviceId: 'invalid-srv',
        addressLine: 'Road 1',
        city: 'Dhaka',
        latitude: 23.7,
        longitude: 90.3,
      })
    ).rejects.toThrow(BadRequestError);
  });

  it('should throw ForbiddenError if unauthorized user attempts to view booking', async () => {
    mockBookingsRepo.findById = vi.fn().mockResolvedValue({
      id: 'bk-123',
      customerId: 'cust-1',
      providerId: 'prov-1',
    });

    await expect(
      bookingsService.getBookingDetails('bk-123', 'unrelated-user', Role.CUSTOMER)
    ).rejects.toThrow(ForbiddenError);
  });

  it('should verify startOtp when provider starts work', async () => {
    mockBookingsRepo.findById = vi.fn().mockResolvedValue({
      id: 'bk-123',
      customerId: 'cust-1',
      providerId: 'prov-1',
      status: BookingStatus.PROVIDER_ARRIVED,
      startOtp: '4589',
      endOtp: '1234',
    });

    mockBookingsRepo.transitionBookingStatus = vi.fn().mockResolvedValue({
      id: 'bk-123',
      status: BookingStatus.IN_PROGRESS,
    });

    const result = await bookingsService.transitionBooking(
      'bk-123',
      'user-prov-1',
      Role.PROVIDER,
      {
        action: 'START_WORK',
        otp: '4589',
      },
      'prov-1'
    );

    expect(result.status).toBe(BookingStatus.IN_PROGRESS);
    expect(mockBookingsRepo.transitionBookingStatus).toHaveBeenCalled();
  });

  it('should reject start work if startOtp is incorrect', async () => {
    mockBookingsRepo.findById = vi.fn().mockResolvedValue({
      id: 'bk-123',
      customerId: 'cust-1',
      providerId: 'prov-1',
      status: BookingStatus.PROVIDER_ARRIVED,
      startOtp: '4589',
      endOtp: '1234',
    });

    await expect(
      bookingsService.transitionBooking(
        'bk-123',
        'user-prov-1',
        Role.PROVIDER,
        {
          action: 'START_WORK',
          otp: '9999', // wrong OTP
        },
        'prov-1'
      )
    ).rejects.toThrow(BadRequestError);
  });
});
