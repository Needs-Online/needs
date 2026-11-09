import {
  initializeAllQueues,
  closeAllQueuesAndWorkers,
  createWorker,
  QUEUE_NAMES,
} from '@/infra/queue/queue.manager';
import { logger } from '@/common/utils/logger';
import { getRedisClient } from '@/infra/redis/redis.client';
import { prisma } from '@/database/prisma';
import { processDispatchTimeout } from './dispatch/dispatch-timeout.processor';
import { processBookingExpiry } from './booking/booking-expiry.processor';
import { processNotification } from './notifications/notifications.processor';
import { processPaymentVerification } from './payment/payment-verification.processor';

logger.info('🚀 Starting Needs BullMQ Worker Service (Phase 3, 4 & 5 Processors)...');

async function bootstrap() {
  try {
    // 1. Verify Redis
    const redis = getRedisClient();
    const redisPong = await redis.ping();
    logger.info({ redisPong }, 'Redis connected to worker process');

    // 2. Verify Database
    await prisma.$queryRaw`SELECT 1`;
    logger.info('Database connected to worker process');

    // 3. Initialize all 7 foundational BullMQ queues
    const queues = initializeAllQueues();
    logger.info(
      { queues: Object.keys(queues) },
      'All 7 foundational BullMQ queues ready for job processing'
    );

    // 4. Register Phase 3 background workers
    const dispatchWorker = createWorker(QUEUE_NAMES.DISPATCH, processDispatchTimeout, {
      concurrency: 5,
    });
    logger.info({ worker: 'dispatch' }, 'Dispatch timeout worker registered');

    const expiryWorker = createWorker(QUEUE_NAMES.BOOKING_EXPIRY, processBookingExpiry, {
      concurrency: 5,
    });
    logger.info({ worker: 'booking-expiry' }, 'Booking expiry worker registered');

    const notificationWorker = createWorker(QUEUE_NAMES.NOTIFICATIONS, processNotification, {
      concurrency: 10,
    });
    logger.info({ worker: 'notifications' }, 'Notification delivery worker registered');

    const paymentWorker = createWorker(
      QUEUE_NAMES.PAYMENT_VERIFICATION,
      processPaymentVerification,
      { concurrency: 5 }
    );
    logger.info({ worker: 'payment-verification' }, 'Payment verification worker registered');

    logger.info('✅ Needs BullMQ Worker process running with active processors');
  } catch (error) {
    logger.error({ error }, 'Failed to bootstrap BullMQ Worker service');
    process.exit(1);
  }
}

// Graceful shutdown handling
let isShuttingDown = false;
async function gracefulShutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  logger.info({ signal }, 'Graceful shutdown initiated for BullMQ Worker');

  try {
    await closeAllQueuesAndWorkers();
    await prisma.$disconnect();
    logger.info('BullMQ Worker process terminated cleanly');
    process.exit(0);
  } catch (error) {
    logger.error({ error }, 'Error during worker graceful shutdown');
    process.exit(1);
  }
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

bootstrap();
