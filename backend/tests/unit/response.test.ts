import { describe, it, expect } from 'vitest';
import { successResponse, errorResponse } from '@/common/dto/response.dto';

describe('Standard API Response Envelope', () => {
  it('should format successResponse correctly', () => {
    const data = { id: 'booking-1', status: 'CONFIRMED' };
    const res = successResponse(data, 'Booking retrieved');

    expect(res.success).toBe(true);
    expect(res.message).toBe('Booking retrieved');
    expect(res.data).toEqual(data);
    expect(res.meta).toBeNull();
  });

  it('should format errorResponse correctly', () => {
    const res = errorResponse('Payment failed', 'PAYMENT_FAILED', { reason: 'Insufficient funds' });

    expect(res.success).toBe(false);
    expect(res.data).toBeNull();
    expect(res.error?.code).toBe('PAYMENT_FAILED');
    expect(res.error?.details).toEqual({ reason: 'Insufficient funds' });
  });
});
