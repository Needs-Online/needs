import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CouponsService } from '@/modules/coupons/coupons.service';
import { CouponsRepository } from '@/modules/coupons/coupons.repository';
import { DiscountType } from '@/common/enums';
import { Decimal } from '@prisma/client/runtime/library';
import { BadRequestError } from '@/common/errors/app-error';

describe('Coupons Engine & Redemption (Unit)', () => {
  let service: CouponsService;
  let mockRepo: Partial<CouponsRepository>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRepo = {
      findCouponByCode: vi.fn(),
      countUserRedemptions: vi.fn(),
      createCoupon: vi.fn(),
      findCoupons: vi.fn(),
      recordRedemption: vi.fn(),
    };
    service = new CouponsService(mockRepo as CouponsRepository);
  });

  it('should validate fixed discount capped by order amount', async () => {
    mockRepo.findCouponByCode = vi.fn().mockResolvedValue({
      id: 'cpn-fixed',
      code: 'FLAT300',
      isActive: true,
      validFrom: new Date(Date.now() - 10000),
      validUntil: new Date(Date.now() + 100000),
      usageCount: 0,
      usageLimit: 50,
      perUserLimit: 1,
      minOrderAmount: new Decimal(200),
      discountType: DiscountType.FIXED,
      discountValue: new Decimal(300),
    });
    mockRepo.countUserRedemptions = vi.fn().mockResolvedValue(0);

    const result = await service.validateCoupon('usr-1', {
      code: 'FLAT300',
      orderAmount: 250, // Less than discountValue 300
    });

    expect(result.discountAmount).toBe(250);
    expect(result.finalAmount).toBe(0);
  });

  it('should reject coupon when order amount is less than minOrderAmount', async () => {
    mockRepo.findCouponByCode = vi.fn().mockResolvedValue({
      id: 'cpn-min',
      code: 'BIGSAVER',
      isActive: true,
      validFrom: new Date(Date.now() - 10000),
      validUntil: new Date(Date.now() + 100000),
      usageCount: 0,
      usageLimit: 50,
      perUserLimit: 1,
      minOrderAmount: new Decimal(1000),
      discountType: DiscountType.PERCENTAGE,
      discountValue: new Decimal(10),
    });
    mockRepo.countUserRedemptions = vi.fn().mockResolvedValue(0);

    await expect(
      service.validateCoupon('usr-1', {
        code: 'BIGSAVER',
        orderAmount: 800,
      })
    ).rejects.toThrow(BadRequestError);
  });

  it('should record coupon redemption atomically', async () => {
    mockRepo.recordRedemption = vi.fn().mockResolvedValue({
      id: 'redemp-1',
      couponId: 'cpn-1',
      bookingId: 'bk-1',
      discountApplied: new Decimal(150),
    });

    const result = await service.redeemCoupon({
      couponId: 'cpn-1',
      userId: 'usr-1',
      bookingId: 'bk-1',
      discountApplied: 150,
    });

    expect(result.id).toBe('redemp-1');
    expect(mockRepo.recordRedemption).toHaveBeenCalledWith({
      couponId: 'cpn-1',
      userId: 'usr-1',
      bookingId: 'bk-1',
      discountApplied: new Decimal(150),
    });
  });

  it('should filter active-only coupons for regular users', async () => {
    mockRepo.findCoupons = vi.fn().mockResolvedValue({
      items: [{ id: 'cpn-1', code: 'PROMO1' }],
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
    });

    const result = await service.listCoupons({ page: 1, limit: 20 }, false);

    expect(result.items).toHaveLength(1);
    expect(mockRepo.findCoupons).toHaveBeenCalledWith({
      isActiveOnly: true,
      page: 1,
      limit: 20,
    });
  });
});
