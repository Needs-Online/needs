import { CouponsRepository } from './coupons.repository';
import { ValidateCouponDto, CreateCouponDto, ListCouponsQueryDto } from './dto/coupon.dto';
import { DiscountType } from '@/common/enums';
import { BadRequestError, ConflictError } from '@/common/errors/app-error';
import { Decimal } from '@prisma/client/runtime/library';

export class CouponsService {
  constructor(private readonly couponsRepo: CouponsRepository = new CouponsRepository()) {}

  async validateCoupon(userId: string, dto: ValidateCouponDto) {
    const coupon = await this.couponsRepo.findCouponByCode(dto.code);
    if (!coupon || !coupon.isActive) {
      throw new BadRequestError('Invalid or inactive coupon code');
    }

    const now = new Date();
    if (now < coupon.validFrom || now > coupon.validUntil) {
      throw new BadRequestError('Coupon code is either expired or not yet active');
    }

    if (coupon.usageCount >= coupon.usageLimit) {
      throw new BadRequestError('Coupon redemption limit has been reached');
    }

    const userRedemptions = await this.couponsRepo.countUserRedemptions(coupon.id, userId);
    if (userRedemptions >= coupon.perUserLimit) {
      throw new BadRequestError('You have already used this coupon code');
    }

    if (dto.orderAmount < Number(coupon.minOrderAmount)) {
      throw new BadRequestError(
        `Minimum order amount of ${Number(coupon.minOrderAmount)} BDT is required to apply this coupon`
      );
    }

    let discount: number;
    if (coupon.discountType === DiscountType.PERCENTAGE) {
      const calculated = (dto.orderAmount * Number(coupon.discountValue)) / 100;
      discount = coupon.maxDiscount ? Math.min(calculated, Number(coupon.maxDiscount)) : calculated;
    } else {
      discount = Math.min(Number(coupon.discountValue), dto.orderAmount);
    }

    discount = Math.round(discount * 100) / 100;
    const finalAmount = Math.max(0, Math.round((dto.orderAmount - discount) * 100) / 100);

    return {
      couponId: coupon.id,
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue: Number(coupon.discountValue),
      discountAmount: discount,
      finalAmount,
    };
  }

  async createCoupon(dto: CreateCouponDto) {
    const existing = await this.couponsRepo.findCouponByCode(dto.code);
    if (existing) {
      throw new ConflictError(`Coupon code '${dto.code}' already exists`);
    }

    return this.couponsRepo.createCoupon({
      code: dto.code,
      description: dto.description,
      discountType: dto.discountType as any,
      discountValue: new Decimal(dto.discountValue),
      maxDiscount: dto.maxDiscount ? new Decimal(dto.maxDiscount) : undefined,
      minOrderAmount: new Decimal(dto.minOrderAmount),
      usageLimit: dto.usageLimit,
      perUserLimit: dto.perUserLimit,
      validFrom: new Date(dto.validFrom),
      validUntil: new Date(dto.validUntil),
    });
  }

  async listCoupons(query: ListCouponsQueryDto, isAdmin: boolean) {
    return this.couponsRepo.findCoupons({
      isActiveOnly: !isAdmin || query.isActiveOnly,
      page: query.page,
      limit: query.limit,
    });
  }

  async redeemCoupon(data: {
    couponId: string;
    userId: string;
    bookingId: string;
    discountApplied: number;
  }) {
    return this.couponsRepo.recordRedemption({
      couponId: data.couponId,
      userId: data.userId,
      bookingId: data.bookingId,
      discountApplied: new Decimal(data.discountApplied),
    });
  }
}
