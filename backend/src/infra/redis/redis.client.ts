import Redis, { RedisOptions } from 'ioredis';
import { env } from '@/config/env';
import { logger } from '@/common/utils/logger';
import { v4 as uuidv4 } from 'uuid';

const redisOptions: RedisOptions = {
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
  retryStrategy(times) {
    const delay = Math.min(times * 100, 3000);
    logger.warn(`Redis connection retry attempt #${times} in ${delay}ms`);
    return delay;
  },
};

let redisInstance: Redis | null = null;
let pubSubClient: Redis | null = null;

export const REDIS_KEYS = {
  geo: (city: string, categoryId: string) =>
    `geo:${city.toLowerCase().trim().replace(/\s+/g, '_')}:${categoryId}`,
  providerLoc: (providerId: string) => `provider:loc:${providerId}`,
  lock: (resource: string) => `lock:${resource}`,
  otpData: (phone: string) => `otp:data:${phone}`,
  otpResend: (phone: string) => `otp:resend:${phone}`,
  rateLimit: (prefix: string, ip: string) => `rl:${prefix}:${ip}`,
  channel: (name: string) => `channel:${name}`,
} as const;

export function getRedisClient(): Redis {
  if (!redisInstance) {
    redisInstance = new Redis(env.REDIS_URL, redisOptions);

    redisInstance.on('connect', () => {
      logger.info('Redis client connected');
    });

    redisInstance.on('ready', () => {
      logger.info('Redis client ready');
    });

    redisInstance.on('error', (err) => {
      logger.error({ err }, 'Redis client encountered error');
    });

    redisInstance.on('close', () => {
      logger.warn('Redis connection closed');
    });
  }

  return redisInstance;
}

export function createRedisClient(): Redis {
  return new Redis(env.REDIS_URL, redisOptions);
}

export async function closeRedisConnections(): Promise<void> {
  if (redisInstance) {
    await redisInstance.quit();
    redisInstance = null;
    logger.info('Redis primary connection closed gracefully');
  }
  if (pubSubClient) {
    await pubSubClient.quit();
    pubSubClient = null;
    logger.info('Redis pub/sub connection closed gracefully');
  }
}

// ==============================================================================
// REDIS PUB/SUB HELPERS
// ==============================================================================

export async function publishEvent(channel: string, message: unknown): Promise<number> {
  const redis = getRedisClient();
  const serialized = typeof message === 'string' ? message : JSON.stringify(message);
  return redis.publish(channel, serialized);
}

export async function subscribeToChannel(
  channel: string,
  onMessage: (message: string) => void
): Promise<() => Promise<void>> {
  if (!pubSubClient) {
    pubSubClient = createRedisClient();
  }

  await pubSubClient.subscribe(channel);
  const handler = (ch: string, msg: string) => {
    if (ch === channel) {
      onMessage(msg);
    }
  };

  pubSubClient.on('message', handler);

  return async () => {
    if (pubSubClient) {
      pubSubClient.off('message', handler);
      await pubSubClient.unsubscribe(channel);
    }
  };
}

// ==============================================================================
// REDIS GEO HELPERS
// ==============================================================================

export function getGeoKey(city: string, categoryId: string): string {
  return REDIS_KEYS.geo(city, categoryId);
}

export async function geoAddProvider(
  city: string,
  categoryId: string,
  providerId: string,
  longitude: number,
  latitude: number,
  ttlSeconds = 900 // 15 min freshness
): Promise<void> {
  const redis = getRedisClient();
  const key = getGeoKey(city, categoryId);

  // Add coordinates to geospatial sorted set
  await redis.geoadd(key, longitude, latitude, providerId);
  // Also store coordinate snapshot with TTL for metadata and stale check
  const providerKey = REDIS_KEYS.providerLoc(providerId);
  await redis.set(
    providerKey,
    JSON.stringify({ longitude, latitude, city, categoryId, updatedAt: new Date().toISOString() }),
    'EX',
    ttlSeconds
  );
}

export interface NearbyProviderResult {
  providerId: string;
  distanceMeters: number;
  longitude: number;
  latitude: number;
}

export async function geoSearchNearbyProviders(
  city: string,
  categoryId: string,
  longitude: number,
  latitude: number,
  radiusMeters: number,
  limit = 20
): Promise<NearbyProviderResult[]> {
  const redis = getRedisClient();
  const key = getGeoKey(city, categoryId);

  try {
    const rawResults = (await redis.call(
      'GEOSEARCH',
      key,
      'FROMLONLAT',
      longitude,
      latitude,
      'BYRADIUS',
      radiusMeters,
      'm',
      'WITHCOORD',
      'WITHDIST',
      'COUNT',
      limit,
      'ASC'
    )) as Array<[string, string, [string, string]]>;

    if (!Array.isArray(rawResults)) {
      return [];
    }

    return rawResults.map(([providerId, distStr, [lonStr, latStr]]) => ({
      providerId,
      distanceMeters: parseFloat(distStr),
      longitude: parseFloat(lonStr),
      latitude: parseFloat(latStr),
    }));
  } catch (error) {
    logger.error({ error, city, categoryId }, 'Failed to execute GEOSEARCH on Redis');
    return [];
  }
}

export async function removeProviderLocation(
  city: string,
  categoryId: string,
  providerId: string
): Promise<void> {
  const redis = getRedisClient();
  const key = getGeoKey(city, categoryId);
  await redis.zrem(key, providerId);
  await redis.del(REDIS_KEYS.providerLoc(providerId));
}

// ==============================================================================
// REDIS DISTRIBUTED LOCK (Redlock pattern single-node atomic)
// ==============================================================================

const RELEASE_LOCK_SCRIPT = `
  if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("del", KEYS[1])
  else
    return 0
  end
`;

export async function acquireLock(resource: string, ttlMs = 10000): Promise<string | null> {
  const redis = getRedisClient();
  const lockKey = REDIS_KEYS.lock(resource);
  const lockToken = uuidv4();

  const result = await redis.set(lockKey, lockToken, 'PX', ttlMs, 'NX');
  if (result === 'OK') {
    return lockToken;
  }
  return null;
}

export async function releaseLock(resource: string, lockToken: string): Promise<boolean> {
  const redis = getRedisClient();
  const lockKey = REDIS_KEYS.lock(resource);

  try {
    const result = await redis.eval(RELEASE_LOCK_SCRIPT, 1, lockKey, lockToken);
    return result === 1;
  } catch (error) {
    logger.error({ error, resource }, 'Error releasing distributed lock');
    return false;
  }
}

export async function withDistributedLock<T>(
  resource: string,
  ttlMs: number,
  fn: () => Promise<T>,
  retryAttempts = 3,
  retryDelayMs = 200
): Promise<T> {
  let token: string | null = null;
  let attempt = 0;

  while (attempt < retryAttempts) {
    token = await acquireLock(resource, ttlMs);
    if (token) break;
    attempt++;
    if (attempt < retryAttempts) {
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs * (attempt + 1)));
    }
  }

  if (!token) {
    throw new Error(`Failed to acquire distributed lock for resource: ${resource}`);
  }

  try {
    return await fn();
  } finally {
    await releaseLock(resource, token);
  }
}
