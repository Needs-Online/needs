import { prisma } from '@/database/prisma';
import { Prisma } from '@prisma/client';
import { logger } from '@/common/utils/logger';

export interface CachedResponse {
  statusCode: number;
  body: unknown;
}

export class IdempotencyService {
  /**
   * Retrieves an unexpired idempotency record if it exists.
   */
  async get(key: string): Promise<CachedResponse | null> {
    try {
      const record = await prisma.idempotencyKey.findUnique({
        where: { key },
      });

      if (!record) {
        return null;
      }

      if (record.expiresAt < new Date()) {
        // Expired record, clean it up
        await prisma.idempotencyKey.delete({ where: { key } }).catch(() => {});
        return null;
      }

      return {
        statusCode: record.responseStatus,
        body: record.responseBody,
      };
    } catch (error) {
      logger.error({ error, key }, 'Failed to lookup idempotency key');
      return null;
    }
  }

  /**
   * Saves an idempotency record with a specified TTL (default: 24 hours).
   */
  async save(
    key: string,
    resource: string,
    statusCode: number,
    body: unknown,
    ttlSeconds: number = 86400
  ): Promise<void> {
    try {
      const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

      await prisma.idempotencyKey.upsert({
        where: { key },
        create: {
          key,
          resource,
          responseStatus: statusCode,
          responseBody: body as Prisma.InputJsonValue,
          expiresAt,
        },
        update: {
          responseStatus: statusCode,
          responseBody: body as Prisma.InputJsonValue,
          expiresAt,
        },
      });
    } catch (error) {
      logger.error({ error, key, resource }, 'Failed to save idempotency record');
    }
  }
}

export const idempotencyService = new IdempotencyService();
