import { PrismaClient } from '@prisma/client';
import { logger } from '@/common/utils/logger';

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

export const prisma =
  global.prisma ||
  new PrismaClient({
    log: [
      { emit: 'event', level: 'query' },
      { emit: 'event', level: 'error' },
      { emit: 'event', level: 'info' },
      { emit: 'event', level: 'warn' },
    ],
  });

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}

// Log queries in debug mode
// @ts-expect-error Prisma event types
prisma.$on('query', (e: { query: string; params: string; duration: number }) => {
  if (process.env.LOG_LEVEL === 'debug') {
    logger.debug({ query: e.query, duration: `${e.duration}ms` }, 'Prisma Query');
  }
});

// @ts-expect-error Prisma event types
prisma.$on('error', (e: { message: string }) => {
  logger.error({ error: e.message }, 'Prisma Database Error');
});
