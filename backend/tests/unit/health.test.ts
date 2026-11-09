import { describe, it, expect } from 'vitest';
import { GET as livenessHandler } from '@/app/api/v1/health/liveness/route';

describe('Health Endpoints Foundation', () => {
  it('should return UP and timestamp on liveness check', async () => {
    const response = await livenessHandler();
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.status).toBe('UP');
    expect(body.data.uptime).toBeTypeOf('number');
    expect(new Date(body.data.timestamp).getTime()).not.toBeNaN();
  });
});
