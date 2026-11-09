import { NextResponse } from 'next/server';
import { successResponse, errorResponse } from '@/common/dto/response.dto';
import { prisma } from '@/database/prisma';
import { getRedisClient } from '@/infra/redis/redis.client';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const checks: Record<string, { status: string; latencyMs?: number; error?: string }> = {};
  let isReady = true;

  // 1. PostgreSQL check
  const pgStart = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = {
      status: 'UP',
      latencyMs: Date.now() - pgStart,
    };
  } catch (err) {
    isReady = false;
    checks.database = {
      status: 'DOWN',
      error: err instanceof Error ? err.message : 'Unknown database error',
    };
  }

  // 2. Redis check
  const redisStart = Date.now();
  try {
    const redis = getRedisClient();
    const pong = await redis.ping();
    if (pong === 'PONG') {
      checks.redis = {
        status: 'UP',
        latencyMs: Date.now() - redisStart,
      };
    } else {
      throw new Error(`Unexpected Redis response: ${pong}`);
    }
  } catch (err) {
    isReady = false;
    checks.redis = {
      status: 'DOWN',
      error: err instanceof Error ? err.message : 'Unknown Redis error',
    };
  }

  // 3. BullMQ Queues / Worker readiness check
  const queueStart = Date.now();
  try {
    const { getQueue, QUEUE_NAMES } = await import('@/infra/queue/queue.manager');
    const queue = getQueue(QUEUE_NAMES.CLEANUP);
    await queue.isPaused();
    checks.queues = {
      status: 'UP',
      latencyMs: Date.now() - queueStart,
    };
  } catch (err) {
    // Non-fatal if worker process is separate, but reports status
    checks.queues = {
      status: 'DEGRADED',
      error: err instanceof Error ? err.message : 'BullMQ connection issue',
    };
  }

  const payload = {
    status: isReady ? 'UP' : 'DOWN',
    timestamp: new Date().toISOString(),
    checks,
  };

  if (!isReady) {
    return NextResponse.json(
      errorResponse('One or more downstream services are unhealthy', 'SERVICE_UNAVAILABLE', payload),
      { status: 503 }
    );
  }

  return NextResponse.json(successResponse(payload, 'Readiness probe healthy'));
}
