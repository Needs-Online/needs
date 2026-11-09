import { DispatchRepository } from './dispatch.repository';
import { RankedProviderCandidate } from './dispatch.types';
import {
  withDistributedLock,
  publishEvent,
  REDIS_KEYS,
} from '@/infra/redis/redis.client';
import { getQueue, QUEUE_NAMES } from '@/infra/queue/queue.manager';
import { AssignmentStatus, BookingStatus } from '@/common/enums';
import { NotFoundError, ConflictError, BadRequestError } from '@/common/errors/app-error';
import { logger } from '@/common/utils/logger';

export class DispatchService {
  constructor(private readonly dispatchRepo: DispatchRepository = new DispatchRepository()) {}

  async dispatchBooking(bookingId: string) {
    return withDistributedLock(`booking:dispatch:${bookingId}`, 15000, async () => {
      const booking = await this.dispatchRepo.findBookingForDispatch(bookingId);
      if (!booking) {
        throw new NotFoundError('Booking not found');
      }

      if (
        booking.status !== BookingStatus.REQUESTED &&
        booking.status !== BookingStatus.MATCHING
      ) {
        logger.info(
          { bookingId, status: booking.status },
          'Booking is no longer eligible for dispatch'
        );
        return null;
      }

      // Check if there is already an active PENDING assignment
      const pendingAssignment = booking.assignments.find(
        (a) => a.status === AssignmentStatus.PENDING
      );
      if (pendingAssignment) {
        logger.info(
          { bookingId, assignmentId: pendingAssignment.id },
          'Booking already has an active pending assignment'
        );
        return pendingAssignment;
      }

      // Exclude already contacted providers
      const excludeProviderIds = booking.assignments.map((a) => a.providerId);

      // 1. Initial 3km radius candidate discovery
      let maxRadius = 3000;
      let candidates = await this.dispatchRepo.findCandidateProviders(
        booking.service.categoryId,
        booking.longitude,
        booking.latitude,
        maxRadius,
        excludeProviderIds
      );

      // 2. Expand radius to 10km if fewer than 2 candidates found
      if (candidates.length < 2) {
        maxRadius = 10000;
        candidates = await this.dispatchRepo.findCandidateProviders(
          booking.service.categoryId,
          booking.longitude,
          booking.latitude,
          maxRadius,
          excludeProviderIds
        );
      }

      if (candidates.length === 0) {
        logger.info({ bookingId }, 'No eligible candidates found within radius');
        return null;
      }

      // 3. Multi-factor provider ranking
      const ranked: RankedProviderCandidate[] = candidates.map((c) => {
        const ratingNorm = (Number(c.rating) || 5.0) / 5.0;
        const distanceNorm = Math.max(0, 1 - c.distanceMeters / maxRadius);
        const experienceNorm = Math.min(c.completedJobs, 100) / 100.0;

        // Weight distribution: 40% rating, 40% proximity, 20% experience
        const score = ratingNorm * 0.4 + distanceNorm * 0.4 + experienceNorm * 0.2;

        return {
          providerId: c.id,
          userId: c.userId,
          fullName: c.fullName,
          phone: c.phone,
          rating: Number(c.rating),
          completedJobs: c.completedJobs,
          distanceMeters: Math.round(c.distanceMeters),
          score: Math.round(score * 1000) / 1000,
        };
      });

      // Sort descending by calculated score
      ranked.sort((a, b) => b.score - a.score);
      const topCandidate = ranked[0];

      // 4. Create pending assignment in database
      const assignment = await this.dispatchRepo.createAssignment(
        bookingId,
        topCandidate.providerId,
        topCandidate.distanceMeters
      );

      // 5. Schedule 45-second acceptance timer in BullMQ delayed queue
      try {
        const queue = getQueue(QUEUE_NAMES.DISPATCH);
        await queue.add(
          'dispatch-timeout',
          {
            bookingId,
            assignmentId: assignment.id,
            providerId: topCandidate.providerId,
          },
          {
            delay: 45000,
            jobId: `dispatch-timeout:${assignment.id}`,
            removeOnComplete: true,
          }
        );
      } catch (err) {
        logger.error({ err, assignmentId: assignment.id }, 'Failed to schedule dispatch timeout');
      }

      // 6. Notify candidate provider via Redis Pub/Sub
      await publishEvent(
        REDIS_KEYS.channel(`provider:dispatch:${topCandidate.providerId}`),
        {
          type: 'NEW_JOB_OFFER',
          bookingId,
          assignmentId: assignment.id,
          serviceName: booking.service.name,
          addressLine: booking.addressLine,
          city: booking.city,
          distanceMeters: topCandidate.distanceMeters,
          expiresInSeconds: 45,
          timestamp: new Date().toISOString(),
        }
      );

      return assignment;
    });
  }

