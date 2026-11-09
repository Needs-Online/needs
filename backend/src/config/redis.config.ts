import { env } from './env';

export interface RedisConfig {
  url: string;
  keyPrefix: string;
  defaultTtlSeconds: number;
}

export const redisConfig: RedisConfig = {
  url: env.REDIS_URL,
  keyPrefix: 'needs:',
  defaultTtlSeconds: 3600,
};
