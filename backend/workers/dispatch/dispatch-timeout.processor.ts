import { Job } from 'bullmq';
import { DispatchService } from '@/modules/dispatch/dispatch.service';
import { DispatchTimeoutJobPayload } from '@/modules/dispatch/dispatch.types';
import { logger } from '@/common/utils/logger';

const dispatchService = new DispatchService();

export async function processDispatchTimeout(job: Job<DispatchTimeoutJobPayload>) {
  const { bookingId, assignmentId, providerId } = job.data;
  logger.info({ jobId: job.id, bookingId, assignmentId, providerId }, 'Processing dispatch timeout job');

  try {
    await dispatchService.handleAssignmentTimeout(bookingId, assignmentId);
    return { success: true, bookingId, assignmentId };
  } catch (error) {
    logger.error({ error, bookingId, assignmentId }, 'Failed to process dispatch timeout');
    throw error;
  }
}