  async acceptAssignment(bookingId: string, providerId: string) {
    return withDistributedLock(`booking:assign:${bookingId}`, 10000, async () => {
      const pending = await this.dispatchRepo.findPendingAssignmentForProvider(
        bookingId,
        providerId
      );

      if (!pending) {
        throw new NotFoundError('No pending assignment found for this provider on this booking');
      }

      // Atomically accept assignment and update booking in PostgreSQL
      const result = await this.dispatchRepo.acceptAssignment(
        pending.id,
        bookingId,
        providerId
      );

      // Cancel the 45-second BullMQ timeout job
      try {
        const queue = getQueue(QUEUE_NAMES.DISPATCH);
        const job = await queue.getJob(`dispatch-timeout:${pending.id}`);
        if (job) {
          await job.remove();
        }
      } catch (err) {
        logger.warn({ err, assignmentId: pending.id }, 'Could not remove timeout job after accept');
      }

      // Publish booking assigned event
      await publishEvent(REDIS_KEYS.channel(`booking:${bookingId}`), {
        type: 'BOOKING_ASSIGNED',
        bookingId,
        providerId,
        assignmentId: pending.id,
        timestamp: new Date().toISOString(),
      });

      return result;
    });
  }

  async rejectAssignment(bookingId: string, providerId: string, reason?: string) {
    return withDistributedLock(`booking:assign:${bookingId}`, 10000, async () => {
      const pending = await this.dispatchRepo.findPendingAssignmentForProvider(
        bookingId,
        providerId
      );

      if (!pending) {
        throw new NotFoundError('No pending assignment found for this provider to reject');
      }

      await this.dispatchRepo.updateAssignmentStatus(
        pending.id,
        AssignmentStatus.REJECTED as any
      );

      // Cancel the 45-second BullMQ timeout job
      try {
        const queue = getQueue(QUEUE_NAMES.DISPATCH);
        const job = await queue.getJob(`dispatch-timeout:${pending.id}`);
        if (job) {
          await job.remove();
        }
      } catch {
        // ignore
      }

      logger.info(
        { bookingId, providerId, assignmentId: pending.id, reason },
        'Provider rejected assignment, triggering auto-redispatch'
      );

      // Automatically redispatch to the next candidate
      this.dispatchBooking(bookingId).catch((err) => {
        logger.error({ err, bookingId }, 'Error auto-redispatching after reject');
      });

      return { success: true, message: 'Assignment rejected' };
    });
  }

  async handleAssignmentTimeout(bookingId: string, assignmentId: string) {
    return withDistributedLock(`booking:assign:${bookingId}`, 10000, async () => {
      const assignment = await this.dispatchRepo.findAssignmentById(assignmentId);
      if (!assignment || assignment.status !== AssignmentStatus.PENDING) {
        return; // Already resolved
      }

      await this.dispatchRepo.updateAssignmentStatus(
        assignmentId,
        AssignmentStatus.TIMEOUT as any
      );

      logger.warn(
        { bookingId, assignmentId, providerId: assignment.providerId },
        'Assignment timed out after 45s, auto-redispatching to candidate #2'
      );

      // Automatically redispatch to next candidate
      await this.dispatchBooking(bookingId);
    });
  }
}
