import { prisma } from '@/database/prisma';
import { AssignmentStatus, BookingStatus, ProviderStatus } from '@prisma/client';

export class DispatchRepository {
  async findBookingForDispatch(bookingId: string) {
    return prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        service: true,
        assignments: true,
      },
    });
  }

  async findPendingAssignmentForProvider(bookingId: string, providerId: string) {
    return prisma.bookingAssignment.findFirst({
      where: {
        bookingId,
        providerId,
        status: AssignmentStatus.PENDING,
      },
    });
  }

  async findAssignmentById(assignmentId: string) {
    return prisma.bookingAssignment.findUnique({
      where: { id: assignmentId },
    });
  }

  async createAssignment(bookingId: string, providerId: string, distanceMeters: number) {
    return prisma.bookingAssignment.create({
      data: {
        bookingId,
        providerId,
        status: AssignmentStatus.PENDING,
        distanceMeters,
        dispatchedAt: new Date(),
      },
    });
  }

  async acceptAssignment(assignmentId: string, bookingId: string, providerId: string) {
    return prisma.$transaction(async (tx) => {
      const currentBooking = await tx.booking.findUnique({ where: { id: bookingId } });
      if (!currentBooking) throw new Error('Booking not found');

      // 1. Mark assignment accepted
      const assignment = await tx.bookingAssignment.update({
        where: { id: assignmentId },
        data: {
          status: AssignmentStatus.ACCEPTED,
          respondedAt: new Date(),
        },
      });

      // 2. Mark booking ASSIGNED
      const updatedBooking = await tx.booking.update({
        where: { id: bookingId },
        data: {
          status: BookingStatus.ASSIGNED,
          providerId,
        },
      });

      // 3. Toggle provider availability to false (busy on active job)
      await tx.provider.update({
        where: { id: providerId },
        data: { isAvailable: false },
      });

      // 4. Record immutable BookingEvent
      await tx.bookingEvent.create({
        data: {
          bookingId,
          fromStatus: currentBooking.status,
          toStatus: BookingStatus.ASSIGNED,
          actorId: providerId,
          actorRole: 'PROVIDER',
          note: 'Provider accepted job assignment',
        },
      });

      return { assignment, booking: updatedBooking };
    });
  }

  async updateAssignmentStatus(
    assignmentId: string,
    status: AssignmentStatus
  ) {
    return prisma.bookingAssignment.update({
      where: { id: assignmentId },
      data: {
        status,
        respondedAt: new Date(),
      },
    });
  }

  async findCandidateProviders(
    categoryId: string,
    longitude: number,
    latitude: number,
    radiusMeters: number,
    excludeProviderIds: string[]
  ) {
    // PostGIS spatial query for active approved available providers
    const candidates = await prisma.$queryRaw<
      Array<{
        id: string;
        userId: string;
        fullName: string | null;
        phone: string;
        rating: number;
        completedJobs: number;
        latitude: number;
        longitude: number;
        distanceMeters: number;
      }>
    >`
      SELECT 
        p.id,
        p."userId",
        u."fullName",
        u.phone,
        p.rating::float AS rating,
        p."completedJobs",
        p."currentLatitude" AS latitude,
        p."currentLongitude" AS longitude,
        ST_DistanceSphere(
          ST_SetSRID(ST_MakePoint(p."currentLongitude", p."currentLatitude"), 4326),
          ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)
        ) AS "distanceMeters"
      FROM providers p
      INNER JOIN users u ON u.id = p."userId"
      INNER JOIN provider_services ps ON ps."providerId" = p.id
      INNER JOIN services s ON s.id = ps."serviceId"
      WHERE 
        p.status = 'APPROVED'
        AND p."isAvailable" = true
        AND p."currentLatitude" IS NOT NULL
        AND p."currentLongitude" IS NOT NULL
        AND ps."isActive" = true
        AND s."categoryId" = ${categoryId}
        AND ST_DWithin(
          ST_SetSRID(ST_MakePoint(p."currentLongitude", p."currentLatitude"), 4326)::geography,
          ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography,
          ${radiusMeters}
        )
      ORDER BY "distanceMeters" ASC
      LIMIT 20;
    `;

    // Filter out previously contacted/rejected providers
    return candidates.filter((c) => !excludeProviderIds.includes(c.id));
  }
}
