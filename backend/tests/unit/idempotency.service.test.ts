import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IdempotencyService } from '@/common/services/idempotency.service';
import { prisma } from '@/database/prisma';

vi.mock('@/database/prisma', () => ({
  prisma: {
    idempotencyKey: {
      findUnique: vi.fn(),
      delete: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

describe('IdempotencyService (Unit)', () => {
  let service: IdempotencyService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new IdempotencyService();
  });

  it('should return cached response if key exists and unexpired', async () => {
    const futureDate = new Date(Date.now() + 60000);
    (prisma.idempotencyKey.findUnique as any).mockResolvedValue({
      key: 'idem-key-1',
      responseStatus: 200,
      responseBody: { success: true, paymentId: 'pmt-123' },
      expiresAt: futureDate,
    });

    const result = await service.get('idem-key-1');
    expect(result).not.toBeNull();
    expect(result?.statusCode).toBe(200);
    expect(result?.body).toEqual({ success: true, paymentId: 'pmt-123' });
    expect(prisma.idempotencyKey.delete).not.toHaveBeenCalled();
  });

  it('should return null and clean up if key is expired', async () => {
    const pastDate = new Date(Date.now() - 60000);
    (prisma.idempotencyKey.findUnique as any).mockResolvedValue({
      key: 'idem-expired',
      responseStatus: 200,
      responseBody: { success: true },
      expiresAt: pastDate,
    });
    (prisma.idempotencyKey.delete as any).mockResolvedValue({});

    const result = await service.get('idem-expired');
    expect(result).toBeNull();
    expect(prisma.idempotencyKey.delete).toHaveBeenCalledWith({
      where: { key: 'idem-expired' },
    });
  });

  it('should save response with expiration TTL', async () => {
    (prisma.idempotencyKey.upsert as any).mockResolvedValue({});

    await service.save('idem-new', 'payments:initiate', 201, { id: 'pmt-456' }, 3600);

    expect(prisma.idempotencyKey.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { key: 'idem-new' },
        create: expect.objectContaining({
          key: 'idem-new',
          resource: 'payments:initiate',
          responseStatus: 201,
        }),
      })
    );
  });
});
