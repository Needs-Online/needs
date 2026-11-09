import { describe, it, expect } from 'vitest';
import { QUEUE_NAMES } from '@/infra/queue/queue.manager';

describe('BullMQ Queue Infrastructure Foundation', () => {
  it('should define all 7 required foundational queues', () => {
    const queueList = Object.values(QUEUE_NAMES);
    expect(queueList).toContain('booking-expiry');
    expect(queueList).toContain('dispatch');
    expect(queueList).toContain('notifications');
    expect(queueList).toContain('payment-verification');
    expect(queueList).toContain('payouts');
    expect(queueList).toContain('analytics');
    expect(queueList).toContain('cleanup');
    expect(queueList.length).toBe(7);
  });
});
