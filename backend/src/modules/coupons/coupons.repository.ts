import { prisma } from '@/database/prisma';
import { DiscountType, Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

export class CouponsRepository {
  async findCouponByCode(code: string) {
    return prisma.coupon.findUnique({
      where: { code },
    });
  }

  async countUserRedemptions(couponId: string, userId: string): Promise<number> {
    return prisma.couponRedemption.count({
      where: {
        couponId,
        userId,
      },
    });
  }

  async createCoupon(data: {
    code: string;
    description?: string;
    discountType: DiscountType;
    discountValue: Decimal;
    maxDiscount?: Decimal;
    minOrderAmount: Decimal;
    usageLimit: number;
    perUserLimit: number;
    validFrom: Date;
    validUntil: Date;
  }) {
    return prisma.coupon.create({
      data: {
        code: data.code,
        description: data.description,
        discountType: data.discountType,
        discountValue: data.discountValue,
        maxDiscount: data.maxDiscount,
        minOrderAmount: data.minOrderAmount,
        usageLimit: data.usageLimit,
        perUserLimit: data.perUserLimit,
        validFrom: data.validFrom,
        validUntil: data.validUntil,
      },
    });
  }

  async recordRedemption(data: {
    couponId: string;
    userId: string;
    bookingId: string;
    discountApplied: Decimal;
  }) {
    return prisma.$transaction(async (tx) => {
      // 1. Increment coupon usage count
      await tx.coupon.update({
        where: { id: data.couponId },
        data: {
          usageCount: { increment: 1 },
        },
      });

      // 2. Record redemption
      return tx.couponRedemption.create({
        data: {
          couponId: data.couponId,
          userId: data.userId,
          bookingId: data.bookingId,
          discountApplied: data.discountApplied,
        },
      });
    });
  }
}
