import { describe, it, expect } from 'vitest';
import { env } from '@/config/env';

describe('Configuration & Environment Validation', () => {
  it('should load and validate default environment variables', () => {
    expect(env).toBeDefined();
    expect(env.PORT).toBe(3000);
    expect(env.SOCKET_PORT).toBe(4001);
    expect(env.DATABASE_URL).toContain('postgresql://');
    expect(env.REDIS_URL).toContain('redis://');
    expect(env.JWT_ACCESS_SECRET.length).toBeGreaterThanOrEqual(16);
    expect(env.OTP_EXPIRY_SECONDS).toBe(300);
  });
});
