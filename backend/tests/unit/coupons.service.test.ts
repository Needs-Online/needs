import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CouponsService } from '@/modules/coupons/coupons.service';
import { CouponsRepository } from '@/modules/coupons/coupons.repository';
import { DiscountType } from '@/common/enums';
import { Decimal } from '@prisma/client/runtime/library';
import { BadRequestError } from '@/common/errors/app-error';

describe('CouponsService (Unit)', () => {
  let couponsService: CouponsService;
  let mockRepo: Partial<CouponsRepository>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRepo = {
      findCouponByCode: vi.fn(),
      countUserRedemptions: vi.fn(),
      createCoupon: vi.fn(),
      recordRedemption: vi.fn(),
    };

    couponsService = new CouponsService(mockRepo as CouponsRepository);
  });

  it('should calculate percentage discount with maximum cap', async () => {
    mockRepo.findCouponByCode = vi.fn().mockResolvedValue({
      id: 'cpn-1',
      code: 'SUMMER20',
      isActive: true,
      validFrom: new Date(Date.now() - 10000),
      validUntil: new Date(Date.now() + 100000),
      usageCount: 5,
      usageLimit: 100,
      perUserLimit: 1,
      minOrderAmount: new Decimal(500),
      discountType: DiscountType.PERCENTAGE,
      discountValue: new Decimal(20), // 20%
      maxDiscount: new Decimal(150),  // cap 150
    });
    mockRepo.countUserRedemptions = vi.fn().mockResolvedValue(0);

    // 20% of 1000 = 200, but capped at 150
    const result = await couponsService.validateCoupon('usr-1', {
      code: 'SUMMER20',
      orderAmount: 1000,
    });

    expect(result.discountAmount).toBe(150);
    expect(result.finalAmount).toBe(850);
  });

  it('should reject expired coupon', async () => {
    mockRepo.findCouponByCode = vi.fn().mockResolvedValue({
      id: 'cpn-exp',
      code: 'EXPIRED10',
      isActive: true,
      validFrom: new Date(Date.now() - 200000),
      validUntil: new Date(Date.now() - 100000), // expired
    });

    await expect(
      couponsService.validateCoupon('usr-1', {
        code: 'EXPIRED10',
        orderAmount: 1000,
      })
    ).rejects.toThrow(BadRequestError);
  });

  it('should reject coupon if user already reached per-user redemption limit', async () => {
    mockRepo.findCouponByCode = vi.fn().mockResolvedValue({
      id: 'cpn-used',
      code: 'ONE_TIME',
      isActive: true,
      validFrom: new Date(Date.now() - 10000),
      validUntil: new Date(Date.now() + 100000),
      usageCount: 1,
      usageLimit: 100,
      perUserLimit: 1,
      minOrderAmount: new Decimal(100),
      discountType: DiscountType.FIXED,
      discountValue: new Decimal(50),
    });
    mockRepo.countUserRedemptions = vi.fn().mockResolvedValue(1); // Already redeemed once

    await expect(
      couponsService.validateCoupon('usr-1', {
        code: 'ONE_TIME',
        orderAmount: 500,
      })
    ).rejects.toThrow(BadRequestError);
  });
});
