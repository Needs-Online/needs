import { describe, it, expect } from 'vitest';
import { REDIS_KEYS } from '@/infra/redis/redis.client';

describe('Redis Key Naming Conventions', () => {
  it('should generate standardized geo keys', () => {
    const key = REDIS_KEYS.geo('Dhaka City', 'cat-123');
    expect(key).toBe('geo:dhaka_city:cat-123');
  });

  it('should generate standardized provider location keys', () => {
    const key = REDIS_KEYS.providerLoc('prov-456');
    expect(key).toBe('provider:loc:prov-456');
  });

  it('should generate standardized distributed lock keys', () => {
    const key = REDIS_KEYS.lock('booking:assign:bkg-789');
    expect(key).toBe('lock:booking:assign:bkg-789');
  });

  it('should generate standardized rate limit keys', () => {
    const key = REDIS_KEYS.rateLimit('otp_send', '192.168.1.1');
    expect(key).toBe('rl:otp_send:192.168.1.1');
  });
});
