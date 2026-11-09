import { BookingsRepository } from './bookings.repository';
import { CatalogRepository } from '@/modules/catalog/catalog.repository';
import { CreateBookingDto, TransitionBookingDto, ListBookingsQueryDto } from './dto/booking.dto';
import { BookingStateMachine } from './booking-state-machine';
import { BookingStatus, Role } from '@/common/enums';
import { NotFoundError, BadRequestError, ForbiddenError } from '@/common/errors/app-error';
import { getQueue, QUEUE_NAMES } from '@/infra/queue/queue.manager';
import { publishEvent, REDIS_KEYS } from '@/infra/redis/redis.client';
import { Prisma } from '@prisma/client';

export class BookingsService {
  constructor(
    private readonly bookingsRepo: BookingsRepository = new BookingsRepository(),
    private readonly catalogRepo: CatalogRepository = new CatalogRepository()
  ) {}

  async createBooking(customerId: string, dto: CreateBookingDto) {
    const service = await this.catalogRepo.findServiceById(dto.serviceId);
    if (!service || !service.isActive) {
      throw new BadRequestError('Requested service is not available');
    }

    const bookingNumber = BookingStateMachine.generateBookingNumber();
    const startOtp = BookingStateMachine.generateSecureOtp();
    const endOtp = BookingStateMachine.generateSecureOtp();

    const booking = await this.bookingsRepo.createBooking({
      bookingNumber,
      customerId,
      serviceId: dto.serviceId,
      addressLine: dto.addressLine,
      city: dto.city,
      latitude: dto.latitude,
      longitude: dto.longitude,
      subtotal: service.basePrice,
      totalAmount: service.basePrice, // Pre-coupon total
      startOtp,
      endOtp,
      scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : undefined,
    });

    // Enqueue 15-minute unassigned booking expiry job in BullMQ
    try {
      const queue = getQueue(QUEUE_NAMES.BOOKING_EXPIRY);
      await queue.add(
        'expire-unassigned',
        { bookingId: booking.id },
        { delay: 15 * 60 * 1000, jobId: `booking-expiry:${booking.id}` }
      );
    } catch {
      // Non-fatal if queue is unavailable during testing
    }

    return booking;
  }

  async getBookingDetails(bookingId: string, userId: string, userRole: Role, providerId?: string) {
    const booking = await this.bookingsRepo.findById(bookingId);
    if (!booking) {
      throw new NotFoundError('Booking not found');
    }

    // Authorization check
    const isCustomer = booking.customerId === userId;
    const isAssignedProvider = providerId && booking.providerId === providerId;
    const isAdmin = [Role.ADMIN, Role.SUPER_ADMIN, Role.OPERATIONS, Role.SUPPORT].includes(userRole);

    if (!isCustomer && !isAssignedProvider && !isAdmin) {
      throw new ForbiddenError('You are not authorized to view this booking');
    }

    // Mask OTPs for provider until arriving
    if (isAssignedProvider && !isAdmin) {
      return {
        ...booking,
        startOtp: undefined,
        endOtp: undefined,
      };
    }

    return booking;
  }

  async listBookings(
    userId: string,
    userRole: Role,
    query: ListBookingsQueryDto,
    providerId?: string
  ) {
    const isAdmin = [Role.ADMIN, Role.SUPER_ADMIN, Role.OPERATIONS, Role.SUPPORT].includes(userRole);

    let customerIdFilter: string | undefined;
    let providerIdFilter: string | undefined;

    if (!isAdmin) {
      if (userRole === Role.PROVIDER && providerId) {
        providerIdFilter = providerId;
      } else {
        customerIdFilter = userId;
      }
    }

    return this.bookingsRepo.findBookings({
      customerId: customerIdFilter,
      providerId: providerIdFilter,
      status: query.status,
      page: query.page,
      limit: query.limit,
    });
  }

  async transitionBooking(
    bookingId: string,
    userId: string,
    userRole: Role,
    dto: TransitionBookingDto,
    providerId?: string
  ) {
    const booking = await this.bookingsRepo.findById(bookingId);
    if (!booking) {
      throw new NotFoundError('Booking not found');
    }

    const currentStatus = booking.status as BookingStatus;
    let targetStatus: BookingStatus;

    // Map action to target status and verify actor permissions
    switch (dto.action) {
      case 'REQUEST':
        targetStatus = BookingStatus.MATCHING;
        if (booking.customerId !== userId) {
          throw new ForbiddenError('Only the customer can request provider matching');
        }
        break;

      case 'START_TRIP':
        targetStatus = BookingStatus.PROVIDER_EN_ROUTE;
        if (!providerId || booking.providerId !== providerId) {
          throw new ForbiddenError('Only the assigned provider can start trip');
        }
        break;

      case 'ARRIVE':
        targetStatus = BookingStatus.PROVIDER_ARRIVED;
        if (!providerId || booking.providerId !== providerId) {
          throw new ForbiddenError('Only the assigned provider can report arrival');
        }
        break;

      case 'START_WORK':
        targetStatus = BookingStatus.IN_PROGRESS;
        if (!providerId || booking.providerId !== providerId) {
          throw new ForbiddenError('Only the assigned provider can start work');
        }
        if (!dto.otp || dto.otp !== booking.startOtp) {
          throw new BadRequestError('Invalid start-job OTP provided');
        }
        break;

      case 'COMPLETE_WORK':
        targetStatus = BookingStatus.COMPLETED;
        if (!providerId || booking.providerId !== providerId) {
          throw new ForbiddenError('Only the assigned provider can complete work');
        }
        if (!dto.otp || dto.otp !== booking.endOtp) {
          throw new BadRequestError('Invalid end-job OTP provided');
        }
        break;

      case 'CANCEL':
        targetStatus = BookingStatus.CANCELLED;
        const isCustomer = booking.customerId === userId;
        const isAssigned = providerId && booking.providerId === providerId;
        const isAdmin = [Role.ADMIN, Role.SUPER_ADMIN, Role.OPERATIONS].includes(userRole);
        if (!isCustomer && !isAssigned && !isAdmin) {
          throw new ForbiddenError('Not authorized to cancel this booking');
        }
        break;

      default:
        throw new BadRequestError(`Unsupported action: ${dto.action}`);
    }

    // Validate state machine rules
    BookingStateMachine.validateTransition(currentStatus, targetStatus);

    // Execute atomic transition in database
    const updated = await this.bookingsRepo.transitionBookingStatus({
      bookingId,
      toStatus: targetStatus,
      actorId: userId,
      actorRole: userRole,
      note: dto.note,
      cancellationReason: dto.cancellationReason,
      metadata: { action: dto.action },
    });

    // Publish state transition event via Redis Pub/Sub
    await publishEvent(REDIS_KEYS.channel(`booking:${bookingId}`), {
      bookingId,
      fromStatus: currentStatus,
      toStatus: targetStatus,
      action: dto.action,
      actorId: userId,
      timestamp: new Date().toISOString(),
    });

    return updated;
  }

  async getBookingEvents(bookingId: string, userId: string, userRole: Role, providerId?: string) {
    await this.getBookingDetails(bookingId, userId, userRole, providerId);
    return this.bookingsRepo.findBookingEvents(bookingId);
  }
}
