import { prisma } from '@/database/prisma';
import { BookingStatus, Prisma } from '@prisma/client';
import { BookingTransitionParams, BookingFilterParams } from './booking.types';

export class BookingsRepository {
  async createBooking(data: {
    bookingNumber: string;
    customerId: string;
    serviceId: string;
    addressLine: string;
    city: string;
    latitude: number;
    longitude: number;
    subtotal: Prisma.Decimal;
    totalAmount: Prisma.Decimal;
    startOtp: string;
    endOtp: string;
    scheduledAt?: Date;
  }) {
    return prisma.$transaction(async (tx) => {
      const booking = await tx.booking.create({
        data: {
          bookingNumber: data.bookingNumber,
          customerId: data.customerId,
          serviceId: data.serviceId,
          addressLine: data.addressLine,
          city: data.city,
          latitude: data.latitude,
          longitude: data.longitude,
          subtotal: data.subtotal,
          totalAmount: data.totalAmount,
          startOtp: data.startOtp,
          endOtp: data.endOtp,
          scheduledAt: data.scheduledAt,
          status: BookingStatus.REQUESTED, // Direct request upon creation
        },
        include: {
          service: true,
        },
      });

      // Write immutable initial event to ledger
      await tx.bookingEvent.create({
        data: {
          bookingId: booking.id,
          fromStatus: null,
          toStatus: BookingStatus.REQUESTED,
          actorId: data.customerId,
          actorRole: 'CUSTOMER',
          note: 'Booking requested by customer',
        },
      });

      return booking;
    });
  }

  async findById(id: string) {
    return prisma.booking.findUnique({
      where: { id },
      include: {
        service: true,
        customer: {
          select: {
            id: true,
            fullName: true,
            phone: true,
          },
        },
        provider: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                phone: true,
              },
            },
          },
        },
        events: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });
  }

  async findBookings(params: BookingFilterParams) {
    const page = params.page || 1;
    const limit = params.limit || 10;
    const skip = (page - 1) * limit;

    const where: Prisma.BookingWhereInput = {};
    if (params.customerId) where.customerId = params.customerId;
    if (params.providerId) where.providerId = params.providerId;
    if (params.status) where.status = params.status;

    const [items, total] = await Promise.all([
      prisma.booking.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          service: {
            select: { id: true, name: true, slug: true, basePrice: true },
          },
          provider: {
            include: {
              user: {
                select: { id: true, fullName: true, phone: true },
              },
            },
          },
        },
      }),
      prisma.booking.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async transitionBookingStatus(params: BookingTransitionParams) {
    return prisma.$transaction(async (tx) => {
      const current = await tx.booking.findUnique({
        where: { id: params.bookingId },
      });

      if (!current) {
        throw new Error('Booking not found');
      }

      const updateData: Prisma.BookingUpdateInput = {
        status: params.toStatus,
      };

      if (params.toStatus === BookingStatus.IN_PROGRESS && !current.startedAt) {
        updateData.startedAt = new Date();
      }

      if (params.toStatus === BookingStatus.COMPLETED && !current.completedAt) {
        updateData.completedAt = new Date();
      }

      if (params.toStatus === BookingStatus.CANCELLED) {
        updateData.cancelledAt = new Date();
        updateData.cancellationReason = params.cancellationReason || params.note;
      }

      const updated = await tx.booking.update({
        where: { id: params.bookingId },
        data: updateData,
      });

      // Write immutable state transition to ledger
      await tx.bookingEvent.create({
        data: {
          bookingId: params.bookingId,
          fromStatus: current.status,
          toStatus: params.toStatus,
          actorId: params.actorId,
          actorRole: params.actorRole,
          note: params.note,
          metadata: params.metadata as Prisma.InputJsonValue | undefined,
        },
      });

      return updated;
    });
  }

  async findBookingEvents(bookingId: string) {
    return prisma.bookingEvent.findMany({
      where: { bookingId },
      orderBy: { createdAt: 'asc' },
    });
  }
}
