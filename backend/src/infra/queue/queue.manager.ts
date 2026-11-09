import { Queue, Worker, QueueOptions, WorkerOptions, Processor } from 'bullmq';
import { env } from '@/config/env';
import { logger } from '@/common/utils/logger';
import Redis from 'ioredis';

export const QUEUE_NAMES = {
  BOOKING_EXPIRY: 'booking-expiry',
  DISPATCH: 'dispatch',
  NOTIFICATIONS: 'notifications',
  PAYMENT_VERIFICATION: 'payment-verification',
  PAYOUTS: 'payouts',
  ANALYTICS: 'analytics',
  CLEANUP: 'cleanup',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

export function createRedisConnection(): Redis {
  return new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    retryStrategy(times) {
      return Math.min(times * 100, 3000);
    },
  });
}

const defaultQueueOptions: QueueOptions = {
  connection: createRedisConnection(),
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: {
      count: 500,
    },
    removeOnFail: {
      count: 1000,
    },
  },
};

const activeQueues: Map<string, Queue> = new Map();
const activeWorkers: Set<Worker> = new Set();

export function getQueue<T = unknown>(name: QueueName): Queue<T> {
  if (!activeQueues.has(name)) {
    const queue = new Queue<T>(name, defaultQueueOptions);
    activeQueues.set(name, queue);
    logger.info({ queueName: name }, 'BullMQ Queue initialized');
  }
  return activeQueues.get(name) as Queue<T>;
}

export function initializeAllQueues(): Record<string, Queue> {
  const queues: Record<string, Queue> = {};
  for (const name of Object.values(QUEUE_NAMES)) {
    queues[name] = getQueue(name);
  }
  return queues;
}

export function createWorker<T = unknown, R = unknown>(
  name: QueueName,
  processor: Processor<T, R>,
  options?: Partial<WorkerOptions>
): Worker<T, R> {
  const workerConnection = createRedisConnection();

  const worker = new Worker<T, R>(name, processor, {
    connection: workerConnection,
    concurrency: 5,
    ...options,
  });

  worker.on('completed', (job) => {
    logger.info({ queueName: name, jobId: job.id }, 'Job completed successfully');
  });

  worker.on('failed', (job, err) => {
    logger.error({ queueName: name, jobId: job?.id, err }, 'Job failed execution');
  });

  worker.on('error', (err) => {
    logger.error({ queueName: name, err }, 'BullMQ Worker encountered error');
  });

  activeWorkers.add(worker as unknown as Worker);
  return worker;
}

export async function closeAllQueuesAndWorkers(): Promise<void> {
  logger.info('Shutting down BullMQ queues and workers...');

  for (const worker of activeWorkers) {
    try {
      await worker.close();
    } catch (err) {
      logger.error({ err }, 'Error closing worker');
    }
  }
  activeWorkers.clear();

  for (const [name, queue] of activeQueues.entries()) {
    try {
      await queue.close();
      logger.info({ queueName: name }, 'Queue closed');
    } catch (err) {
      logger.error({ queueName: name, err }, 'Error closing queue');
    }
  }
  activeQueues.clear();

  logger.info('BullMQ queues and workers shutdown complete');
}
