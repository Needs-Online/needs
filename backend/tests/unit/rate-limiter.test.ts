import { describe, it, expect } from 'vitest';
import { extractClientIp } from '@/common/middleware/rate-limiter';
import { NextRequest } from 'next/server';

describe('Rate Limiter IP Spoofing Defense', () => {
  it('should prioritize CF-Connecting-IP over X-Forwarded-For', () => {
    const req = new NextRequest('http://localhost:3000/api/v1/health/liveness', {
      headers: {
        'cf-connecting-ip': '203.0.113.195',
        'x-forwarded-for': '198.51.100.1, 10.0.0.1',
      },
    });

    const ip = extractClientIp(req);
    expect(ip).toBe('203.0.113.195');
  });

  it('should pick valid IP from X-Forwarded-For if CF header is absent', () => {
    const req = new NextRequest('http://localhost:3000/api/v1/health/liveness', {
      headers: {
        'x-forwarded-for': '198.51.100.22',
      },
    });

    const ip = extractClientIp(req);
    expect(ip).toBe('198.51.100.22');
  });

  it('should fallback to 127.0.0.1 on invalid or missing IP header', () => {
    const req = new NextRequest('http://localhost:3000/api/v1/health/liveness');
    const ip = extractClientIp(req);
    expect(ip).toBe('127.0.0.1');
  });
});
