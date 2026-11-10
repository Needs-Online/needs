import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware } from '@/middleware';

describe('Security & CORS Middleware (Unit)', () => {
  it('should respond to OPTIONS preflight with status 204 and CORS headers', () => {
    const req = new NextRequest('http://localhost:3000/api/v1/bookings', {
      method: 'OPTIONS',
      headers: {
        origin: 'http://localhost:3000',
        'access-control-request-method': 'POST',
      },
    });

    const res = middleware(req);

    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:3000');
    expect(res.headers.get('Access-Control-Allow-Methods')).toContain('POST');
    expect(res.headers.get('X-Frame-Options')).toBe('DENY');
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
  });

  it('should inject x-request-id and security headers on regular API requests', () => {
    const req = new NextRequest('http://localhost:3000/api/v1/catalog/services', {
      method: 'GET',
      headers: {
        origin: 'https://needs.com.bd',
      },
    });

    const res = middleware(req);

    expect(res.headers.get('x-request-id')).toBeDefined();
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://needs.com.bd');
    expect(res.headers.get('Strict-Transport-Security')).toContain('max-age=63072000');
    expect(res.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
  });

  it('should preserve provided x-request-id if passed in request header', () => {
    const req = new NextRequest('http://localhost:3000/api/v1/health/liveness', {
      method: 'GET',
      headers: {
        'x-request-id': 'custom-req-id-12345',
      },
    });

    const res = middleware(req);
    expect(res.headers.get('x-request-id')).toBe('custom-req-id-12345');
  });
});
