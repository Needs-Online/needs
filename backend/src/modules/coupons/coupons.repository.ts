import { prisma } from '@/database/prisma';
import { DiscountType, Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { BadRequestError } from '@/common/errors/app-error';

export class CouponsRepository {
  async findCouponByCode(code: string) {
    return prisma.coupon.findUnique({
      where: { code: code.toUpperCase() },
    });
  }

  async findCouponById(id: string) {
    return prisma.coupon.findUnique({
      where: { id },
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
        code: data.code.toUpperCase(),
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

  async findCoupons(params: {
    isActiveOnly?: boolean;
    page?: number;
    limit?: number;
  }) {
    const page = params.page || 1;
    const limit = params.limit || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.CouponWhereInput = {};
    if (params.isActiveOnly) {
      const now = new Date();
      where.isActive = true;
      where.validFrom = { lte: now };
      where.validUntil = { gte: now };
    }

    const [items, total] = await Promise.all([
      prisma.coupon.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.coupon.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async recordRedemption(data: {
    couponId: string;
    userId: string;
    bookingId: string;
    discountApplied: Decimal;
  }) {
    return prisma.$transaction(async (tx) => {
      // 1. Concurrency-safe check inside transaction
      const coupon = await tx.coupon.findUnique({
        where: { id: data.couponId },
      });

      if (!coupon || !coupon.isActive) {
        throw new BadRequestError('Coupon is inactive or does not exist');
      }

      if (coupon.usageCount >= coupon.usageLimit) {
        throw new BadRequestError('Coupon redemption limit has been reached');
      }

      const userRedemptions = await tx.couponRedemption.count({
        where: {
          couponId: data.couponId,
          userId: data.userId,
        },
      });

      if (userRedemptions >= coupon.perUserLimit) {
        throw new BadRequestError('User has exceeded per-user limit for this coupon');
      }

      // 2. Increment coupon usage count
      await tx.coupon.update({
        where: { id: data.couponId },
        data: {
          usageCount: { increment: 1 },
        },
      });

      // 3. Record redemption
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
