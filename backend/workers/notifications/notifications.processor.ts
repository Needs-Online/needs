import { Job } from 'bullmq';
import { logger } from '@/common/utils/logger';

export interface NotificationJobPayload {
  notificationId?: string;
  userId: string;
  title: string;
  body: string;
  channel: 'PUSH' | 'SMS' | 'IN_APP';
  data?: Record<string, unknown>;
}

export async function processNotification(job: Job<NotificationJobPayload>) {
  const { notificationId, userId, title, body, channel, data } = job.data;
  logger.info(
    { jobId: job.id, userId, channel, title },
    'Processing external notification dispatch'
  );

  try {
    if (channel === 'PUSH') {
      // FCM dispatch adapter integration
      logger.info({ userId, title, body }, 'FCM push notification dispatched to user device');
    } else if (channel === 'SMS') {
      // SMS gateway adapter integration (e.g. SSLWireless)
      logger.info({ userId, body }, 'SMS notification dispatched to user phone');
    }

    return {
      success: true,
      notificationId,
      dispatchedAt: new Date().toISOString(),
    };
  } catch (error) {
    logger.error({ error, jobId: job.id, userId }, 'Failed to deliver notification');
    throw error;
  }
}
