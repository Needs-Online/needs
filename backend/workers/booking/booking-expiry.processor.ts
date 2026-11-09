import { Job } from 'bullmq';
import { prisma } from '@/database/prisma';
import { BookingStatus } from '@/common/enums';
import { logger } from '@/common/utils/logger';
import { publishEvent, REDIS_KEYS } from '@/infra/redis/redis.client';

export interface BookingExpiryJobPayload {
  bookingId: string;
}

export async function processBookingExpiry(job: Job<BookingExpiryJobPayload>) {
  const { bookingId } = job.data;
  logger.info({ jobId: job.id, bookingId }, 'Processing unassigned booking expiry');

  try {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
    });

    if (!booking) {
      logger.warn({ bookingId }, 'Booking not found for expiry check');
      return { skipped: true };
    }

    // Only expire if still unassigned in REQUESTED or MATCHING state
    if (
      booking.status === BookingStatus.REQUESTED ||
      booking.status === BookingStatus.MATCHING
    ) {
      await prisma.$transaction(async (tx) => {
        await tx.booking.update({
          where: { id: bookingId },
          data: {
            status: BookingStatus.EXPIRED,
            cancelledAt: new Date(),
            cancellationReason: 'No available provider accepted within timeout period',
          },
        });

        await tx.bookingEvent.create({
          data: {
            bookingId,
            fromStatus: booking.status,
            toStatus: BookingStatus.EXPIRED,
            actorId: 'SYSTEM',
            actorRole: 'SYSTEM',
            note: 'Booking auto-expired due to no provider acceptance',
          },
        });
      });

      // Publish expiry event to notify customer
      await publishEvent(REDIS_KEYS.channel(`booking:${bookingId}`), {
        type: 'BOOKING_EXPIRED',
        bookingId,
        timestamp: new Date().toISOString(),
      });

      logger.info({ bookingId }, 'Booking auto-expired successfully');
      return { expired: true, bookingId };
    }

    logger.info({ bookingId, status: booking.status }, 'Booking already assigned or resolved, skipping expiry');
    return { skipped: true, status: booking.status };
  } catch (error) {
    logger.error({ error, bookingId }, 'Error processing booking expiry');
    throw error;
  }
}
