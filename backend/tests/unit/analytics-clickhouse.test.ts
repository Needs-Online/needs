import { describe, it, expect, vi } from 'vitest';
import { ClickHouseAdapter } from '@/modules/analytics/clickhouse.adapter';
import { logger } from '@/common/utils/logger';

vi.mock('@/common/utils/logger', () => ({
  logger: {
    info: vi.fn(),
  },
}));

describe('ClickHouseAdapter & PII Protection (BR-06) (Unit)', () => {
  const adapter = new ClickHouseAdapter();

  it('should redact sensitive PII before buffering event', async () => {
    const rawEvent = {
      eventName: 'BOOKING_PAID',
      eventType: 'TRANSACTION',
      userId: 'usr-123',
      metadata: {
        bookingId: 'bk-1234',
        amount: 1500,
        phone: '+8801711223344',
        nidNumber: '19901234567890123',
        accountNumber: '01711223344',
        secretToken: 'jwt-access-token-xyz',
      },
    };

    await adapter.trackEvent(rawEvent);

    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        event: expect.objectContaining({
          eventName: 'BOOKING_PAID',
          metadata: {
            bookingId: 'bk-1234',
            amount: 1500,
            phone: '[REDACTED]',
            nidNumber: '[REDACTED]',
            accountNumber: '[REDACTED]',
            secretToken: '[REDACTED]',
          },
        }),
      }),
      expect.any(String)
    );
  });
});
