import { describe, it, expect } from 'vitest';
import { REDIS_KEYS } from '@/infra/redis/redis.client';

describe('Distributed Lock Keys and Semantics', () => {
  it('should format lock resource keys under lock namespace', () => {
    const lockKey = REDIS_KEYS.lock('dispatch:booking:bkg-999');
    expect(lockKey).toBe('lock:dispatch:booking:bkg-999');
  });

  it('should separate locks for different booking resources', () => {
    const lock1 = REDIS_KEYS.lock('booking:assign:1');
    const lock2 = REDIS_KEYS.lock('booking:assign:2');
    expect(lock1).not.toBe(lock2);
  });
});
